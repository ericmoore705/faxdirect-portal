import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { sendFax } from "@/lib/signalwire";

const MAX_RETRIES = 3;
const RETRY_DELAYS = [60_000, 180_000, 600_000]; // 1min, 3min, 10min

/**
 * SignalWire POSTs fax status updates here.
 * This replaces the Base44 integration polling that was burning credits.
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const faxSid = formData.get("FaxSid") as string;
    const status = formData.get("FaxStatus") as string;
    const numPages = formData.get("NumPages") as string;
    const duration = formData.get("Duration") as string;
    const errorMessage = formData.get("ErrorMessage") as string;

    if (!faxSid) {
      return NextResponse.json({ error: "Missing FaxSid" }, { status: 400 });
    }

    const fax = await prisma.sentFax.findUnique({ where: { faxSid } });
    if (!fax) {
      console.warn(`Status callback for unknown fax SID: ${faxSid}`);
      return new NextResponse("OK", { status: 200 });
    }

    const updateData: any = { status };

    if (numPages) updateData.numPages = parseInt(numPages, 10);
    if (duration) updateData.duration = parseInt(duration, 10);

    // Terminal states
    if (status === "delivered" || status === "canceled") {
      updateData.completedAt = new Date();
    }

    if (status === "failed") {
      updateData.errorMessage = errorMessage || "failed";

      // Auto-retry logic (matches Base44 app behavior)
      if (fax.retryCount < MAX_RETRIES) {
        const retryDelay = RETRY_DELAYS[fax.retryCount] || 600_000;

        // Schedule retry
        updateData.retryCount = fax.retryCount + 1;
        updateData.lastRetryAt = new Date();
        updateData.status = "retrying";

        // Fire retry after delay (in production, use a queue like Vercel Cron)
        setTimeout(async () => {
          try {
            const baseUrl = process.env.NEXTAUTH_URL;
            const result = await sendFax({
              to: fax.toNumber,
              mediaUrl: fax.fileUrl!,
              statusCallback: `${baseUrl}/api/fax/status`,
            });

            // Update with new SID
            await prisma.sentFax.update({
              where: { id: fax.id },
              data: { faxSid: result.sid, status: result.status || "queued" },
            });
          } catch (e) {
            console.error(`Retry failed for fax ${fax.id}:`, e);
            await prisma.sentFax.update({
              where: { id: fax.id },
              data: { status: "failed", completedAt: new Date(), errorMessage: "Retry failed" },
            });
          }
        }, retryDelay);
      } else {
        updateData.completedAt = new Date();
      }
    }

    await prisma.sentFax.update({
      where: { faxSid },
      data: updateData,
    });

    return new NextResponse("OK", { status: 200 });
  } catch (error: any) {
    console.error("Status callback error:", error);
    return new NextResponse("OK", { status: 200 }); // Always 200 to avoid SignalWire retries
  }
}
