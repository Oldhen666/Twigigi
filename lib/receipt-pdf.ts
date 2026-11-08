function pdfText(value: string) {
  return value.replace(/[^\x20-\x7E]/g, " ").replace(/[()\\]/g, (char) => `\\${char}`);
}

export type ReceiptLine = { date: string; description: string; amount: string };

export function receiptPdf(input: { year: string; seller: string; lines: ReceiptLine[] }) {
  const pages: ReceiptLine[][] = [];
  const source = input.lines.length ? input.lines : [{ date: "", description: "No Twigigi fees were billed this year.", amount: "" }];
  for (let index = 0; index < source.length; index += 28) pages.push(source.slice(index, index + 28));

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>",
  ];
  const pageIds: number[] = [];
  pages.forEach((rows, pageIndex) => {
    const commands = [
      "BT /F2 22 Tf 48 730 Td (Twigigi) Tj ET",
      `BT /F2 13 Tf 48 702 Td (${pdfText(`Annual statement ${input.year}`)}) Tj ET`,
      `BT /F1 11 Tf 48 682 Td (${pdfText(input.seller)}) Tj ET`,
      "0.89 0.86 0.82 RG 48 666 m 564 666 l S",
      "BT /F2 9 Tf 48 648 Td (Date) Tj ET",
      "BT /F2 9 Tf 130 648 Td (Description) Tj ET",
      "BT /F2 9 Tf 470 648 Td (Amount) Tj ET",
      "0.89 0.86 0.82 RG 48 640 m 564 640 l S",
    ];
    rows.forEach((line, index) => {
      const y = 622 - index * 18;
      if (line.date) commands.push(`BT /F1 10 Tf 48 ${y} Td (${pdfText(line.date)}) Tj ET`);
      commands.push(`BT /F1 10 Tf 130 ${y} Td (${pdfText(line.description.slice(0, 62))}) Tj ET`);
      if (line.amount) commands.push(`BT /F1 10 Tf 470 ${y} Td (${pdfText(line.amount)}) Tj ET`);
    });
    commands.push("BT /F1 9 Tf 48 48 Td (Buyer payments go directly to you and are not listed here.) Tj ET");
    if (pages.length > 1) commands.push(`BT /F1 9 Tf 520 48 Td (${pdfText(`${pageIndex + 1} / ${pages.length}`)}) Tj ET`);
    const content = commands.join("\n");
    const contentId = objects.length + 1;
    objects.push(`<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`);
    const pageId = objects.length + 1;
    pageIds.push(pageId);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentId} 0 R /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> >>`,
    );
  });
  objects[1] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;

  let offset = Buffer.byteLength("%PDF-1.4\n", "utf8");
  const offsets = [0];
  const parts = ["%PDF-1.4\n"];
  objects.forEach((body, index) => {
    const object = `${index + 1} 0 obj\n${body}\nendobj\n`;
    offsets.push(offset);
    parts.push(object);
    offset += Buffer.byteLength(object, "utf8");
  });
  let xref = `xref\n0 ${offsets.length}\n0000000000 65535 f \n`;
  for (let index = 1; index < offsets.length; index += 1) {
    xref += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  xref += `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${offset}\n%%EOF`;
  return Buffer.from(parts.join("") + xref, "utf8");
}
