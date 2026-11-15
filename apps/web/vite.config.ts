import babel from "@rolldown/plugin-babel";
import { createEnv } from "@t3-oss/env-core";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact, { reactCompilerPreset } from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig, loadEnv } from "vite";
import * as z from "zod";

const DEFAULT_PORT = 3000;

export default defineConfig(({ mode }) => {
  const convexDevEnv = loadEnv(mode, "../../packages/backend", "CONVEX_");
  const buildEnv = createEnv({
    server: {
      PORT: z.coerce.number().int().default(DEFAULT_PORT),
      VITE_CONVEX_URL: z.url(),
      VITE_CONVEX_SITE_URL: z.url(),
      VITE_SITE_URL: z.url().optional(),
    },
    runtimeEnv: {
      VITE_CONVEX_URL: convexDevEnv.CONVEX_URL,
      VITE_CONVEX_SITE_URL: convexDevEnv.CONVEX_SITE_URL,
      ...process.env,
    },
    emptyStringAsUndefined: true,
  });
  Object.assign(process.env, {
    VITE_CONVEX_URL: buildEnv.VITE_CONVEX_URL,
    VITE_CONVEX_SITE_URL: buildEnv.VITE_CONVEX_SITE_URL,
    VITE_SITE_URL:
      buildEnv.VITE_SITE_URL ?? `http://localhost:${buildEnv.PORT}`,
  });

  return {
    server: { port: buildEnv.PORT, strictPort: true },
    resolve: { tsconfigPaths: true },
    ssr: { noExternal: ["@convex-dev/better-auth"] },
    plugins: [
      tailwindcss(),
      tanstackStart(),
      nitro(),
      viteReact(),
      babel({ presets: [reactCompilerPreset()] }),
    ],
  };
});
