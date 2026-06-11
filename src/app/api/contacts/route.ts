import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { normalizePhoneNumber } from "@/lib/signalwire";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";

  const where: any = {};
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { phoneNumber: { contains: search } },
    ];
  }

  const contacts = await prisma.savedFaxNumber.findMany({
    where,
    orderBy: { useCount: "desc" },
    include: { createdBy: { select: { name: true, email: true } } },
  });

  return NextResponse.json({ contacts });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = (session.user as any).id;
  const body = await req.json();
  const { name, phoneNumber } = body;

  if (!name || !phoneNumber) {
    return NextResponse.json({ error: "Name and phone number required" }, { status: 400 });
  }

  const normalized = normalizePhoneNumber(phoneNumber);

  const contact = await prisma.savedFaxNumber.upsert({
    where: {
      phoneNumber_createdById: { phoneNumber: normalized, createdById: userId },
    },
    update: { name },
    create: {
      name,
      phoneNumber: normalized,
      createdById: userId,
    },
  });

  return NextResponse.json({ contact });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Contact ID required" }, { status: 400 });
  }

  await prisma.savedFaxNumber.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
