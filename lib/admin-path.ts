/**
 * Public URL path of the admin area. "/admin" no longer exists; only this path serves the sign-in screen.
 * Override per deployment with ADMIN_PATH (letters, digits, - and _ only).
 */
const configured = process.env.ADMIN_PATH?.replace(/^\/+|\/+$/g, "");
export const ADMIN_PATH =
  configured && /^[A-Za-z0-9_-]{4,64}$/.test(configured)
    ? configured
    : "RTBadmin27";
