import path from "node:path";

export function macDockerDownload(arch) {
  if (!["arm64", "x64"].includes(arch)) throw new Error("Unsupported Mac architecture");
  return `https://desktop.docker.com/mac/main/${arch === "arm64" ? "arm64" : "amd64"}/Docker.dmg`;
}

export function macDockerLocations(home) {
  return ["/Applications/Docker.app/Contents/Resources/bin/docker", path.join(home, "Applications/Docker.app/Contents/Resources/bin/docker"), path.join(home, ".docker/bin/docker")];
}

export async function openMacDockerInstaller({ arch, download, rename, run, tools }) {
  const partial = await download("docker", macDockerDownload(arch));
  const dmg = path.join(tools, `Docker-${arch}.dmg`);
  await rename(partial, dmg);
  await run("/usr/bin/hdiutil", ["verify", dmg]);
  await run("/usr/bin/open", [dmg]);
  return dmg;
}
