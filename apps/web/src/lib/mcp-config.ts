export function mcpEndpoint(convexSiteUrl: string) {
  return new URL("/mcp", convexSiteUrl).href;
}

export function claudeCodeCommand(endpoint: string, apiKey: string) {
  return `claude mcp add --transport http schnellbuch ${endpoint} --header "Authorization: Bearer ${apiKey}"`;
}
