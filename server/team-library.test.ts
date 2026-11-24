import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

import {
  TEAM_LIBRARY_CATALOG_URL,
  TEAM_LIBRARY_RAW_ROOT,
  fetchGithubTeam,
  fetchTeamCatalog,
  fetchLibraryTeam,
  githubManifestUrls,
  libraryTeamRoles,
  parseTeamCatalog,
} from "./team-library.ts";
import { industryTeamCatalog } from "./industry-teams.ts";
import { INDUSTRY_PROFILES } from "../shared/industry-profiles.ts";

const manifest = {
  format: "openmaus.team",
  version: 2,
  team: {
    name: "Engineering",
    members: [
      {
        key: "lead",
        name: "Ada",
        title: "Tech Lead",
        description: "Coordinates the work",
        appearance: { color: "purple" },
      },
    ],
  },
};

const catalog = {
  format: "openmaus.catalog",
  version: 1,
  teams: [
    {
      slug: "engineering",
      name: "Engineering Team",
      summary: "Plan and ship software.",
      category: "Engineering",
      manifest: "teams/engineering/team.limixteam.json",
      readme: "teams/engineering/README.md",
      members: 1,
      skills: ["teams/engineering/skills/release/SKILL.md"],
      requires: { apps: ["GitHub"] },
    },
  ],
};

