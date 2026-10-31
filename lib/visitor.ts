import { cookies } from "next/headers";

const VISITOR_COOKIE = "twigigi_visitor";
const VISITOR = /^v[a-z0-9]{20}$/;

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
};

export async function readVisitor() {
  const value = (await cookies()).get(VISITOR_COOKIE)?.value ?? "";
  return VISITOR.test(value) ? value : "";
}

export async function ensureVisitor() {
  const existing = await readVisitor();
  if (existing) return existing;
  const id = `v${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
  (await cookies()).set(VISITOR_COOKIE, id, cookieOptions);
  return id;
}
