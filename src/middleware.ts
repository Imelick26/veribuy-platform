import { NextResponse, type NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public routes that don't require auth
  const publicRoutes = ["/login", "/register", "/api/auth", "/api/trpc"];
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  // Check for JWT token — Auth.js v5 uses "authjs.session-token" cookie (not "next-auth.*")
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
    salt: "authjs.session-token",
  });
  const isLoggedIn = !!token;

  // Allow public routes
  if (isPublicRoute) {
    // Redirect logged-in users away from auth pages
    if (isLoggedIn && (pathname === "/login" || pathname === "/register")) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  // Redirect unauthenticated users to login
  if (!isLoggedIn) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all routes except static files and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
