import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// build เป็น HTML ไฟล์เดียว: ฝัง JS / CSS / GLB (base64) ทั้งหมด เปิดด้วย file:// ได้
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: {
    target: 'es2020',
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 20_000,
  },
});
