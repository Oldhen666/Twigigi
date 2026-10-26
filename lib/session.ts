import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "twigigi_session";

function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  return new TextEncoder().encode(secret);
}

export async function signSession(userId: string) {
  const secret = key();
  if (!secret) throw new Error("AUTH_SECRET is not set");
  return new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(secret);
}

export async function readSession(token: string | undefined) {
  const secret = key();
  if (!secret || !token) return null;
  try {
    const { payload } = await jwtVerify(token, secret);
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}
