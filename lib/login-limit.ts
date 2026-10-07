import { isIP } from "node:net";
/** Enable only behind a reverse proxy that replaces X-Real-IP, with origin server private. */
export function loginBucket(req: Request) {
  if (process.env.TRUST_PROXY_IP !== "1") return "login";
  const ip = req.headers.get("x-real-ip") || "";
  if (!isIP(ip)) throw Error("Trusted proxy client address missing");
  return "login:" + ip;
}
