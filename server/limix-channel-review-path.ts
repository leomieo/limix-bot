/** Routes that can return unfiltered conversation archives, search results or activity. */
export function channelReviewSensitivePath(path: string): boolean {
  if (path.startsWith("/api/limix/bots") && (path === "/api/limix/bots" || path.startsWith("/api/limix/bots/"))) return false;
  return /(?:^|\/)(?:workspace-backup|backup|export|session-search|search|admin-activity(?:\.csv)?|activity|logs)(?:\/|$)/.test(path);
}
