import { authkitMiddleware } from "@workos-inc/authkit-nextjs";

export default authkitMiddleware();

export const config = {
  matcher: [
    "/login/:path*",
    "/callback/:path*",
    "/dashboard/:path*",
    "/ask/:path*",
    "/knowledge/:path*",
    "/documents/:path*",
    "/graph/:path*",
    "/agents/:path*",
    "/approvals/:path*",
    "/members/:path*",
    "/audit/:path*",
    "/settings/:path*",

    "/api/workos/invite",
    "/api/workos/invite/:path*",

    "/retrieval-history/:path*",

    "/reviews/:path*",

    "/api/ask/answer",
    "/api/ask/answer/:path*",

    "/search/:path*",
  ],
};
