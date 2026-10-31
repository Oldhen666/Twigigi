import { readFileSync } from "node:fs";
import { connection } from "next/server";
import { resolveUpload, uploadContentType } from "@/lib/uploads";

export async function GET(_request: Request, context: { params: Promise<{ name: string }> }) {
  await connection();
  const { name } = await context.params;
  const full = resolveUpload(`/uploads/${name}`);
  if (!full) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(readFileSync(full)), {
    headers: {
      "Content-Type": uploadContentType(full),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
