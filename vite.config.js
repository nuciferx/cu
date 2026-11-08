import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// build เป็น HTML ไฟล์เดียวต่อบท: ฝัง JS / CSS / GLB (base64) ทั้งหมด เปิดด้วย file:// ได้
// หลายบท: scripts/build.mjs รัน vite build ทีละบทโดยตั้ง CU_ENTRY (ไฟล์ html ของบท) และ CU_OUT (โฟลเดอร์ผลลัพธ์)
// (vite-plugin-singlefile ฝังไฟล์เดียวได้ครั้งละหนึ่งหน้า จึงแยกรอบ)
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  build: {
    target: 'es2020',
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    chunkSizeWarningLimit: 20_000,
    outDir: process.env.CU_OUT || 'dist',
    rollupOptions: process.env.CU_ENTRY ? { input: process.env.CU_ENTRY } : undefined,
  },
});
