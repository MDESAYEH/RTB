export function securityPolicy(nonce?: string, development = false) {
  const scripts = nonce ? `'self' 'nonce-${nonce}' 'strict-dynamic'` : "'self'";
  return `default-src 'self'; script-src ${scripts}${development ? " 'unsafe-eval'" : ""}; style-src 'self' 'unsafe-inline'; img-src 'self' data: https://assets.fiba.basketball; connect-src 'self'${development ? " ws: wss:" : ""} https://blob.vercel-storage.com https://*.blob.vercel-storage.com; font-src 'self'; object-src 'none'; frame-src https://*.facebook.com https://www.youtube-nocookie.com; frame-ancestors 'none'; base-uri 'self'; form-action 'self'${development ? "" : "; upgrade-insecure-requests"}`;
}
