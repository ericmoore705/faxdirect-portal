import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

interface CoverSheetParams {
  to: string;
  toName?: string;
  from: string;
  fromName?: string;
  pages: number;
  subject?: string;
  notes?: string;
}

export async function generateCoverSheet(params: CoverSheetParams): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]); // Letter size

  const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const helvetica = await doc.embedFont(StandardFonts.Helvetica);

  const navy = rgb(0.118, 0.251, 0.322);
  const gray = rgb(0.4, 0.4, 0.4);
  const lightGray = rgb(0.85, 0.85, 0.85);

  // Header bar
  page.drawRectangle({
    x: 0, y: 720, width: 612, height: 72,
    color: navy,
  });

  page.drawText("FAX", {
    x: 50, y: 745, size: 36, font: helveticaBold,
    color: rgb(1, 1, 1),
  });

  page.drawText("Epic EMS, LLC", {
    x: 50, y: 725, size: 12, font: helvetica,
    color: rgb(0.8, 0.85, 0.9),
  });

  // Divider
  page.drawRectangle({
    x: 50, y: 710, width: 512, height: 1, color: lightGray,
  });

  let y = 680;
  const labelX = 50;
  const valueX = 150;
  const lineHeight = 30;

  const fields = [
    { label: "TO:", value: params.toName ? `${params.toName} — ${params.to}` : params.to },
    { label: "FROM:", value: params.fromName ? `${params.fromName} — ${params.from}` : params.from },
    { label: "DATE:", value: new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) },
    { label: "PAGES:", value: `${params.pages} (including cover)` },
  ];

  if (params.subject) {
    fields.push({ label: "RE:", value: params.subject });
  }

  for (const field of fields) {
    page.drawText(field.label, {
      x: labelX, y, size: 11, font: helveticaBold, color: navy,
    });
    page.drawText(field.value, {
      x: valueX, y, size: 11, font: helvetica, color: gray,
    });
    y -= lineHeight;

    page.drawRectangle({
      x: 50, y: y + 18, width: 512, height: 0.5, color: lightGray,
    });
  }

  // Notes section
  if (params.notes) {
    y -= 20;
    page.drawText("NOTES:", {
      x: labelX, y, size: 11, font: helveticaBold, color: navy,
    });
    y -= 20;
    // Simple word wrap
    const words = params.notes.split(" ");
    let line = "";
    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      if (testLine.length > 80) {
        page.drawText(line, { x: labelX, y, size: 10, font: helvetica, color: gray });
        y -= 16;
        line = word;
      } else {
        line = testLine;
      }
    }
    if (line) {
      page.drawText(line, { x: labelX, y, size: 10, font: helvetica, color: gray });
    }
  }

  // Footer
  page.drawRectangle({
    x: 0, y: 0, width: 612, height: 40, color: navy,
  });
  page.drawText("CONFIDENTIAL — This fax and any attachments are intended solely for the named recipient(s).", {
    x: 50, y: 15, size: 7, font: helvetica, color: rgb(0.7, 0.75, 0.8),
  });

  return doc.save();
}

/**
 * Merge cover sheet with uploaded PDF(s)
 */
export async function mergePdfs(coverSheet: Uint8Array, documents: Uint8Array[]): Promise<Uint8Array> {
  const merged = await PDFDocument.create();

  // Add cover sheet
  const coverDoc = await PDFDocument.load(coverSheet);
  const coverPages = await merged.copyPages(coverDoc, coverDoc.getPageIndices());
  for (const page of coverPages) {
    merged.addPage(page);
  }

  // Add each document
  for (const docBytes of documents) {
    try {
      const srcDoc = await PDFDocument.load(docBytes, { ignoreEncryption: true });
      const pages = await merged.copyPages(srcDoc, srcDoc.getPageIndices());
      for (const page of pages) {
        merged.addPage(page);
      }
    } catch (e) {
      console.error("Failed to merge PDF:", e);
    }
  }

  return merged.save();
}
