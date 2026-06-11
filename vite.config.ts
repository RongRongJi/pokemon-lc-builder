import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tsconfigPaths from "vite-tsconfig-paths";

// https://vite.dev/config/
// VITE_BASE_PATH 由 GitHub Actions 工作流在构建时注入（如 "/repo-name/"）
// 本地开发/构建时若未设置，则回退到 './' 相对路径，适配任意子路径
const base = process.env.VITE_BASE_PATH ?? './';

export default defineConfig({
  base,
  build: {
    sourcemap: 'hidden',
  },
  plugins: [
    react({
      babel: {
        plugins: [
          'react-dev-locator',
        ],
      },
    }),
    tsconfigPaths()
  ],
})
