export { default } from "next-auth/middleware";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/send/:path*",
    "/sent/:path*",
    "/received/:path*",
    "/contacts/:path*",
    "/api/fax/send",
    "/api/fax/history",
    "/api/contacts",
    "/api/upload",
  ],
};
