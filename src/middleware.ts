import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
 
export function middleware(request: NextRequest) {
  // Assume the token is stored in cookies for server-side checks, 
  // but since we are using localStorage in the client, we might rely on client-side protection primarily 
  // or simple cookie checks if we moved token storage there.
  // For this "simple" request where we just saved to localStorage, middleware can't access localStorage.
  // So we will rely on client-side checks or we should have saved to cookies.
  
  // However, for better UX, let's allow the page load and handle redirection in a client component 
  // OR strictly speaking, to protect routes via middleware, we NEED cookies.
  
  // Strategy: 
  // 1. We will NOT block via middleware right now because we stored token in localStorage.
  // 2. We will add a client-side check wrapper layout or similar.
  // 
  // BUT, to fulfill "protect routes", let's update the login page to ALSO set a cookie for middleware to see.
  
  const token = request.cookies.get('token')?.value
  
  const isLoginPage = request.nextUrl.pathname === '/login'
  
  if (!token && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  
  if (token && isLoginPage) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }
 
  return NextResponse.next()
}
 
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
