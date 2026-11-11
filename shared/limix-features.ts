/** Limix Bot module switches, read by the renderer and the server.
 * Limix Cloud is a hidden module until Limix runs its own cloud machines and Admin (limix/docs/MODULE_CLOUD.md):
 * while false, no Cloud plans, sign-in, Settings section or "add a Cloud" entry is offered. Keep in step with
 * electron/limix-features.mjs. */
export const LIMIX_CLOUD_ENABLED: boolean = false;

/** Limix has no phone app of its own yet (OpenMausBot's iPhone/Android apps are MausBot-branded and their source is not
 * published). While false the "Get the phone app" dialog, menu entry and App Store / APK codes are hidden. */
export const LIMIX_PHONE_APPS_ENABLED: boolean = false;
