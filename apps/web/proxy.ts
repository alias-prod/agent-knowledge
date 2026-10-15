import { NextResponse } from "next/server";

// Authorization lives in the server layout, route handlers, and Convex data paths.
export function proxy() { return NextResponse.next(); }
export const config = { matcher: ["/dashboard/:path*", "/documents/:path*", "/settings/:path*"] };
