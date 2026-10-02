// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import path from "node:path";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // @ts-ignore
  nitro: {
    noExternals: true,
  },
  vite: {
    ssr: {
      noExternal: true,
    },
    resolve: {
      alias: [
        { find: /^tslib$/, replacement: path.resolve(__dirname, "src/lib/tslib-shim.ts") },
        {
          find: "lucide-react",
          replacement: path.resolve(
            __dirname,
            "node_modules/lucide-react/dist/cjs/lucide-react.js",
          ),
        },
      ],
    },
  },
});
