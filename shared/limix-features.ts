/** Limix Bot module switches, read by the renderer and the server. Keep in step with electron/limix-features.mjs.
 * LIMIX_CLOUD_ENABLED: Limix Cloud runs on the operator's own machine with Limix's own Admin at cloud.limixmedia.com
 * (limix/docs/HANDOFF_CLOUD_NATIVE.md): the Settings section, My Cloud and moving bots there are offered.
 * LIMIX_CLOUD_SALES: nothing is sold yet (owner's choice 2026-11-16: a trial is asked for and approved by hand), so no
 * plan, checkout, "add a Cloud" or upgrade entry is offered while false. */
export const LIMIX_CLOUD_ENABLED: boolean = true;
export const LIMIX_CLOUD_SALES: boolean = false;

/** Limix has no phone app of its own yet (OpenMausBot's iPhone/Android apps are MausBot-branded and their source is not
 * published). While false the "Get the phone app" dialog, menu entry and App Store / APK codes are hidden. */
export const LIMIX_PHONE_APPS_ENABLED: boolean = false;

/** Account data sync stays hidden until a Limix storage server is deployed and verified. */
export const LIMIX_ACCOUNT_SYNC_ENABLED: boolean = false;
