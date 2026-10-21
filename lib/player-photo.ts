const FIBA_COMPETITION_ID = 209161;

/**
 * FIBA's official tournament headshot for a player synced from its roster (`fiba-player-<id>`). FIBA answers 404 for
 * players it has no picture of; the page then keeps showing its blank silhouette. Served from the host the site's
 * image policy already allows for team logos.
 */
export function fibaHeadshot(player: { id: string; photo?: string }, size = 400): string | undefined {
  if (player.photo) return player.photo;
  const personId = player.id.match(/^fiba-player-(\d+)$/)?.[1];
  if (!personId) return undefined;
  return (
    "https://assets.fiba.basketball/image/upload/w_2800/c_pad,ar_12:10/c_pad,ar_10:12/ar_10:12,c_crop,g_face,z_0.25/e_trim/c_lpad,ar_1:1/w_2800/w_2200,h_2000,c_crop,x_300/" +
    `w_${size},h_${size},c_fill,g_north/q_auto/f_auto/.headshot--person_${personId}--competition_${FIBA_COMPETITION_ID}`
  );
}
