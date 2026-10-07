/** Enforce byte limits while reading, including requests without Content-Length. */
export async function boundedBody(
  req: Pick<Request, "headers" | "body">,
  limit: number,
): Promise<Uint8Array> {
  if (Number(req.headers.get("content-length") || 0) > limit)
    throw new PayloadLimit();
  const reader = req.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new PayloadLimit();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return result;
}
export class PayloadLimit extends Error {
  constructor() {
    super("Payload too large");
  }
}
export function trustedOrigin(req: Request) {
  const configured = process.env.SITE_URL;
  const origin = configured
    ? new URL(configured).origin
    : new URL(req.url).protocol + "//" + req.headers.get("host");
  return req.headers.get("origin") === origin;
}
