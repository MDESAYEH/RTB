import { isIP } from "node:net";
/**
 * Per-client login bucket. Client IP headers are trusted only when a proxy is
 * known to overwrite them: TRUST_PROXY_IP=1 (nginx replaces X-Real-IP, origin
 * private) or Vercel, whose edge sets X-Real-IP itself. Otherwise every client
 * shares one bucket, which an anonymous caller can exhaust.
 */
export function loginBucket(req: Request) {
  if (process.env.TRUST_PROXY_IP !== "1" && process.env.VERCEL !== "1")
    return "login";
  const ip = req.headers.get("x-real-ip") || "";
  if (!isIP(ip)) throw Error("Trusted proxy client address missing");
  return "login:" + ip;
}
