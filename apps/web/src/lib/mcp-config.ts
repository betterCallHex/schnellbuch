export function mcpEndpoint(convexSiteUrl: string) {
  return new URL("/mcp", convexSiteUrl).href;
}

export function claudeCodeCommand(endpoint: string, token: string) {
  return `claude mcp add --transport http schnellbuch ${endpoint} --header "Authorization: Bearer ${token}"`;
}

export function mcpJsonConfig(endpoint: string, token: string) {
  return JSON.stringify(
    {
      mcpServers: {
        schnellbuch: {
          type: "http",
          url: endpoint,
          headers: { Authorization: `Bearer ${token}` },
        },
      },
    },
    null,
    2
  );
}
