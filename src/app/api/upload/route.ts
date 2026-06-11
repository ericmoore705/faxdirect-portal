import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { put } from "@vercel/blob";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const files = formData.getAll("files") as File[];

    if (!files.length) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const uploaded = [];

    for (const file of files) {
      if (file.type !== "application/pdf") {
        return NextResponse.json({ error: `File "${file.name}" is not a PDF` }, { status: 400 });
      }

      const blob = await put(`faxes/${Date.now()}_${file.name}`, file, {
        access: "public",
        contentType: "application/pdf",
      });

      uploaded.push({
        name: file.name,
        url: blob.url,
        size: file.size,
      });
    }

    return NextResponse.json({ files: uploaded });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
