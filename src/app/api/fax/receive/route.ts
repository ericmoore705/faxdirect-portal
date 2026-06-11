import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { downloadFaxMedia } from "@/lib/signalwire";
import { put } from "@vercel/blob";

/**
 * SignalWire POSTs here when an inbound fax arrives.
 * Configure this URL in your SignalWire phone number settings.
 *
 * This replaces the Base44 integration webhook that was burning credits
 * every time a fax came in.
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const faxSid = formData.get("FaxSid") as string;
    const from = formData.get("From") as string;
    const to = formData.get("To") as string;
    const numPages = formData.get("NumPages") as string;
    const mediaUrl = formData.get("MediaUrl") as string;
    const status = formData.get("FaxStatus") as string;

    if (!faxSid) {
      return new NextResponse("Missing FaxSid", { status: 400 });
    }

    // Check for duplicate
    const existing = await prisma.receivedFax.findUnique({ where: { faxSid } });
    if (existing) {
      return new NextResponse("OK", { status: 200 });
    }

    // Download and store the fax PDF locally in Vercel Blob
    let localUrl: string | undefined;
    if (mediaUrl) {
      try {
        const pdfBuffer = await downloadFaxMedia(mediaUrl);
        const blob = await put(`received/${Date.now()}_${faxSid}.pdf`, pdfBuffer, {
          access: "public",
          contentType: "application/pdf",
        });
        localUrl = blob.url;
      } catch (e) {
        console.error("Failed to download received fax media:", e);
      }
    }

    await prisma.receivedFax.create({
      data: {
        faxSid,
        fromNumber: from || "unknown",
        toNumber: to || process.env.SIGNALWIRE_FAX_NUMBER || "+18882789949",
        status: status || "received",
        numPages: numPages ? parseInt(numPages, 10) : null,
        mediaUrl: mediaUrl || null,
        localUrl: localUrl || null,
        receivedAt: new Date(),
      },
    });

    return new NextResponse("OK", { status: 200 });
  } catch (error: any) {
    console.error("Receive webhook error:", error);
    return new NextResponse("OK", { status: 200 });
  }
}
