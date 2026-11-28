import { execFileSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { executableTarget } from "./prepare-cloudflared.mjs";

const root = fileURLToPath(new URL("../", import.meta.url));
const buildDir = join(root, "dist-native", "limix-native-build");
const targets = {
  "win32-x64": "x86_64-pc-windows-msvc",
  "linux-x64": "x86_64-unknown-linux-musl",
  "darwin-arm64": "aarch64-apple-darwin",
  "darwin-x64": "x86_64-apple-darwin",
};
const wasmTarget = "wasm32-unknown-unknown";
const wasmFile = "limix_tool_gateway.wasm";
const args = process.argv.slice(2);
const host = process.platform + "-" + process.arch;
const selected = args.length === 2 && args[0] === "--target" ? [args[1]]
  : args.length === 1 && args[0] === "--current" ? [host]
  : !args.length ? (process.platform === "darwin" ? ["darwin-arm64", "darwin-x64"] : [host]) : [];
if (!selected.length || selected.some(name => !Object.hasOwn(targets, name))) {
  throw new Error("Expected a supported desktop target or --current");
}

function run(file, argv, env = process.env) {
  execFileSync(file, argv, { cwd: root, stdio: "inherit", windowsHide: true, env });
}

function build(crate, triple, env = process.env) {
  const manifest = join(root, "native", crate, "Cargo.toml");
  run("cargo", ["build", "--release", "--locked", "--manifest-path", manifest, "--target", triple, "--target-dir", buildDir], env);
  const data = execFileSync("cargo", ["metadata", "--format-version=1", "--locked", "--filter-platform", triple, "--manifest-path", manifest], {
    cwd: root, encoding: "utf8", maxBuffer: 16 * 1024 * 1024, windowsHide: true, env,
  });
  const metadata = JSON.parse(data);
  const nodes = new Map(metadata.resolve.nodes.map(node => [node.id, node]));
  const linked = new Set();
  function visit(id) {
    if (linked.has(id)) return;
    linked.add(id);
    for (const dep of nodes.get(id).deps) if (dep.dep_kinds.some(kind => kind.kind === null)) visit(dep.pkg);
  }
  visit(metadata.resolve.root);
  return metadata.packages.filter(pkg => pkg.source && linked.has(pkg.id));
}

function notices(pkgs) {
  const sections = [];
  for (const pkg of [...new Map(pkgs.map(pkg => [pkg.id, pkg])).values()].sort((a, b) => a.id.localeCompare(b.id))) {
    const dir = dirname(pkg.manifest_path);
    const files = new Set(readdirSync(dir).filter(name => /^(?:LICEN[CS]E|COPYING|NOTICE|UNLICENSE)(?:[-._].*)?$/i.test(name)));
    if (pkg.license_file) files.add(pkg.license_file);
    if (!files.size) throw new Error("Missing license text for " + pkg.id);
    for (const name of [...files].sort()) {
      sections.push(pkg.name + " " + pkg.version + " (" + name + ")\n" + readFileSync(join(dir, name), "utf8"));
    }
  }
  return sections.join("\n\n");
}

run("rustup", ["target", "add", wasmTarget, ...selected.map(name => targets[name])]);
const wasmNotices = build("tool-gateway", wasmTarget);
const wasmPath = join(buildDir, wasmTarget, "release", wasmFile);
new WebAssembly.Module(readFileSync(wasmPath));
const sysroot = execFileSync("rustc", ["--print", "sysroot"], { encoding: "utf8" }).trim();
for (const name of selected) {
  const triple = targets[name];
  const env = { ...process.env };
  if (name.startsWith("darwin") && process.platform === "darwin") {
    env.SDKROOT ??= execFileSync("xcrun", ["--sdk", "macosx", "--show-sdk-path"], { encoding: "utf8" }).trim();
  }
  if (name === "linux-x64" && process.platform !== "linux") {
    const hostTriple = /^host: (.+)$/m.exec(execFileSync("rustc", ["-vV"], { encoding: "utf8" }))[1].trim();
    env.CARGO_TARGET_X86_64_UNKNOWN_LINUX_MUSL_LINKER = join(sysroot, "lib", "rustlib", hostTriple, "bin", process.platform === "win32" ? "rust-lld.exe" : "rust-lld");
  }
  const samplerNotices = build("process-sampler", triple, env);
  const exe = "limix-process-sampler" + (name.startsWith("win32-") ? ".exe" : "");
  const sampler = join(buildDir, triple, "release", exe);
  if (executableTarget(readFileSync(sampler)) !== name) throw new Error("Wrong process sampler architecture for " + name);
  const stage = join(root, "dist-native", "limix-native", name);
  mkdirSync(stage, { recursive: true });
  copyFileSync(sampler, join(stage, exe));
  chmodSync(join(stage, exe), 0o755);
  copyFileSync(wasmPath, join(stage, wasmFile));
  writeFileSync(join(stage, "THIRD-PARTY-NOTICES.txt"), notices([...samplerNotices, ...wasmNotices]));
  const stdlib = join(sysroot, "share", "doc", "rust", "COPYRIGHT-library.html");
  if (!existsSync(stdlib)) throw new Error("Missing Rust standard library copyright notices in " + sysroot);
  copyFileSync(stdlib, join(stage, basename(stdlib)));
  console.log("Staged Limix Bot native resources for " + name);
}
