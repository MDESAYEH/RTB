import { test } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { BasketballLoading } from "../app/basketball-loading";
test("basketball loading is a lightweight actual Suspense fallback with an accessible status", () => {
  const html = renderToStaticMarkup(createElement(BasketballLoading));
  assert.match(html, /role="status"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /loading-ball-route/);
  assert.match(html, /loading-baseline/);
  assert.match(html, /TRIPOLI \/ 2027/);
  const source = readFileSync("app/basketball-loading.tsx", "utf8");
  assert.doesNotMatch(source, /setTimeout|setInterval|fetch\(/);
  const css = readFileSync("app/basketball-loading.css", "utf8");
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /baseline-drift/);
});
