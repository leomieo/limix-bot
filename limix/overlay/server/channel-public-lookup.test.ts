import { beforeEach, expect, it, vi } from "vitest";
import { fetchPublicPage } from "./wait-probes.ts";
import { channelPublicLookup as lookup } from "./channel-public-lookup.ts";

vi.mock("./wait-probes.ts", { spy: true });
const fetchPage = vi.mocked(fetchPublicPage);
beforeEach(() => { fetchPage.mockReset(); });

function page(url: URL, body: unknown) {
  return { ok: true as const, url, headers: {}, body: Buffer.from(typeof body === "string" ? body : JSON.stringify(body)) };
}

it("finds current weather after a guest adds their location and asks in ambiguous cases", async () => {
  fetchPage.mockImplementation(async (address, options) => {
    const url = new URL(address);
    expect(options?.maxRedirects).toBe(0);
    if (url.hostname === "vi.wikipedia.org") {
      expect(url.searchParams.get("gsrsearch")).toMatch(/^Gia Lâm(?:, Hà Nội)?$/u);
      return page(url, { query: { pages: [
        { title: "Gia Lâm, Hà Nội", coordinates: [{ lat: 21.03, lon: 105.94 }] },
        { title: "Gia Lâm, Bắc Ninh", coordinates: [{ lat: 21.31, lon: 106.13 }] },
      ] } });
    }
    expect(url.hostname).toBe("api.met.no");
    expect(url.searchParams.get("lat")).toBe("21.0300");
    return page(url, { properties: { timeseries: [{ time: "2026-11-19T11:30:00Z", data: { instant: { details: { air_temperature: 24.2 } } } }] } });
  });
  const missing = '{"status":"weather_location_required"}';
  expect(await lookup("nhiệt độ hôm nay")).toBe(missing);
  expect(await lookup("nhiệt độ hôm nay bao nhiêu?")).toBe(missing);
  expect(fetchPage).not.toHaveBeenCalled();
  expect(await lookup("nhiệt độ ở Gia Lâm bây giờ?")).toBe(missing);
  const result = await lookup("Gia Lâm, Hà Nội", "nhiệt độ hôm nay");
  expect(JSON.parse(result!)).toMatchObject({ place: "Gia Lâm, Hà Nội", temperatureC: 24.2, forecastTime: "2026-11-19T11:30:00Z", source: "https://www.met.no/en" });
});

it("looks up basic questions on a fixed public endpoint and derives the source link", async () => {
  fetchPage.mockImplementation(async (address) => {
    const url = new URL(address);
    expect(url.origin).toBe("https://vi.wikipedia.org");
    expect(url.searchParams.get("srsearch")).toBe("Quang hợp");
    return page(url, { query: { search: [{ title: "Quang hợp", pageid: 3, snippet: "Cây sử dụng <strong>ánh sáng</strong>." }] } });
  });
  expect(JSON.parse((await lookup("Quang hợp là gì?"))!)).toEqual([
    { title: "Quang hợp", summary: "Cây sử dụng ánh sáng.", url: "https://vi.wikipedia.org/?curid=3" },
  ]);
  expect(await lookup("hi")).toBeUndefined();
  expect(await lookup("Tra giúp https://example.test/private")).toBeUndefined();
  expect(await lookup("Tra giúp Bearer sample-private-fixture")).toBeUndefined();
  expect(await lookup("Tra giúp user@example.test")).toBeUndefined();
  expect(await lookup("Tra giúp 090 123 4567")).toBeUndefined();
  expect(fetchPage).toHaveBeenCalledTimes(1);
});
