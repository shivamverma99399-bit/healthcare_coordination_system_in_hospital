import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const devProxyTarget = env.VITE_DEV_PROXY_TARGET;

  return {
    plugins: [react()],
    server: command === "serve" && devProxyTarget
      ? {
          port: 5173,
          proxy: {
            "/api": {
              target: devProxyTarget,
              changeOrigin: true,
            },
            "/admin": {
              target: devProxyTarget,
              changeOrigin: true,
            },
            "/static": {
              target: devProxyTarget,
              changeOrigin: true,
            },
          },
        }
      : {
          port: 5173,
        },
  };
});
