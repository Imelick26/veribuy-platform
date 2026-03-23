import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  console.log("[MIDDLEWARE]", pathname);

  // Public routes that don't require auth — check BEFORE token lookup
  const publicRoutes = ["/", "/login", "/register", "/api/auth", "/api/trpc", "/dev"];
  if (publicRoutes.some((route) => pathname === route || (route !== "/" && pathname.startsWith(route)))) {
    console.log("[MIDDLEWARE] Public route, allowing:", pathname);
    return NextResponse.next();
  }

  // Check for JWT token (doesn't require Prisma/DB in edge runtime)
  try {
    const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
    if (token) return NextResponse.next();
  } catch {
    // Token check failed (no DB, etc.) — fall through to redirect
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("callbackUrl", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    // Match all routes except static files and Next.js internals
    "/((?!_next|favicon.ico|models|dev|.*\\.(?:svg|png|jpg|jpeg|gif|webp|glb|gltf)$).*)",
  ],
};
