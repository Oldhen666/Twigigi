import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { normalizeSrc, SRC_COOKIE } from "@/lib/format";
import { readSession, SESSION_COOKIE } from "@/lib/session";

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const needsAuth = pathname === "/dashboard" || pathname.startsWith("/dashboard/") || pathname === "/admin" || pathname.startsWith("/admin/");
  if (needsAuth) {
    const userId = await readSession(request.cookies.get(SESSION_COOKIE)?.value);
    if (!userId) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
  }

  const response = NextResponse.next();
  const src = normalizeSrc(request.nextUrl.searchParams.get("src"));
  if (src) {
    response.cookies.set(SRC_COOKIE, src, {
      path: "/",
      maxAge: 60 * 60 * 24,
      sameSite: "lax",
      httpOnly: true,
    });
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)"],
};
