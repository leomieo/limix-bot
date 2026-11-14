import { XINGCHI_URL } from "../../shared/xingchi.ts";

/** A Responses endpoint used by an isolated Codex instance. */
export interface CodexEndpointConfig {
  url: string;
  models: string[];
  profile?: "xingchi";
}

export function decodeRoutedCodexConfig(raw: object, label = "Company"): CodexEndpointConfig {
  const value = raw as { profile?: unknown; url?: unknown; models?: unknown };
  if (typeof value.url !== "string" || !Array.isArray(value.models) || !value.models.length || value.models.some(model => typeof model !== "string" || !/^[\w][\w./+-]*$/.test(model))) {
    throw new Error(`Invalid ${label} Codex configuration.`);
  }
  const url = new URL(value.url);
  // Plain HTTP leaks the API key; allow it only on loopback.
  const loopback = url.hostname === "localhost" || url.hostname === "[::1]" || /^127(?:\.\d{1,3}){3}$/.test(url.hostname);
  if (url.username || url.password || url.search || url.hash || (url.protocol !== "https:" && !(url.protocol === "http:" && loopback))) throw new Error(`Invalid ${label} Codex endpoint.`);
  if (value.profile !== undefined && (value.profile !== "xingchi" || url.href.replace(/\/$/, "") !== XINGCHI_URL)) throw new Error("Invalid Xingchi endpoint.");
  return { ...(value.profile === "xingchi" ? { profile: "xingchi" as const } : {}), url: url.href.replace(/\/$/, ""), models: value.models as string[] };
}

export function managedCodexArgs(config: CodexEndpointConfig): string[] {
  return providerCodexArgs(config.url, "openmaus_company", "Company", "OPENMAUSBOT_COMPANY_API_KEY");
}

export function endpointCodexArgs(config: CodexEndpointConfig): string[] {
  return [...providerCodexArgs(config.url, "openmaus_endpoint", "Direct API", "OPENMAUSBOT_CODEX_API_KEY"),
    "-c", "model_providers.openmaus_endpoint.supports_websockets=false",
    "-c", "features.tool_search=false",
    ...(config.profile === "xingchi" ? [
      "-c", 'model_providers.openmaus_endpoint.http_headers={ "x-openai-actor-authorization" = "local-image-extension" }',
      "-c", 'model_providers.openmaus_endpoint.model_catalog_url="' + XINGCHI_URL + '/models"',
      "-c", 'review_model="gpt-6.1-sol"', "-c", 'web_search="live"',
      "-c", "disable_response_storage=true", "-c", "features.api_key_model_discovery=true",
      "-c", "features.goals=true",
      // Image requests go through the metered Limix tool on this same endpoint.
      "-c", "features.image_generation=false",
    ] : [])];
}

function providerCodexArgs(url: string, provider: string, name: string, key: string): string[] {
  return [
    "-c", `model_provider=${JSON.stringify(provider)}`,
    "-c", `model_providers.${provider}.name=${JSON.stringify(name)}`,
    "-c", `model_providers.${provider}.base_url=${JSON.stringify(url)}`,
    "-c", `model_providers.${provider}.env_key=${JSON.stringify(key)}`,
    "-c", `model_providers.${provider}.wire_api="responses"`,
    "-c", `model_providers.${provider}.requires_openai_auth=false`,
    "-c", 'cli_auth_credentials_store="ephemeral"',
    "-c", "shell_environment_policy.ignore_default_excludes=false",
  ];
}

