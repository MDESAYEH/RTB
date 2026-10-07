import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";
export async function realtimeAudit({ origin, password, restart }) {
  const login = await fetch(origin + "/api/admin", {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({ action: "login", password }),
  });
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const data = async () => await (await fetch(origin + "/api/data")).json();
  const post = async (body) => {
    const r = await fetch(origin + "/api/admin", {
      method: "POST",
      headers: { origin, cookie, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const v = await r.json();
    if (!r.ok) throw Error(JSON.stringify(v));
    return v;
  };
  const id = "reliability-" + crypto.randomUUID();
  await post({
    action: "save",
    kind: "games",
    value: {
      id,
      home: "al-ittihad",
      away: "stade-malien",
      group: "A",
      date: "2026-10-21T18:00:00+02:00",
    },
  });
  await post({ action: "status", id, version: 0, status: "Warmup" });
  await post({ action: "status", id, version: 1, status: "Live" });
  const browser = await chromium.launch({ channel: "chrome" }),
    page = await browser.newPage();
  await page.goto(origin + "/matches/" + id);
  await page.locator(".score").waitFor();
  const clients = [];
  for (let i = 0; i < 20; i++) {
    const controller = new AbortController(),
      frames = [];
    const response = await fetch(origin + "/api/live", {
      signal: controller.signal,
    });
    const reader = response.body.getReader();
    const consume = (async () => {
      let text = "";
      const decoder = new TextDecoder();
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          text += decoder.decode(value, { stream: true });
          const parts = text.split("\n\n");
          text = parts.pop();
          for (const part of parts) {
            const match = part.match(/id: (\d+)/);
            if (match) frames.push(Number(match[1]));
          }
        }
      } catch (e) {
        if (e.name !== "AbortError") throw e;
      }
    })();
    clients.push({ controller, frames, consume });
  }
  const latencies = [];
  for (let i = 0; i < 30; i++) {
    const g = (await data()).games.find((g) => g.id === id),
      start = performance.now();
    await post({
      action: "score",
      id,
      version: g.version,
      side: "home",
      points: 1,
      requestId: crypto.randomUUID(),
    });
    latencies.push(performance.now() - start);
  }
  await page
    .locator(".score")
    .filter({ hasText: "30 : 0" })
    .waitFor({ timeout: 10000 });
  await new Promise((r) => setTimeout(r, 2200));
  for (const client of clients) {
    if (
      client.frames.length < 2 ||
      client.frames.some((r, i) => i > 0 && r < client.frames[i - 1])
    )
      throw Error("SSE ordering failed");
    client.controller.abort();
  }
  await Promise.all(clients.map((c) => c.consume));
  await restart();
  await page.getByRole("status").waitFor({ state: "detached", timeout: 15000 });
  const g = (await data()).games.find((g) => g.id === id);
  if (g.homeScore !== 30) throw Error("Restart lost data");
  await post({
    action: "score",
    id,
    version: g.version,
    side: "home",
    points: 3,
  });
  await page
    .locator(".score")
    .filter({ hasText: "33 : 0" })
    .waitFor({ timeout: 15000 });
  await page.reload();
  await page.locator(".score").filter({ hasText: "33 : 0" }).waitFor();
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise((resolve) =>
        navigator.serviceWorker.addEventListener("controllerchange", resolve, {
          once: true,
        }),
      );
  });
  await page.context().setOffline(true);
  await page.getByRole("status").waitFor();
  await page.goto(origin + "/matches/" + id).catch(() => {});
  const offline = await page.locator("body").textContent();
  if (!offline.includes("غير متصل")) {
    writeFileSync("verification/phase2/offline-debug.txt", offline);
    throw Error("Offline shell missing");
  }
  await page.context().setOffline(false);
  await browser.close();
  const sorted = [...latencies].sort((a, b) => a - b);
  const result = {
    clients: 20,
    writes: 30,
    ordering: "monotonic snapshot notifications",
    reconnect: "pass",
    serverRestart: "pass",
    refresh: "pass",
    offlineShell: "pass",
    scorePreserved: 33,
    writeP95Ms: Math.round(sorted[Math.floor(sorted.length * 0.95)]),
    localOnly: true,
  };
  writeFileSync(
    "verification/phase2/realtime.json",
    JSON.stringify(result, null, 2),
  );
  console.log(JSON.stringify(result));
}
