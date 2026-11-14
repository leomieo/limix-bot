import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
import { extractSkillRequirements, findSkillBinary, findSkillNpmPackage, findSkillPythonPackage } from "./limix-skill-requirements.ts";

const temporary: string[] = [];
afterEach(() => { for (const root of temporary.splice(0)) rmSync(root, { recursive: true, force: true }); });
const folder = () => { const root = mkdtempSync(join(tmpdir(), "limix-skill-requirements-")); temporary.push(root); return root; };

it("reads structured requirements, compatibility and unknown requirements without dropping them", () => {
  const reqs = extractSkillRequirements('---\nname: video\nmetadata:\n  openclaw:\n    requires:\n      bins: [node, ffmpeg]\n      env: [VIDEO_API_KEY]\nrequires:\n  npm:\n    remotion: ^4.0.0\n  mcp: [browser]\n  gpu: NVIDIA\ncompatibility: Windows or Linux\n---\n');
  expect(reqs).toEqual(expect.arrayContaining([
    expect.objectContaining({ kind: "bin", name: "ffmpeg" }),
    expect.objectContaining({ kind: "npm", name: "remotion", required: "^4.0.0" }),
    expect.objectContaining({ kind: "env", name: "VIDEO_API_KEY" }),
    expect.objectContaining({ kind: "mcp", name: "browser" }),
    expect.objectContaining({ kind: "review", name: 'gpu: "NVIDIA"' }),
  ]));
});

it("recognizes Remotion and install commands while keeping setup text for review", () => {
  const reqs = extractSkillRequirements('# Prerequisites\nRequires a GPU.\nRun `npm install remotion @remotion/cli`\nThen `pip install pydantic>=2`\nUse `npx remotion render`.');
  expect(reqs).toEqual(expect.arrayContaining([
    expect.objectContaining({ kind: "npm", name: "remotion" }),
    expect.objectContaining({ kind: "npm", name: "@remotion/cli" }),
    expect.objectContaining({ kind: "python", name: "pydantic", required: ">=2" }),
    expect.objectContaining({ kind: "review", name: "Requires a GPU." }),
  ]));
  expect(reqs.filter((r) => r.kind === "npm").map((r) => r.name)).not.toContain("remotion.");
});

it("does not turn prose about pip or Vietnamese instructions into installable packages", () => {
  const requirements = extractSkillRequirements('Bạn cần pip install để cài thêm gói gì thì đọc hướng dẫn.\nMCP server cần cấu hình.\n```sh\npip install "rea-video[ocr] @ https://example.test/archive.zip"\n```');
  expect(requirements.some((row) => row.kind === "python")).toBe(false);
  expect(requirements).toContainEqual(expect.objectContaining({ kind: "review" }));
});

it("reports invalid metadata and never accepts a shell command as a binary path", () => {
  expect(extractSkillRequirements('---\nrequires: [broken\n---')).toContainEqual(expect.objectContaining({ kind: "review" }));
  expect(findSkillBinary("node; touch marker", [folder()])).toBeNull();
  expect(findSkillNpmPackage("../../secret", [folder()])).toBeNull();
});

it("finds scoped npm packages in a project without loading package code", () => {
  const root = folder();
  const pkg = join(root, "node_modules", "@remotion", "cli");
  mkdirSync(pkg, { recursive: true });
  writeFileSync(join(pkg, "package.json"), JSON.stringify({ name: "@remotion/cli", version: "4.0.0" }));
  writeFileSync(join(pkg, "index.js"), "throw Error('must not execute')");
  expect(findSkillNpmPackage("@remotion/cli", [join(root, "src")])).toMatchObject({ version: "4.0.0" });
  expect(findSkillNpmPackage("remotion", [root])).toBeNull();
});

it("finds Python dependencies inside a virtual environment using distribution metadata", () => {
  const root = folder();
  const metadata = join(root, ".venv", "Lib", "site-packages", "my_package-1.2.dist-info");
  mkdirSync(metadata, { recursive: true });
  writeFileSync(join(metadata, "METADATA"), "Name: my-package\nVersion: 1.2\n");
  expect(findSkillPythonPackage("my_package", [root])).toMatchObject({ version: "1.2" });
});

it("marks explicitly global npm CLI installs as app tools", () => {
  expect(extractSkillRequirements("npm install -g agent-desktop")).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "npm", name: "agent-desktop", installScope: "tool" })]));
});
