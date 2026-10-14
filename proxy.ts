import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { securityPolicy } from "./lib/security-policy";
export function proxy(request: NextRequest) {
  const nonce = randomBytes(24).toString("base64");
  const policy = securityPolicy(nonce, process.env.NODE_ENV === "development");
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", policy);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("Content-Security-Policy", policy);
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = {
  matcher: [
    "/((?!api/|_next/static|_next/image|favicon.ico|images/|patterns/).*)",
  ],
};
