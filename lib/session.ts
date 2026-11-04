import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "twigigi_session";

function key() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return null;
  return new TextEncoder().encode(secret);
}

export async function signSession(userId: string, actorId = "") {
  const secret = key();
  if (!secret) throw new Error("AUTH_SECRET is not set");
  const claims: Record<string, string> = {};
  if (actorId) claims.act = actorId;
  return new SignJWT(claims)
    .setSubject(userId)
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
    const userId = typeof payload.sub === "string" ? payload.sub : "";
    if (!userId) return null;
    const actorId = typeof payload.act === "string" ? payload.act : "";
    return { userId, actorId };
  } catch {
    return null;
  }
}
