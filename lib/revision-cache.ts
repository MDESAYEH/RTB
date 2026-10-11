/**
 * Shares one revision lookup between every open live-feed connection in this
 * process, so viewer count does not multiply database reads (which would queue
 * ahead of control-room writes on local SQLite).
 */
export function sharedRevision(
  read: () => Promise<number>,
  maxAgeMs = 1000,
  now: () => number = Date.now,
) {
  let value: number | undefined;
  let fetchedAt = -Infinity;
  let pending: Promise<number> | undefined;
  return function revision(): Promise<number> {
    if (value !== undefined && now() - fetchedAt < maxAgeMs)
      return Promise.resolve(value);
    pending ??= read()
      .then((r) => {
        value = r;
        fetchedAt = now();
        return r;
      })
      .finally(() => {
        pending = undefined;
      });
    return pending;
  };
}
