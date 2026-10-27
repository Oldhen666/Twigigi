import { getCurrentUser } from "@/lib/auth";
import { getProductById, recordView } from "@/lib/db";
import { normalizeSrc, srcFromReferrer } from "@/lib/format";

export async function POST(request: Request) {
  let body: { productId?: unknown; src?: unknown; referrer?: unknown };
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 204 });
  }
  if (typeof body.productId !== "string") return new Response(null, { status: 204 });
  const product = getProductById(body.productId);
  if (!product || product.status !== "published") return new Response(null, { status: 204 });
  const src =
    normalizeSrc(typeof body.src === "string" ? body.src : "") ||
    srcFromReferrer(typeof body.referrer === "string" ? body.referrer : "") ||
    "direct";
  const viewer = await getCurrentUser();
  recordView(product.id, src, viewer?.id ?? null);
  return new Response(null, { status: 204 });
}
