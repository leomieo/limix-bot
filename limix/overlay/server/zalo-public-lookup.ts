import { z } from "zod";
import { redactSecretsInText } from "../shared/redact.ts";
import { fetchPublicPage, pageText } from "./wait-probes.ts";

const WEATHER = /(?:thời tiết|nhiệt độ|weather|temperature)/iu;
const SEARCH = /\?|(?:tra cứu|tra giúp|tìm giúp|tìm trên web|là gì|ai là|ở đâu|khi nào|bao nhiêu|hôm nay|mới nhất|hiện nay)|\b(?:search|look up|what|where|when|who|latest|today)\b/iu;
const PLACE = /^[\p{L}\p{M} .,'’()-]{2,100}$/u;
const PRIVATE_QUERY = /https?:\/\/|\bBearer\s+[\w.-]+|\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b|(?<!\d)\+?\d(?:[ .()-]*\d){8,14}(?!\d)/iu;
const MAX_QUERY = 300;
const REQUEST = { maxRedirects: 0, timeoutMs: 4_000, maxBytes: 128 * 1024, userAgent: "LimixBot (https://limixmedia.com)" };
const NO_RESULTS = '{"status":"no_usable_results"}';
const ASK_PLACE = '{"status":"weather_location_required"}';
const geographicPages = z.object({ query: z.object({ pages: z.array(z.object({ title: z.string(), coordinates: z.array(z.object({
  lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180),
})).optional() })) }).optional() });
const forecast = z.object({ properties: z.object({ timeseries: z.array(z.object({ time: z.string(), data: z.object({
  instant: z.object({ details: z.object({ air_temperature: z.number() }) }),
}) })).min(1) }) });
const encyclopedia = z.object({ query: z.object({ search: z.array(z.object({ title: z.string(), pageid: z.number(), snippet: z.string() })) }).optional() });
const weatherCache = new Map<string, { expires: number; value: string }>();

function publicQuery(value: string): string | null {
  const query = value.trim().replace(/\s+/gu, " ");
  if (!query || query.length > MAX_QUERY || PRIVATE_QUERY.test(query) || redactSecretsInText(query) !== query) return null;
  return query;
}

function weatherPlace(query: string): string {
  return query.replace(/^(?:(?:xem|tra cứu|tra|kiểm tra|check)\s+)?(?:thời tiết|nhiệt độ|weather|temperature)\s*/iu, "")
    .replace(/(?:hôm nay|bây giờ|hiện tại|bao nhiêu(?: độ)?|today|now)(?=\s|[?!,.]|$)/giu, "")
    .replace(/^\s*(?:ở|tại|in|of)\s+/iu, "").replace(/[?!]+$/u, "").trim();
}

function samePlace(value: string): string {
  return value.normalize("NFD").replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
}

function wikipedia(lang: "vi" | "en", params: Record<string, string>): URL {
  const url = new URL(`https://${lang}.wikipedia.org/w/api.php`);
  url.search = new URLSearchParams({ action: "query", format: "json", formatversion: "2", ...params }).toString();
  return url;
}

async function currentTemperature(place: string): Promise<string> {
  if (!PLACE.test(place)) return ASK_PLACE;
  const key = samePlace(place);
  const cache = weatherCache.get(key);
  if (cache && cache.expires > Date.now()) return cache.value;
  const url = wikipedia("vi", { generator: "search", gsrsearch: place, gsrlimit: "6", prop: "coordinates" });
  const received = await fetchPublicPage(url.href, REQUEST);
  if (!received.ok) return NO_RESULTS;
  const parsed = geographicPages.safeParse(JSON.parse(received.body.toString("utf8")));
  const match = parsed.success && parsed.data.query?.pages.find(({ title, coordinates }) => samePlace(title) === key && coordinates?.length);
  if (!match) return ASK_PLACE;
  const point = match.coordinates![0]!;
  const weather = new URL("https://api.met.no/weatherapi/locationforecast/2.0/compact");
  weather.search = new URLSearchParams({ lat: point.lat.toFixed(4), lon: point.lon.toFixed(4) }).toString();
  const report = await fetchPublicPage(weather.href, REQUEST);
  if (!report.ok) return NO_RESULTS;
  const latest = forecast.safeParse(JSON.parse(report.body.toString("utf8")));
  if (!latest.success) return NO_RESULTS;
  const now = latest.data.properties.timeseries[0]!;
  const value = JSON.stringify({ place: match.title, temperatureC: now.data.instant.details.air_temperature,
    forecastTime: now.time, source: "https://www.met.no/en", locationSource: `https://vi.wikipedia.org/wiki/${encodeURIComponent(match.title.replaceAll(" ", "_"))}` });
  const expires = Date.parse(String(report.headers.expires ?? ""));
  if (expires > Date.now()) {
    if (weatherCache.size >= 128) weatherCache.delete(weatherCache.keys().next().value!);
    weatherCache.set(key, { expires, value });
  }
  return value;
}

async function searchWeb(query: string): Promise<string> {
  const lang = /[\p{M}đĐ]/u.test(query.normalize("NFD")) ? "vi" : "en";
  const topic = query.replace(/^(?:tra cứu|tra giúp|tìm giúp|search for|look up)\s+/iu, "")
    .replace(/\s+là gì[?!.]*$/iu, "").replace(/^what is\s+/iu, "").replace(/[?!.]+$/u, "");
  if (!topic) return NO_RESULTS;
  const url = wikipedia(lang, { list: "search", srsearch: topic, srlimit: "5" });
  const page = await fetchPublicPage(url.href, REQUEST);
  if (!page.ok) return NO_RESULTS;
  const report = encyclopedia.safeParse(JSON.parse(page.body.toString("utf8")));
  const results = report.success ? report.data.query?.search.slice(0, 5).map((entry) => ({
    title: entry.title.slice(0, 160), summary: pageText(entry.snippet).replace(/\s+([,.!?;:])/gu, "$1").slice(0, 360),
    url: `https://${lang}.wikipedia.org/?curid=${entry.pageid}`,
  })) ?? [] : [];
  return results.length ? JSON.stringify(results) : NO_RESULTS;
}

export async function zaloPublicLookup(text: string, previousGuestText?: string): Promise<string | undefined> {
  const query = publicQuery(text);
  if (!query) return undefined;
  try {
    if (WEATHER.test(query) && !/(?:ngày mai|tomorrow|tuần sau|next week)/iu.test(query)) return await currentTemperature(weatherPlace(query));
    if (previousGuestText && WEATHER.test(previousGuestText) && !SEARCH.test(query) && PLACE.test(query)) return await currentTemperature(query);
    if (SEARCH.test(query)) return await searchWeb(query);
  } catch { return NO_RESULTS; }
  return undefined;
}
