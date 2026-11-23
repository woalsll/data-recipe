import { defineConfig } from 'vite';

// GitHub Pages(저장소 하위 경로)·Netlify 어디에 올려도 동작하도록 상대 경로로 빌드
export default defineConfig({
  base: './',
  build: { outDir: 'dist', assetsInlineLimit: 0 },
});
