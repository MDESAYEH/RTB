/**
 * Phase 1 FIBA client: plain HTTP GET of public event pages only.
 * No authentication, no anti-bot handling, no undocumented API calls.
 */
export const FIBA_HOST = "www.fiba.basketball";
export const FIBA_EVENT_SLUG = "fiba-africa-champions-clubs-road-to-bal-2027";
export const FIBA_PAGES = {
  games: `/en/events/${FIBA_EVENT_SLUG}/games`,
} as const;
export type FibaPage = keyof typeof FIBA_PAGES;

const MAX_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 20_000;

export class FibaFetchError extends Error {}

export type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export function fibaPageUrl(page: FibaPage): string {
  return `https://${FIBA_HOST}${FIBA_PAGES[page]}`;
}

/** One polite GET per page. Anything other than a plain HTML 200 fails closed. */
export async function fetchFibaPage(
  page: FibaPage,
  fetchImpl: FetchLike = fetch,
): Promise<{ url: string; html: string }> {
  const url = fibaPageUrl(page);
  let response: Response;
  try {
    response = await fetchImpl(url, {
      headers: {
        accept: "text/html",
        "user-agent": "RoadToBAL-dry-run/1.0 (local technical check)",
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw new FibaFetchError(
      `Request to ${url} failed: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (response.status !== 200) {
    throw new FibaFetchError(`${url} answered HTTP ${response.status}`);
  }
  const finalUrl = response.url ? new URL(response.url) : new URL(url);
  if (finalUrl.host !== FIBA_HOST || !finalUrl.pathname.startsWith("/en/events/")) {
    throw new FibaFetchError(`Unexpected redirect to ${finalUrl.href}`);
  }
  if (!(response.headers.get("content-type") ?? "").includes("text/html")) {
    throw new FibaFetchError(`${url} did not return HTML`);
  }
  const html = await response.text();
  if (html.length > MAX_BYTES) {
    throw new FibaFetchError(`${url} exceeded ${MAX_BYTES} bytes`);
  }
  return { url, html };
}
