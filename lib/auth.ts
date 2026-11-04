import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { findUserById } from "@/lib/db";
import { readSession, SESSION_COOKIE, signSession } from "@/lib/session";

const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

export async function setSession(userId: string, actorId = "") {
  const token = await signSession(userId, actorId);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, cookieOptions);
}

export async function clearSession() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

async function activeSession() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await readSession(token);
  if (!session) return null;
  const user = findUserById(session.userId);
  if (!user) return null;
  const actor = session.actorId && session.actorId !== session.userId ? findUserById(session.actorId) : null;
  const impersonating = Boolean(actor && !actor.suspended && actor.role === "admin");
  if (user.suspended && !impersonating) return null;
  return { user, actor: impersonating ? actor : null };
}

export async function getCurrentUser() {
  const active = await activeSession();
  return active?.user ?? null;
}

export async function getImpersonation() {
  const active = await activeSession();
  return active?.actor ?? null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireSeller() {
  return requireUser();
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "admin") redirect("/dashboard");
  return user;
}
