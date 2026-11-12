import { activeLocale } from "@/lib/i18n";

/** Limix Bot's own screens: Vietnamese when the app is in Vietnamese, English in every other language. Works for
 * strings and for JSX alike: lx("Cài", "Install"), lx(<>…</>, <>…</>). */
export function lx<T>(vi: T, en: T): T {
  return activeLocale().toLowerCase().startsWith("vi") ? vi : en;
}
