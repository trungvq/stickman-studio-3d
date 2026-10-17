import { fromCharacter, npr, parseCharacter, SCULPT_PRESETS } from '@stickman3d/rig';
import * as THREE from 'three';

// Đầu và đồ đội (`?demo=headgear`): một hàng người 3D mặc đồ soi tóc và đồ đội đầu — búi cao, búi thấp lệch có trâm,
// búi thấp to, ngôi lệch mái rủ có lọn vểnh, vuốt ngược hói chữ M, đầu đinh đội mũ trụ thấp, hói nhẹ mai hai màu.
// `?row=caps` thay hàng ấy bằng hàng mũ kê-pi: cảnh sát khu vực tóc ngắn, tóc dài; cảnh sát giao thông tóc ngắn, đuôi ngựa.
// `?turn=độ` xoay từng người tại chỗ (mặc định 0, nhìn thẳng ống kính), `?bow=độ` cúi thân tới trước, `?nod=độ` cúi đầu.

const SPACING = 1.4;

const P = SCULPT_PRESETS;
const HEADS = [
  { name: 'bui-cao', hair: { color: '#2E2420', sculpt: { ...P.bun.sculpt } }, garment: '#2B3A67' },
  {
    name: 'bui-lech-tram',
    hair: { color: '#2E2420', sculpt: { ...P.bun.sculpt, tie: 4, tieLon: -140 } },
    headAcc: { src: 'sculpt', color: '#3A2A22', accent: '#D9573B', pin: { angle: 35 } },
    garment: '#C68B2C',
  },
  { name: 'bui-thap-to', hair: { color: '#D8CFC4', sculpt: { ...P.bun.sculpt, tie: 8, knotSize: 1.4 } }, garment: '#5B2A4A' },
  {
    name: 'ngoi-lech-vong',
    hair: { color: '#3A2A22', sculpt: { ...P.neat.sculpt, part: 25, fringe: 12, bang: 14, bangTo: -40, ahoge: 1 } },
    garment: '#2E6B4F',
  },
  { name: 'vuot-hoi-m', hair: { color: '#1E1612', sculpt: { ...P.slick.sculpt, front: 54, recede: 16 } }, garment: '#D7263D' },
  {
    name: 'dinh-mu',
    hair: { color: '#6E6660', sculpt: { ...P.buzz.sculpt } },
    crown: { src: 'sculpt', color: '#F3EBDD', hat: {} },
    garment: '#F3EBDD',
  },
  { name: 'hoi-mai-bac', hair: { color: '#5E4A3E', accent: '#D8CFC4', sculpt: { ...P.baldLight.sculpt } }, garment: '#D9C8A9' },
];

const POLICE = { src: 'sculpt', color: '#1e2638', hat: { shape: 'peaked' } };
const TRAFFIC = { src: 'sculpt', color: '#f4f2ec', hat: { shape: 'peaked', strapColor: '#f4f2ec' } };
const CAPS = [
  { name: 'canh-sat-ngan', hair: { color: '#2A1E18', sculpt: { ...P.short.sculpt } }, crown: POLICE, garment: '#2a3550' },
  { name: 'canh-sat-dai', hair: { color: '#3A2A22', sculpt: { ...P.shoulder.sculpt } }, crown: POLICE, garment: '#2a3550' },
  { name: 'giao-thong-ngan', hair: { color: '#2A1E18', sculpt: { ...P.buzz.sculpt } }, crown: TRAFFIC, garment: '#2a3550' },
  { name: 'giao-thong-duoi', hair: { color: '#2E2420', sculpt: { ...P.ponyLow.sculpt } }, crown: TRAFFIC, garment: '#2a3550' },
];

function figureOf({ name, hair, crown, headAcc, garment }, seed) {
  const r = parseCharacter({
    name,
    head: { form: 'human' },
    palette: { garment, skin: '#f8e3c8', line: '#1c1c1e', clad: true, sleeve: garment, trouser: '#3b4252' },
    pieces: {
      torso: { src: 'sculpt', garment: { style: 'shirt' } },
      hair: { src: 'sculpt', ...hair },
      ...(crown && { crown }),
      ...(headAcc && { headAcc }),
    },
  });
  if (!r.success) throw new Error(`${name}: ${r.error.message}`);
  return fromCharacter(r.data, { seed });
}

export function headgear(q) {
  const row = q.get('row') === 'caps' ? CAPS : HEADS;
  const n = row.length;
  const figs = row.map(figureOf);
  figs.forEach((f, i) => {
    f.root.position.set((i - (n - 1) / 2) * SPACING, 0, 0);
    f.root.rotation.y = (Number(q.get('turn') ?? 0) * Math.PI) / 180;
    f.spine.rotation.x = (Number(q.get('bow') ?? 0) * Math.PI) / 180;
    f.head.rotation.x = (Number(q.get('nod') ?? 0) * Math.PI) / 180;
    f.face.set({ mouth: 'closed', brow: 'neutral', eyes: 'open' });
    for (const s of [-1, 1]) f.legs[s].hip.rotation.set(0, 0, s * 0.03);
  });
  const group = new THREE.Group();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(n * SPACING + 4, 8).rotateX(-Math.PI / 2), npr({ color: '#d9d2c3', stipple: 0.06, stippleScale: 1.4, soft: 1 }));
  floor.position.y = -0.004;
  group.add(floor, ...figs.map((f) => f.root));
  return { objects: [group], animate() {} };
}
