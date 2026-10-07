import { revision } from "@/lib/store";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;
export async function GET(req: Request) {
  // Fail before streaming, so unavailable storage is not mistaken for a healthy feed.
  await revision();
  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let stopped = false;
  let closeStream: (() => void) | undefined;
  const stop = () => {
    stopped = true;
    clearTimeout(timer);
    req.signal.removeEventListener("abort", stop);
    closeStream?.();
  };
  const stream = new ReadableStream({
    start(controller) {
      closeStream = () => {
        try {
          controller.close();
        } catch {}
      };
      let last = -1;
      const deadline = Date.now() + 240000;
      const send = async () => {
        try {
          if (stopped || Date.now() >= deadline) {
            stop();
            return;
          }
          const r = await revision();
          if (stopped) return;
          controller.enqueue(
            encoder.encode(
              r !== last
                ? `retry: 2000\nid: ${r}\ndata: ${JSON.stringify({ revision: r })}\n\n`
                : `event: heartbeat\ndata: ${JSON.stringify({ revision: r, time: Date.now() })}\n\n`,
            ),
          );
          last = r;
          timer = setTimeout(() => {
            void send();
          }, 2000);
        } catch {
          stop();
        }
      };
      req.signal.addEventListener("abort", stop, { once: true });
      if (req.signal.aborted) stop();
      else void send();
    },
    cancel() {
      closeStream = undefined;
      stop();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
