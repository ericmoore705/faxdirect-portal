import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendFax, normalizePhoneNumber } from "@/lib/signalwire";
import { generateCoverSheet, mergePdfs } from "@/lib/coversheet";
import { put } from "@vercel/blob";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { to, toName, fileUrls, fileNames, includeCoverSheet, subject, notes } = body;

    if (!to || !fileUrls?.length) {
      return NextResponse.json({ error: "Recipient number and at least one PDF are required" }, { status: 400 });
    }

    const normalizedTo = normalizePhoneNumber(to);
    const userId = (session.user as any).id;

    // Build the final PDF to fax
    let finalPdfUrl: string;

    if (includeCoverSheet !== false) {
      // Download all uploaded PDFs
      const pdfBuffers: Uint8Array[] = [];
      for (const url of fileUrls) {
        const res = await fetch(url);
        const buf = await res.arrayBuffer();
        pdfBuffers.push(new Uint8Array(buf));
      }

      // Generate cover sheet
      const totalPages = pdfBuffers.length + 1; // rough estimate, cover counts as 1
      const coverSheet = await generateCoverSheet({
        to: normalizedTo,
        toName,
        from: process.env.SIGNALWIRE_FAX_NUMBER || "+18882789949",
        fromName: session.user.name || session.user.email!,
        pages: totalPages,
        subject,
        notes,
      });

      // Merge cover + docs
      const merged = await mergePdfs(coverSheet, pdfBuffers);

      // Upload merged PDF to Vercel Blob
      const blob = await put(`faxes/merged_${Date.now()}.pdf`, Buffer.from(merged), {
        access: "public",
        contentType: "application/pdf",
      });
      finalPdfUrl = blob.url;
    } else {
      // If only one file and no cover sheet, use it directly
      finalPdfUrl = fileUrls[0];
    }

    // Determine status callback URL
    const baseUrl = process.env.NEXTAUTH_URL || `https://${req.headers.get("host")}`;
    const statusCallback = `${baseUrl}/api/fax/status`;

    // Send via SignalWire
    const faxResult = await sendFax({
      to: normalizedTo,
      mediaUrl: finalPdfUrl,
      statusCallback,
    });

    // Record in database
    const sentFax = await prisma.sentFax.create({
      data: {
        toNumber: normalizedTo,
        fromNumber: process.env.SIGNALWIRE_FAX_NUMBER || "+18882789949",
        faxSid: faxResult.sid,
        status: faxResult.status || "queued",
        fileName: fileNames?.join(", ") || "document.pdf",
        fileUrl: finalPdfUrl,
        sentById: userId,
      },
    });

    // Increment use_count on saved number if it exists
    await prisma.savedFaxNumber.updateMany({
      where: {
        phoneNumber: normalizedTo,
        createdById: userId,
      },
      data: {
        useCount: { increment: 1 },
      },
    });

    return NextResponse.json({
      success: true,
      fax: sentFax,
    });
  } catch (error: any) {
    console.error("Send fax error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
