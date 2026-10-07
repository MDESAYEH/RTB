import { revision } from "@/lib/store";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export function GET(req: Request) {
  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval>;
  const stream = new ReadableStream({
    start(controller) {
      let last = -1;
      const send = () => {
        try {
          const r = revision();
          controller.enqueue(
            encoder.encode(
              r !== last
                ? `retry: 2000\nid: ${r}\ndata: ${JSON.stringify({ revision: r })}\n\n`
                : `event: heartbeat\ndata: ${JSON.stringify({ revision: r, time: Date.now() })}\n\n`,
            ),
          );
          last = r;
        } catch {
          clearInterval(timer);
          try {
            controller.close();
          } catch {}
        }
      };
      send();
      timer = setInterval(send, 2000);
      req.signal.addEventListener(
        "abort",
        () => {
          clearInterval(timer);
          try {
            controller.close();
          } catch {}
        },
        { once: true },
      );
    },
    cancel() {
      clearInterval(timer);
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
