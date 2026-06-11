import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "sent"; // "sent" or "received"
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = Math.min(parseInt(searchParams.get("limit") || "25", 10), 100);
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "";
  const skip = (page - 1) * limit;

  try {
    if (type === "sent") {
      const where: any = {};
      if (search) {
        where.OR = [
          { toNumber: { contains: search } },
          { fileName: { contains: search, mode: "insensitive" } },
        ];
      }
      if (status) {
        where.status = status;
      }

      const [faxes, total] = await Promise.all([
        prisma.sentFax.findMany({
          where,
          orderBy: { sentAt: "desc" },
          skip,
          take: limit,
          include: { sentBy: { select: { name: true, email: true } } },
        }),
        prisma.sentFax.count({ where }),
      ]);

      return NextResponse.json({ faxes, total, page, limit });
    } else {
      const where: any = {};
      if (search) {
        where.fromNumber = { contains: search };
      }

      const [faxes, total] = await Promise.all([
        prisma.receivedFax.findMany({
          where,
          orderBy: { receivedAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.receivedFax.count({ where }),
      ]);

      return NextResponse.json({ faxes, total, page, limit });
    }
  } catch (error: any) {
    console.error("History query error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
