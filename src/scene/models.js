// โหลดโมเดล GLB จาก polyfork (ฝังเป็น base64 ตอน build) ปรับให้ฐานอยู่ที่ y=0 และจุดกึ่งกลางที่ x,z=0
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

const files = import.meta.glob('../../assets/polyfork/*.glb', { query: '?url', import: 'default', eager: true });

const store = new Map(); // slug -> Group (ปรับแล้ว)

async function toBuffer(uri) {
  if (!uri.startsWith('data:')) return (await fetch(uri)).arrayBuffer(); // โหมด dev
  const b64 = uri.slice(uri.indexOf(',') + 1);
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr.buffer;
}

export async function loadModels() {
  const loader = new GLTFLoader();
  await Promise.all(Object.entries(files).map(([path, uri]) => new Promise((resolve) => {
    const slug = path.split('/').pop().replace('.glb', '');
    toBuffer(uri).then((buf) => loader.parse(buf, '', (gltf) => {
      const root = gltf.scene;
      const box = new THREE.Box3().setFromObject(root);
      const c = box.getCenter(new THREE.Vector3());
      const wrap = new THREE.Group();
      root.position.set(-c.x, -box.min.y, -c.z);
      wrap.add(root);
      wrap.userData.size = box.getSize(new THREE.Vector3());
      store.set(slug, wrap);
      resolve();
    }, (err) => { console.warn('โหลดโมเดลไม่ได้', slug, err); resolve(); })).catch((e) => { console.warn('fetch โมเดลไม่ได้', slug, e); resolve(); });
  })));
  return store.size;
}

// slug ขึ้นต้น เช่น 'two-storey-shophouse' ; คืน Group ใหม่ (วัสดุใช้ร่วมกัน)
export function makeModel(prefix, { x = 0, z = 0, rotY = 0, scale = 1, sx, sz, sy } = {}) {
  const key = [...store.keys()].find((k) => k.startsWith(prefix));
  if (!key) return null;
  const inst = cloneSkinned(store.get(key));
  const holder = new THREE.Group();
  holder.add(inst);
  holder.scale.set(sx ?? scale, sy ?? scale, sz ?? scale);
  holder.rotation.y = rotY;
  holder.position.set(x, 0, -z); // z ของฉาก = ลึกจากถนน → three.z = -z
  return holder;
}

export const modelSize = (prefix) => {
  const key = [...store.keys()].find((k) => k.startsWith(prefix));
  return key ? store.get(key).userData.size : null;
};
