export function dockerInvocation(args, env = process.env) {
  const distro = env.LIMIX_DOCKER_WSL_DISTRO;
  if (!distro) return { file: "docker", args, env: { ...env, LIMIX_BETA_HOST_TOKEN: undefined } };
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(distro)) throw new Error("Invalid WSL distribution");
  const mapped = args.map((arg, index) => {
    if (index > 0 && args[index - 1] === "-f" && /^[A-Za-z]:[\\/]/.test(arg)) {
      return "/mnt/" + arg[0].toLowerCase() + arg.slice(2).replaceAll("\\", "/");
    }
    return arg;
  });
  const names = ["LIMIX_DESKTOP_TOKEN", "LIMIX_DESKTOP_IMAGE", "LIMIX_HOME_IMAGE", "LIMIX_HOME_ID", "LIMIX_HOME_ORIGIN", "LIMIX_HOME_SECRET", "LIMIX_HOME_GATEWAY", "LIMIX_HOME_CPUS", "LIMIX_HOME_MEMORY_GB", "LIMIX_PROBE_SECRET", "LIMIX_PROBE_HOST", "LIMIX_WAKE_HOST_TOKEN", "LIMIX_WAKE_SUFFIX", "TUNNEL_TOKEN"];
  const forwarded = (env.WSLENV || "").split(":").filter(x => x && x.split("/")[0] !== "LIMIX_BETA_HOST_TOKEN");
  return { file: "wsl.exe", args: ["--distribution", distro, "--user", "root", "--exec", "docker", ...mapped],
    env: { ...env, LIMIX_BETA_HOST_TOKEN: undefined, WSLENV: [...forwarded, ...names.map(n => n + "/u")].join(":") } };
}
