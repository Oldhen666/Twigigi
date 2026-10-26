import fs from "node:fs";
import path from "node:path";
import { ImageResponse } from "next/og";
import { getPublicProduct, requireLiveTwig, staticProductParams } from "@/lib/catalog";
import { formatMoney } from "@/lib/format";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Twigigi product";

export function generateStaticParams() {
  return staticProductParams().map(({ username, product }) => ({ username, product }));
}

function photoData(urlPath: string | undefined) {
  if (!urlPath) return null;
  const relative = urlPath.replace(/^\/+/, "");
  if (!/^(uploads|seed)\/[a-zA-Z0-9._-]+$/.test(relative)) return null;
  const full = path.join(process.cwd(), "public", relative);
  if (!fs.existsSync(full)) return null;
  const ext = path.extname(full).slice(1).toLowerCase();
  const mime = ext === "png" ? "image/png" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : null;
  if (!mime) return null;
  return `data:${mime};base64,${fs.readFileSync(full).toString("base64")}`;
}

export default async function Image({
  params,
}: {
  params: Promise<{ username: string; product: string }>;
}) {
  const { username, product: slug } = await params;
  const product = await requireLiveTwig(await getPublicProduct(username, slug));
  const title = product?.title ?? "Twigigi";
  const price = product?.priceCents != null ? formatMoney(product.priceCents, product.currency) : "Pricing on request";
  const location = product?.location ?? "";
  const photo = photoData(product?.images[0]);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#f3eee6", fontFamily: "sans-serif" }}>
        <div style={{ width: "58%", height: "100%", display: "flex", background: "#1b4332" }}>
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" width={696} height={630} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : null}
        </div>
        <div style={{ width: "42%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "48px" }}>
          <div style={{ fontSize: 28, color: "#1b4332" }}>Twigigi</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 22, letterSpacing: 2, textTransform: "uppercase", color: "#6d655b" }}>{location}</div>
            <div style={{ marginTop: 16, fontSize: 56, lineHeight: 1.05, color: "#1c1915" }}>{title}</div>
            <div style={{ marginTop: 20, fontSize: 40, color: "#1b4332" }}>{price}</div>
          </div>
          <div style={{ fontSize: 22, color: "#6d655b" }}>{`twigigi.com/${username}/${slug}`}</div>
        </div>
      </div>
    ),
    size,
  );
}
