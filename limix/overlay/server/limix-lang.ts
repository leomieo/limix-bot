// Limix Bot's own server messages: Vietnamese when the app's language is Vietnamese, English otherwise.
export const lxs = (vi: string, en: string): string => (/^vi/i.test(process.env.OMB_UI_LANGUAGE?.trim() ?? "") ? vi : en);
