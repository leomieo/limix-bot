import { managedHostTunnel } from "./managed-host";
import { managedWorkspaceOpen } from "./managed-workspace";

export function managedCloudRoute(path: string, request: Request, env: Env): Promise<Response> | null {
  if (path === "/v1/managed-cloud/host/tunnel") return managedHostTunnel(request, env);
  if (path === "/v1/managed-cloud/workspace/open") return managedWorkspaceOpen(request, env);
  return null;
}
