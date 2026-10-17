import { fromCharacter, hangJewelry, npr, parseCharacter, SCULPT_PRESETS } from '@stickman3d/rig';
import * as THREE from 'three';

// Trang sức (`?demo=jewelry`): một hàng nữ người 3D mặc đồ đeo dây chuyền (`pieces.neck.necklace`) và bông tai
// (`pieces.headAcc.earrings`) — váy liền cổ vuông dây vàng mặt tròn bông nụ, cổ vuông chuỗi ngọc trai bông vòng, blouse dây
// mặt giọt bông dài, áo phông dây dài bông dài nghiêng đầu, sơ mi cổ V dây mặt giọt bông vòng nghiêng đầu bên kia, đuôi ngựa
// chuỗi ngọc mặt tròn bông nụ ngọc trai.
// `?turn=độ` xoay từng người tại chỗ, `?tilt=độ` nghiêng đầu người thứ tư, thứ năm (mặc định 18).

const SPACING = 1.4;
const P = SCULPT_PRESETS;

const WOMEN = [
  {
    name: 'vang-nu', hair: 'shoulder', hairColor: '#3b2a22', garment: { style: 'squareNeck', hem: -20 }, color: '#B3243A', skirt: true,
    necklace: { pendant: 'round', gem: '#E9EEF5' }, earrings: { shape: 'stud', gem: '#E9EEF5' },
  },
  {
    name: 'ngoc-vong', hair: 'bun', hairColor: '#2E2420', garment: { style: 'squareNeck', hem: -20 }, color: '#1F1F27', skirt: true,
    necklace: { style: 'pearl', pendant: 'none', drop: 16 }, earrings: { shape: 'hoop' },
  },
  {
    name: 'giot-dai', hair: 'shoulder', hairColor: '#6B4A35', garment: { style: 'blouse', hem: -18 }, color: '#E7D8C4', skirt: true,
    necklace: { pendant: 'drop', gem: '#B3243A' }, earrings: { shape: 'drop', gem: '#B3243A' },
  },
  {
    name: 'dai-nghieng', hair: 'bun', hairColor: '#3b2a22', garment: { style: 'tshirt' }, color: '#2B3A67', tilt: 1,
    necklace: { drop: 34, pendant: 'drop', size: 4.2, gem: '#3E8E7E' }, earrings: { shape: 'drop', gem: '#3E8E7E' },
  },
  {
    name: 'co-v-vong', hair: 'center', hairColor: '#2a1c15', garment: { style: 'shirt' }, color: '#F3EBDD', tilt: -1,
    necklace: { pendant: 'drop', drop: 26 }, earrings: { shape: 'hoop', size: 0.18 },
  },
  {
    name: 'nu-ngoc', hair: 'ponyHigh', hairColor: '#2E2420', garment: { style: 'squareNeck', hem: -20 }, color: '#5B2A4A', skirt: true,
    necklace: { style: 'pearl', drop: 22, pendant: 'round', size: 4, gem: '#D9B44A' }, earrings: { shape: 'stud', gem: '#F4EDE0', size: 0.07 },
  },
];

function figureOf({ name, hair, hairColor, garment, color, skirt, necklace, earrings }, seed) {
  const r = parseCharacter({
    name,
    head: { form: 'human' },
    face: { blush: 0.3 },
    palette: { garment: color, skin: '#f8e3c8', line: '#1c1c1e', clad: true, sleeve: color, sleeveLength: 0.3, trouser: '#3b4252', trouserLength: skirt ? 0 : 1, shoe: '#2b2623' },
    pieces: {
      torso: { src: 'sculpt', garment },
      hair: { src: 'sculpt', color: hairColor, sculpt: { ...P[hair].sculpt } },
      ...(skirt && { hem: { src: 'sculpt', color, skirt: { length: 70 } } }),
      neck: { src: 'sculpt', necklace },
      headAcc: { src: 'sculpt', earrings },
    },
  });
  if (!r.success) throw new Error(`${name}: ${r.error.message}`);
  return fromCharacter(r.data, { seed });
}

export function jewelry(q) {
  const n = WOMEN.length;
  const figs = WOMEN.map(figureOf);
  const tilt = (Number(q.get('tilt') ?? 18) * Math.PI) / 180;
  figs.forEach((f, i) => {
    f.root.position.set((i - (n - 1) / 2) * SPACING, 0, 0);
    f.root.rotation.y = (Number(q.get('turn') ?? 0) * Math.PI) / 180;
    f.neck.rotation.z = (WOMEN[i].tilt ?? 0) * tilt;
    f.face.set({ mouth: 'closed', brow: 'neutral', eyes: 'open' });
    for (const s of [-1, 1]) f.legs[s].hip.rotation.set(0, 0, s * 0.03);
    f.root.updateMatrixWorld(true);
    hangJewelry(f);
  });
  const group = new THREE.Group();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(n * SPACING + 4, 8).rotateX(-Math.PI / 2), npr({ color: '#d9d2c3', stipple: 0.06, stippleScale: 1.4, soft: 1 }));
  floor.position.y = -0.004;
  group.add(floor, ...figs.map((f) => f.root));
  return { objects: [group], animate() {} };
}
