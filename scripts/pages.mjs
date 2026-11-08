// รายการบทที่ build ได้: entry = ไฟล์ html ที่ราก (ใช้กับ npm run dev ได้ด้วย) · out = ชื่อไฟล์ใน lessons/
// env (ไม่บังคับ) = ตัวแปรเพิ่มตอน build หน้านั้น · VITE_CU_MODELS=person = ฝังเฉพาะโมเดลคน (ดู src/scene/models.js)
export const PAGES = [
  { entry: 'index.html', out: 'ระยะร่น.html' },
  { entry: 'lesson-01.html', out: '01-วัตถุประสงค์.html' },
  { entry: 'lesson-02.html', out: '02-อาคารขนาดใหญ่-อาคารสูง.html', env: { VITE_CU_MODELS: 'person' } },
];
