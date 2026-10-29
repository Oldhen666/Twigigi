function pdfText(value: string) {
  return value.replace(/[^\x20-\x7E]/g, " ").replace(/[()\\]/g, (char) => `\\${char}`);
}

export function receiptPdf(lines: string[]) {
  const rows = lines.length ? lines : ["No receipt for this year."];
  const chunks: string[][] = [];
  for (let index = 0; index < rows.length; index += 40) chunks.push(rows.slice(index, index + 40));

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  const pageIds: number[] = [];
  for (const chunk of chunks) {
    const content = chunk.map((line, index) => `BT /F1 11 Tf 48 ${740 - index * 16} Td (${pdfText(line)}) Tj ET`).join("\n");
    const contentId = objects.length + 1;
    objects.push(`<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`);
    const pageId = objects.length + 1;
    pageIds.push(pageId);
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents ${contentId} 0 R /Resources << /Font << /F1 3 0 R >> >> >>`,
    );
  }
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
