// Limix Bot: the Python 3.12 and uv shipped with the Windows app (resources/limix-runtime) for the default skills
// (limix/skills). Bots find `python`, `python3`, `uv` and the tools they install through OMB_EXTRA_PATH, which
// server/env-path.ts puts in front of every agent CLI's PATH. Tools go to userData, so they survive app updates and
// need no administrator rights.
import fs from "node:fs";
import path from "node:path";

export function limixRuntimeEnv({ resourcesPath, userData, env = process.env, exists = fs.existsSync }) {
  const root = path.join(resourcesPath, "limix-runtime");
  const python = path.join(root, "python");
  const pythonExe = path.join(python, process.platform === "win32" ? "python.exe" : "bin/python3");
  if (!exists(pythonExe)) return {};
  const tools = path.join(userData, "limix-tools");
  const userBase = path.join(tools, "python-user");
  const dirs = [
    python,
    path.join(python, "Scripts"),
    path.join(root, "uv"),
    path.join(tools, "bin"),
    path.join(userBase, "Python312", "Scripts"),
  ];
  return {
    OMB_EXTRA_PATH: [...dirs, env.OMB_EXTRA_PATH].filter(Boolean).join(path.delimiter),
    LIMIX_PYTHON: pythonExe,
    UV_PYTHON: pythonExe,
    UV_TOOL_DIR: path.join(tools, "uv-tools"),
    UV_TOOL_BIN_DIR: path.join(tools, "bin"),
    UV_CACHE_DIR: path.join(tools, "uv-cache"),
    PYTHONUSERBASE: userBase,
    PYTHONUTF8: "1",
  };
}
