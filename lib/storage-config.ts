/** Local storage is supported only on a persistent, single-host filesystem. */
export class StorageConfigurationError extends Error {
  constructor() {
    super(
      "Persistent storage is not configured: Vercel cannot use local SQLite or local media. Configure an approved shared database and object storage adapter before deployment. DATABASE_PATH (including /tmp) cannot enable local storage on Vercel.",
    );
    this.name = "StorageConfigurationError";
  }
}

export function assertLocalStorageAllowed(
  env: Record<string, string | undefined> = process.env,
) {
  if (isVercel(env))
    throw new StorageConfigurationError();
}

export function isVercel(env: Record<string, string | undefined> = process.env) {
  return env.VERCEL === "1" || Boolean(env.VERCEL_ENV || env.VERCEL_TARGET_ENV);
}
