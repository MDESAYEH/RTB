import { test, expect } from "@playwright/test";
import sharp from "sharp";
import { createHash, randomUUID } from "node:crypto";

test("authenticated staged upload retains canonical public media URL and immutable caching", async ({
  context,
  request,
}) => {
  const origin = process.env.E2E_BASE_URL || "http://127.0.0.1:3001";

  const headers = { origin };

  const metadata = {
    action: "start",
    name: "fixture.jpg",
    type: "image/jpeg",
    size: 1,
  };

  expect(
    (
      await request.post("/api/media", {
        headers,
        data: metadata,
      })
    ).status(),
  ).toBe(401);

  expect(
    (
      await context.request.post("/api/admin", {
        headers,
        data: {
          action: "login",
          password: process.env.E2E_PASSWORD,
        },
      })
    ).ok(),
  ).toBe(true);

  // اجعل الصورة مختلفة في كل تشغيل حتى ينتج SHA-256 مختلف.
  // هذا يمنع سجلات Audit القديمة من التأثير على الاختبار.
  const uniqueColor = `#${randomUUID().replace(/-/g, "").slice(0, 6)}`;

  const raw = await sharp({
    create: {
      width: 64,
      height: 64,
      channels: 3,
      background: uniqueColor,
    },
  })
    .jpeg()
    .withMetadata()
    .toBuffer();

  const start = await context.request.post("/api/media", {
    headers,
    data: {
      ...metadata,
      size: raw.length,
    },
  });

  expect(start.ok()).toBe(true);

  const upload = await start.json();

  expect(
    (
      await context.request.post("/api/media", {
        headers,
        data: {
          action: "complete",
          uploadId: upload.uploadId,
        },
      })
    ).status(),
  ).toBe(400);

  const chunk = await context.request.put(
    "/api/media?upload=" + upload.uploadId + "&part=0",
    {
      headers,
      data: raw,
    },
  );

  expect(chunk.ok()).toBe(true);

  const complete = await context.request.post("/api/media", {
    headers,
    data: {
      action: "complete",
      uploadId: upload.uploadId,
    },
  });

  expect(complete.ok()).toBe(true);

  const result = await complete.json();

  expect(result.url).toMatch(/^\/api\/media\/[a-f0-9]{64}\.webp$/);

  const repeated = await context.request.post("/api/media", {
    headers,
    data: {
      action: "complete",
      uploadId: upload.uploadId,
    },
  });

  expect(await repeated.json()).toEqual(result);

  const image = await request.get(result.url);

  expect(image.ok()).toBe(true);

  expect(image.headers()["cache-control"]).toBe(
    "public, max-age=31536000, immutable",
  );

  expect(image.headers()["content-type"]).toBe("image/webp");

  const bytes = await image.body();

  expect(result.url).toContain(
    createHash("sha256").update(bytes).digest("hex"),
  );

  const details = await sharp(bytes).metadata();

  expect(details.exif).toBeUndefined();
  expect(details.icc).toBeUndefined();

  const state = await (await context.request.get("/api/admin")).json();

  expect(
    state.audit.filter(
      (row: { kind: string; target: string }) =>
        row.kind === "media" && result.url.endsWith(row.target),
    ),
  ).toHaveLength(1);

  expect(
    (await request.get("/api/media/staging/" + upload.uploadId)).status(),
  ).toBe(404);
});
