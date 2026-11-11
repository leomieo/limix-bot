/** Limix Bot module switches for the desktop main process. Keep in step with shared/limix-features.ts.
 * LIMIX_CLOUD_ENABLED: Limix Cloud is a hidden module until Limix runs its own cloud (limix/docs/MODULE_CLOUD.md). */
export const LIMIX_CLOUD_ENABLED = false;

/** Limix account server for the desktop sign-in gate (shared with Limix Studio; limix/docs/MODULE_ACCOUNT.md).
 * Empty turns the gate off. Each account may be signed in on at most N computers at once (set on the server). */
export const LIMIX_ACCOUNT_URL = "https://tiktok.limixmedia.com/api/limixbot";
