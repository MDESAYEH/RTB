import { test } from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { boundedBody, PayloadLimit, trustedOrigin } from "../lib/request";
import { validateImage } from "../lib/image-upload";
import { gameSchema, score, remainingClock } from "../lib/domain";
import { loginBucket } from "../lib/login-limit";
test("proxy login limits never trust client headers by default", () => {
  const before = process.env.TRUST_PROXY_IP;
  try {
    delete process.env.TRUST_PROXY_IP;
    assert.equal(
      loginBucket(
        new Request("http://localhost", {
          headers: { "x-real-ip": "1.2.3.4" },
        }),
      ),
      "login",
    );
    process.env.TRUST_PROXY_IP = "1";
    assert.throws(() => loginBucket(new Request("http://localhost")));
    assert.throws(() =>
      loginBucket(
        new Request("http://localhost", {
          headers: { "x-real-ip": "spoofed, 1.2.3.4" },
        }),
      ),
    );
    assert.equal(
      loginBucket(
        new Request("http://localhost", {
          headers: { "x-real-ip": "1.2.3.4" },
        }),
      ),
      "login:1.2.3.4",
    );
  } finally {
    if (before === undefined) delete process.env.TRUST_PROXY_IP;
    else process.env.TRUST_PROXY_IP = before;
  }
});
test("streamed request limits cannot be bypassed by omitting Content-Length", async () => {
  const request = new Request("http://localhost", {
    method: "POST",
    body: new ReadableStream({
      start(c) {
        c.enqueue(new Uint8Array(8));
        c.enqueue(new Uint8Array(8));
        c.close();
      },
    }),
    duplex: "half",
  } as RequestInit);
  await assert.rejects(boundedBody(request, 10), PayloadLimit);
});
test("byte limit includes multibyte Arabic input", async () => {
  await assert.rejects(
    boundedBody(
      new Request("http://localhost", { method: "POST", body: "طرابلس" }),
      8,
    ),
    PayloadLimit,
  );
});
test("request origin rejects cross-site and absent Origin", () => {
  assert.equal(
    trustedOrigin(
      new Request("http://localhost", {
        headers: { host: "localhost", origin: "https://evil.example" },
      }),
    ),
    false,
  );
  assert.equal(
    trustedOrigin(
      new Request("http://localhost", { headers: { host: "localhost" } }),
    ),
    false,
  );
});
test("image validation rejects magic-header forgery, SVG and MIME mismatch", async () => {
  await assert.rejects(
    validateImage(
      new File(
        [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])],
        "fake.png",
        { type: "image/png" },
      ),
    ),
  );
  await assert.rejects(
    validateImage(
      new File(['<svg onload="alert(1)"/>'], "fake.svg", {
        type: "image/svg+xml",
      }),
    ),
  );
  const image = await sharp({
    create: { width: 2, height: 2, channels: 3, background: "red" },
  })
    .png()
    .toBuffer();
  await assert.rejects(
    validateImage(new File([image], "fake.jpg", { type: "image/jpeg" })),
  );
  await assert.rejects(
    validateImage(
      new File([image], "fake.png", { type: "application/octet-stream" }),
    ),
  );
});
test("image validation rejects traversal filenames and oversized content", async () => {
  await assert.rejects(
    validateImage(new File(["test"], "../outside.png", { type: "image/png" })),
  );
  await assert.rejects(
    validateImage(
      new File([new Uint8Array(5242881)], "big.png", { type: "image/png" }),
    ),
  );
});
test("image decode rejects excessive pixels", async () => {
  const image = await sharp({
    create: { width: 4001, height: 4001, channels: 3, background: "black" },
  })
    .png()
    .toBuffer();
  await assert.rejects(
    validateImage(new File([image], "big.png", { type: "image/png" })),
  );
});
test("valid uploads are stripped, deterministic and cannot collide by filename", async () => {
  const image = await sharp({
    create: { width: 3, height: 3, channels: 3, background: "red" },
  })
    .png()
    .toBuffer();
  const a = await validateImage(
    new File([image], "logo.png", { type: "image/png" }),
  );
  const b = await validateImage(
    new File([image], "different.png", { type: "image/png" }),
  );
  assert.equal(a.id, b.id);
  assert.equal((await sharp(a.bytes).metadata()).format, "webp");
  const other = await sharp({
    create: { width: 3, height: 3, channels: 3, background: "blue" },
  })
    .png()
    .toBuffer();
  assert.notEqual(
    a.id,
    (await validateImage(new File([other], "logo.png", { type: "image/png" })))
      .id,
  );
});
test("invalid scoring side fails without mutating scores", () => {
  const g = gameSchema.parse({
    id: "g",
    home: "a",
    away: "b",
    group: "A",
    date: "2026-10-21T18:00:00+02:00",
    status: "Live",
  });
  assert.throws(() => score(g, "invalid" as "home", 3));
  assert.equal(g.awayScore, 0);
});
test("clock cannot grow on future timestamps or become NaN", () => {
  const g = gameSchema.parse({
    id: "g",
    home: "a",
    away: "b",
    group: "A",
    date: "2026-10-21T18:00:00+02:00",
    running: true,
    updatedAt: "2026-10-21T18:00:00+02:00",
  });
  assert.equal(remainingClock(g, 0), 600);
  assert.equal(remainingClock({ ...g, updatedAt: "invalid" }), 600);
});
