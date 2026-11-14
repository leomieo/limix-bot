/** Limix Bot module switches for the desktop main process. Keep in step with shared/limix-features.ts.
 * LIMIX_CLOUD_ENABLED: Limix Cloud is a hidden module until Limix runs its own cloud (limix/docs/MODULE_CLOUD.md). */
export const LIMIX_CLOUD_ENABLED = false;

/** Limix account server for the desktop sign-in gate (shared with Limix Studio; limix/docs/MODULE_ACCOUNT.md).
 * Empty turns the gate off. Each account may be signed in on at most N computers at once (set on the server). */
export const LIMIX_ACCOUNT_URL = "https://tiktok.limixmedia.com/api/limixbot";

/** LIMIX_ORGANIZATION_ENABLED: organization (company) sign-in needs Limix's own admin gateway (admin.limixbot.com), which
 * does not exist yet. While false the Settings → Organization block, the onboarding row and the Server-menu entry are
 * hidden (owner's choice 2026-11-12). The preload carries its own copy of this switch (it cannot import modules). */
export const LIMIX_ORGANIZATION_ENABLED = false;

/** Account data sync stays hidden until a Limix storage server is deployed and verified. */
export const LIMIX_ACCOUNT_SYNC_ENABLED = false;