function response(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("team library", () => {
  it("serves all ten industry teams offline and reserves their slugs when the community is online", async () => {
    const offline = vi.fn(async () => response({}, 503)) as unknown as typeof fetch;
    const bundled = await fetchTeamCatalog(offline);
    expect(bundled.communityAvailable).toBe(false);
    expect(bundled.teams).toHaveLength(10);
    for (const profile of INDUSTRY_PROFILES) {
      const slug = `industry-${profile.slug}`;
      const entry = bundled.teams.find((item) => item.slug === slug);
      expect(entry).toMatchObject({ members: 4, builtIn: true, skills: ["industry-customer-care"] });
      const doc = await fetchLibraryTeam(slug, offline);
      if (doc.format !== "openmaus.package" || doc.version !== 2) throw new Error("Expected a v2 industry package");
      const pkg = doc.package;
      expect(pkg.agents.map((a) => a.key)).toEqual(["care", ...profile.roles.map((role) => role.slug)]);
      expect(pkg.rooms?.[0]).toMatchObject({ members: pkg.agents.map((a) => a.key), defaultResponder: { kind: "agent", agent: "care" } });
      expect(pkg.team?.leader).toBeUndefined();
    }
    expect(offline).toHaveBeenCalledTimes(1);
    const slug = bundled.teams[0]!.slug;
    const impostor = { ...catalog.teams[0], slug, skills: [], manifest: `teams/${slug}/team.mausteam.json`, readme: `teams/${slug}/README.md` };
    const online = await fetchTeamCatalog(async () => response({ ...catalog, teams: [impostor, ...catalog.teams] }));
    expect(online.teams.filter((team) => team.slug === slug)).toEqual([bundled.teams[0]]);
    expect(online.teams.at(-1)?.slug).toBe("engineering");
  });
  it("validates catalog paths and adds the trusted repository URL", () => {
    const parsed = parseTeamCatalog(catalog);
    expect(parsed.repositoryUrl).toBe("https://github.com/leomieo/limix-bot-teams");
    expect(parsed.teams[0]).toMatchObject({ slug: "engineering", members: 1 });

    const unsafe = structuredClone(catalog);
    unsafe.teams[0]!.manifest = "../private.json";
    expect(() => parseTeamCatalog(unsafe)).toThrow("safe catalog path");
  });

  it("loads only the manifest selected by the trusted catalog", async () => {
    const fetcher = vi.fn(async (url: string | URL | Request) => {
      const target = String(url);
      if (target === TEAM_LIBRARY_CATALOG_URL) return response(catalog);
      if (target === `${TEAM_LIBRARY_RAW_ROOT}/teams/engineering/team.limixteam.json`) return response(manifest);
      return response({}, 404);
    }) as unknown as typeof fetch;

    const loaded = await fetchLibraryTeam("engineering", fetcher);
    if (loaded.format !== "openmaus.team") throw new Error("expected a legacy team");
    expect(loaded.team.name).toBe("Engineering");
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("normalizes public GitHub repository, blob, and raw links", () => {
    expect(githubManifestUrls("https://github.com/acme/team")).toEqual([
      "https://raw.githubusercontent.com/acme/team/main/botmrr.md",
      "https://raw.githubusercontent.com/acme/team/main/team.md",
      "https://raw.githubusercontent.com/acme/team/main/team.limixteam.json",
      "https://raw.githubusercontent.com/acme/team/main/team.mausteam.json",
      "https://raw.githubusercontent.com/acme/team/master/botmrr.md",
      "https://raw.githubusercontent.com/acme/team/master/team.md",
      "https://raw.githubusercontent.com/acme/team/master/team.limixteam.json",
      "https://raw.githubusercontent.com/acme/team/master/team.mausteam.json",
    ]);
    expect(githubManifestUrls("https://github.com/acme/team/blob/main/presets/seo.mausteam.json")).toEqual([
      "https://raw.githubusercontent.com/acme/team/main/presets/seo.mausteam.json",
    ]);
    expect(githubManifestUrls("https://raw.githubusercontent.com/acme/team/main/team.mausteam.json")).toEqual([
      "https://raw.githubusercontent.com/acme/team/main/team.mausteam.json",
    ]);
    expect(() => githubManifestUrls("http://example.com/team.json")).toThrow("public HTTPS GitHub");
    expect(() => githubManifestUrls("https://github.com/acme/team/blob/main/run.sh")).toThrow("Markdown playbook");
  });

  it("falls back from main to master for a repository link", async () => {
    const fetcher = vi.fn(async (url: string | URL | Request) =>
      String(url).endsWith("team.mausteam.json") && String(url).includes("/master/")
        ? response(manifest)
        : response({}, 404),
    ) as unknown as typeof fetch;

    const loaded = await fetchGithubTeam("https://github.com/acme/team", fetcher);
    if (loaded.format !== "openmaus.team") throw new Error("expected a legacy team");
    expect(loaded.team.members[0]?.name).toBe("Ada");
    expect(fetcher).toHaveBeenCalledTimes(8);
  });

  it("loads a shared team file (package v2) from GitHub as a file, without its claimed publisher", async () => {
    const shared = JSON.parse(readFileSync(join(import.meta.dirname, "..", "shared", "package-fixtures", "full-team.v2.json"), "utf8"));
    const fetcher = vi.fn(async () => response(shared)) as unknown as typeof fetch;
    const loaded = await fetchGithubTeam("https://github.com/acme/team/blob/main/sales-desk-1.3.0.openmaus.json", fetcher);
    if (loaded.format !== "openmaus.package" || loaded.version !== 2) throw new Error("expected a shared team");
    expect(loaded.package.team?.name).toBe("Sales desk");
    expect(loaded.package.publisher).toBeUndefined();
  });
});

describe("the team library as a Chief of Staff reads it", () => {
  const entry = (slug: string, name: string, summary: string, file: { package?: string }) => ({
    ...catalog.teams[0]!, slug, name, summary, ...file,
    manifest: `teams/${slug}/team.mausteam.json`, readme: `teams/${slug}/README.md`, members: 2, skills: [],
  });
  const fixture = (name: string) => readFileSync(join(import.meta.dirname, "..", "shared", "package-fixtures", name), "utf8");
  const long = { ...manifest, team: { ...manifest.team, members: [{ ...manifest.team.members[0]!, description: `Plans the work.\n\n${"Checks every step. ".repeat(30)}` }] } };
  const library = {
    ...catalog,
    teams: [
      catalog.teams[0]!,
      entry("signal-desk", "Signal Desk", "Find and explain the signal.", { package: "packages/signal-desk.md" }),
      entry("sales-desk", "Sales Desk", "Sell the team plan.", {}),
      entry("gone", "Gone", "Its file is missing.", {}),
      entry("long", "Long", "One very long role.", {}),
    ],
  };
  const fetcher = vi.fn(async (url: string | URL | Request) => {
    const target = String(url).slice(TEAM_LIBRARY_RAW_ROOT.length + 1);
    if (String(url) === TEAM_LIBRARY_CATALOG_URL) return response(library);
    if (target === "teams/engineering/team.limixteam.json") return response(manifest);
    if (target === "packages/signal-desk.md") return new Response(fixture("legacy-botmrr.v1.md"));
    if (target === "teams/sales-desk/team.mausteam.json") return new Response(fixture("full-team.v2.json"));
    if (target === "teams/long/team.mausteam.json") return response(long);
    return response({}, 404);
  }) as unknown as typeof fetch;

  it("lists every ready-made team with its summary and roles, marks the team's own lead, and keeps a team whose file is missing", async () => {
    const all = await libraryTeamRoles(fetcher);
    const teams = all.slice(industryTeamCatalog.length);
    expect(teams.slice(0, 4)).toEqual([
      { name: "Engineering Team", summary: "Plan and ship software.", roles: [{ name: "Ada", title: "Tech Lead", does: "Coordinates the work" }] },
      { name: "Signal Desk", summary: "Find and explain the signal.", roles: [
        { name: "Package Scout", title: "Researcher", does: "Find evidence.", lead: true },
        { name: "Package Editor", title: "Editor", does: "Explain the result." },
      ] },
      { name: "Sales Desk", summary: "Sell the team plan.", roles: [
        { name: "Morgan", title: "Sales lead", does: "Owns the pipeline and the final answer.", lead: true },
        { name: "Scout", title: "Prospect researcher", does: "Finds and qualifies prospects." },
        { name: "Quill", title: "Outreach writer", does: "Drafts outreach for approval." },
      ] },
      { name: "Gone", summary: "Its file is missing.", roles: [] },
    ]);
    const does = teams[4]!.roles[0]!.does!;
    expect(does.startsWith("Plans the work. Checks every step.")).toBe(true);
    expect(does.length).toBe(280);
    expect(does.endsWith("…")).toBe(true);
  });

  it("retains the built-in roles when the remote catalog can't be read", async () => {
    const teams = await libraryTeamRoles(async () => response({}, 503));
    expect(teams.map((team) => team.name)).toEqual(industryTeamCatalog.map((team) => team.name));
    expect(teams.every((team) => team.roles.length === 4)).toBe(true);
  });
});
