import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { HUMAN_HEAD, humanEar, humanSkull } from './core/humanHead';
import { fingerVec, HAND_DOF, HAND_POSES, HAND_REST, type HandPose } from './core/hand';
import { handSkin, skinHand, smoothNormals, type HandSkin } from './core/handMesh';
import { newCanvas } from './canvas';
import { G } from './npr';

// Khối của người 3D mặc đồ (`palette.clad`) và đầu `head.form: "human"`: đầu có quai hàm, tai, cổ; bàn tay, giày, khối
// hông. Chỉ hình học; `stickman.ts` gắn vào khớp và tô màu. docs/01-rig.md#người-3d-mặc-đồ

/** Giày trong khung cổ chân (y lên, z mũi giày), đo bằng bán kính cổ chân: gót, mũi, nửa rộng, cao trên cổ chân */
export const SHOE = { heel: -1.25, toe: 3.3, half: 1.22, top: 1.15 };

const _v = new THREE.Vector3(), _s = new THREE.Vector3(), _qk = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _e = new THREE.Euler();
/** Ống chân lệch khỏi phương đứng dưới góc này thì bàn chân vẫn nằm ngang, quá thì nghiêng theo phần dư (radian) */
const FOOT_FREE = 0.5;

/**
 * Cổ chân: tự xoay bàn chân về nằm ngang trong hệ người (`body`) mỗi lần three tính ma trận, không cần `act` gọi. Ống
 * chân chúc quá `FOOT_FREE` (quỳ, đá chân) thì bàn chân nghiêng theo phần dư.
 */
export class Ankle extends THREE.Group {
  constructor(private body: THREE.Object3D) {
    super();
  }
  private level() {
    const knee = this.parent;
    if (!knee) return;
    knee.matrixWorld.decompose(_v, _qk, _s);
    this.body.matrixWorld.decompose(_v, _qb, _s);
    const rel = _qb.invert().multiply(_qk);
    const d = _v.set(0, -1, 0).applyQuaternion(rel);
    const pitch = Math.atan2(-d.z, -d.y);
    const foot = new THREE.Quaternion().setFromEuler(_e.set(pitch - Math.max(-FOOT_FREE, Math.min(FOOT_FREE, pitch)), 0, 0));
    this.quaternion.copy(rel.invert().multiply(foot));
  }
  override updateMatrixWorld(force?: boolean) {
    this.level();
    super.updateMatrixWorld(force);
  }
  override updateWorldMatrix(updateParents: boolean, updateChildren: boolean) {
    if (updateParents) this.parent?.updateWorldMatrix(true, false);
    this.level();
    super.updateWorldMatrix(false, updateChildren);
  }
}

/** Lưới kín, pháp tuyến trơn qua đường nối UV: vỏ viền ngược không nứt */
function smooth(g: THREE.BufferGeometry) {
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  const m = mergeVertices(g);
  m.computeVertexNormals();
  return m;
}

/** Khối sọ `human`: mặt cầu bán kính `r` qua `humanSkull` rồi phóng `scale` như sọ cầu */
export function humanHeadGeometry(r: number, segs: [number, number], scale: THREE.Vector3) {
  const g = new THREE.SphereGeometry(1, ...segs), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const [x, y, z] = humanSkull([p.getX(i), p.getY(i), p.getZ(i)]);
    p.setXYZ(i, x * r * scale.x, y * r * scale.y, z * r * scale.z);
  }
  return smooth(g);
}

/** Bề dày nét chữ C của tai, phần bán kính đầu */
const EAR_STROKE = 0.02;
/** Nét chỗ tai cắt vào má, three: bằng nét bóng dáng `ink` của sọ */
const EAR_SEAM = 0.03;
const earInk = new Map<string, THREE.ShaderMaterial>();

/** Nét chữ C mở về phía mặt trên canvas phủ mặt ngoài tai: x theo z, y theo −y của tai đơn vị; chỉ đọc alpha */
function earCurl() {
  const E = HUMAN_HEAD.ear, W = 128, H = Math.round((W * E.h) / E.w);
  const canvas = newCanvas(W, H), g = canvas.getContext('2d') as CanvasRenderingContext2D;
  g.lineCap = 'round';
  g.lineWidth = (EAR_STROKE / (2 * E.w)) * W;
  g.beginPath();
  g.ellipse(0.46 * W, 0.5 * H, 0.18 * W, 0.21 * H, 0, (290 * Math.PI) / 180, (70 * Math.PI) / 180, true);
  g.stroke();
  const tex = new THREE.CanvasTexture(canvas as HTMLCanvasElement);
  tex.anisotropy = 8;
  return tex;
}

/**
 * Nét trên mặt ngoài tai, đều vẽ phía trong tai: chữ C của `earCurl`; dải dọc chỗ tai cắt vào má (`gap` = cao trên mặt
 * sọ, three); dải dọc bóng dáng tai chỗ mép tai nằm trước đầu (tia nhìn qua mép trúng sọ `humanSkull`; `h0..h2` đưa hệ tai
 * về sọ đơn vị) — trên nền thì nét bóng dáng `ink` lo. Bóng dáng tính đúng trên ellipsoid `fit` (bán kính ba trục, dời x),
 * không qua đạo hàm: mặt tai nhìn xiên vẫn giữ bề dày. Hai dải rộng `EAR_SEAM` đo trên mặt phẳng vuông tia nhìn như nét
 * bóng dáng. Kiểu cel bỏ hai dải như vỏ ngược.
 */
function earMaterial(ink: string) {
  let m = earInk.get(ink);
  if (m) return m;
  const H = HUMAN_HEAD;
  m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    uniforms: { uMap: { value: earCurl() }, uColor: { value: new THREE.Color(ink) }, uW: { value: EAR_SEAM }, uShade: G.uShade },
    vertexShader: /* glsl */ `
      attribute float gap; attribute vec4 fit, h0, h1, h2; attribute vec3 sph;
      varying float vGap, vScale; varying vec3 vW, vS, vL, vEye; varying vec4 vFit, vH0, vH1, vH2; varying vec2 vUv;
      void main(){
        vUv = uv; vGap = gap; vS = sph; vL = position; vFit = fit; vH0 = h0; vH1 = h1; vH2 = h2;
        vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz;
        vScale = length(modelMatrix[0].xyz);
        vEye = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uMap; uniform vec3 uColor; uniform float uW, uShade;
      varying float vGap, vScale; varying vec3 vW, vS, vL, vEye; varying vec4 vFit, vH0, vH1, vH2; varying vec2 vUv;
      vec3 local(vec3 p){ return vFit.xyz * p + vec3(vFit.w, 0.0, 0.0); }
      vec3 toHead(vec3 l){ vec4 h = vec4(l, 1.0); return vec3(dot(vH0, h), dot(vH1, h), dot(vH2, h)); }
      // humanSkull của core/humanHead.ts; cao trên sọ theo tia từ tâm, sọ đơn vị
      float above(vec3 x){
        vec3 p = normalize(x);
        float s = max(0.0, -p.y), s2 = s * s, b = (sqrt(p.z * p.z + 0.04) - p.z) / 2.0;
        return length(x) - length(vec3(p.x * (1.0 + ${H.jaw} * s2), p.y * (1.0 + ${H.drop} * s2) * (1.0 - ${H.flat} * s2 * s2 * s2), p.z + s2 * (${H.chin} + ${H.nape} * b)));
      }
      void main(){
        // chữ C chỉ ở nửa ngoài: dấu của fit.w là bên
        float a = texture2D(uMap, vUv).a * step(0.0, vS.x * vFit.w);
        if (abs(uShade - 1.0) > 0.5) {
          vec3 v = normalize(vW - cameraPosition), dx = dFdx(vW), dy = dFdy(vW);
          float px = max(length(dx - v * dot(dx, v)), length(dy - v * dot(dy, v))), w = uW / px;
          float seam = abs(vGap) / max(length(vec2(dFdx(vGap), dFdy(vGap))), 1e-9);
          // hệ tai đổi ra three, sọ đơn vị đổi ra hệ tai
          float unit = 1.0 / length(vH0.xyz);
          vec3 vl = normalize(vL - vEye);
          // bóng dáng: trên cầu đơn vị của tai (fit) nhìn từ mắt, điểm bóng dáng q cùng mặt phẳng với tâm, mắt và điểm p
          vec3 eu = (vEye - vec3(vFit.w, 0.0, 0.0)) / vFit.xyz, p = normalize(vS), e = normalize(eu), u = p - e * dot(p, e);
          float k = 1.0 / length(eu);
          vec3 q = e * k + (length(u) > 1e-5 ? normalize(u) : vec3(0.0)) * sqrt(max(1.0 - k * k, 0.0)), d = local(q) - local(p);
          // tia nhìn qua q: điểm gần tâm sọ nhất nằm trong sọ thì sau mép tai ấy là đầu
          vec3 eh = toHead(vEye), r = normalize(toHead(local(q)) - eh), cp = eh + r * dot(-eh, r);
          float over = smoothstep(-px, px, -above(cp) * unit * vScale);
          // điểm bóng dáng chìm trong má thì dải thon dần về chỗ cắt má thay vì cụt
          float sil = (length(d - vl * dot(d, vl)) + 4.0 * max(-above(toHead(local(q))), 0.0) * unit) * vScale / px;
          a = max(a, 1.0 - smoothstep(w - 0.75, w + 0.75, min(seam, over > 0.5 ? sil : 1e9)));
        }
        if (a < 0.004) discard;
        gl_FragColor = vec4(uColor, a);
      }`,
  });
  earInk.set(ink, m);
  return m;
}

/** Cao của điểm `q` (sọ đơn vị) trên mặt đầu `human`, sọ đơn vị: tìm hướng trên cầu đơn vị mà `humanSkull` đưa về đúng tia tới `q` */
function aboveSkull(q: THREE.Vector3) {
  const t = q.clone().normalize(), u = t.clone(), s = new THREE.Vector3();
  for (let i = 0; i < 6; i++) {
    s.fromArray(humanSkull(u.toArray()));
    u.add(t).sub(s.normalize()).normalize();
  }
  return q.length() - s.fromArray(humanSkull(u.toArray())).length();
}

/**
 * Tai bên `side` trên đầu `human` (hệ nhóm đầu): vỏ dẹt chìm nửa vào má, mặt ngoài ngả ra trước. `skin` mang nét bóng
 * dáng `ink` của sọ, cùng vật liệu nên chỗ tai cắt vào má không có nét bóng dáng; nét ấy và chữ C mở về phía mặt vẽ trên
 * một lớp dán phủ ngoài tai (`earMaterial`), màu `ink`.
 */
export function earGroup(side: -1 | 1, r: number, scale: THREE.Vector3, skin: THREE.Material, ink: string) {
  const E = HUMAN_HEAD.ear;
  const [cx, cy, cz] = humanEar(side);
  const g = new THREE.Group();
  g.position.set(cx * r * scale.x, cy * r * scale.y, cz * r * scale.z);
  g.rotation.set(0, side * -0.35, side * 0.12);
  g.updateMatrix();
  const shell = (geo: THREE.BufferGeometry, k = 1) => geo.scale(E.out * r * k, E.h * r * k, E.w * r * k).translate(side * E.out * r * 0.35, 0, 0);
  const m = new THREE.Mesh(smooth(shell(new THREE.SphereGeometry(1, 48, 24))), skin);
  m.castShadow = true;
  // cùng vật liệu với sọ: nét bóng dáng tai chỉ ở mép trên nền hay vật khác, trên đầu thì `earMaterial` vẽ
  m.userData.inkGap = 1;
  const lines = new THREE.SphereGeometry(1, 48, 24);
  lines.setAttribute('sph', lines.attributes.position.clone());
  shell(lines, 1.01);
  const p = lines.attributes.position, uv = lines.attributes.uv;
  const gap = new Float32Array(p.count), q = new THREE.Vector3(), k = (r * (scale.x + scale.y + scale.z)) / 3;
  for (let i = 0; i < p.count; i++) {
    uv.setXY(i, 0.5 + p.getZ(i) / (2 * E.w * r * 1.01), 0.5 + p.getY(i) / (2 * E.h * r * 1.01));
    q.fromBufferAttribute(p, i).applyMatrix4(g.matrix).divide(scale).divideScalar(r);
    gap[i] = aboveSkull(q) * k;
  }
  lines.setAttribute('gap', new THREE.BufferAttribute(gap, 1));
  const fit = [E.out * r, E.h * r, E.w * r, side * E.out * r * 0.35];
  lines.setAttribute('fit', new THREE.BufferAttribute(new Float32Array(p.count * 4).map((_, i) => fit[i % 4]), 4));
  // hàng của ma trận tai → sọ đơn vị: g.matrix rồi chia bán kính sọ theo trục
  const e = g.matrix.elements, sr = [r * scale.x, r * scale.y, r * scale.z];
  for (let j = 0; j < 3; j++) {
    const row = [e[j], e[4 + j], e[8 + j], e[12 + j]].map((v) => v / sr[j]);
    lines.setAttribute(`h${j}`, new THREE.BufferAttribute(new Float32Array(p.count * 4).map((_, i) => row[i % 4]), 4));
  }
  const c = new THREE.Mesh(lines, earMaterial(ink));
  c.userData.noShadow = true;
  c.userData.noCollide = true;
  c.renderOrder = 1;
  g.add(m, c);
  return g;
}

/** Cổ trong nhóm cổ: từ trong cổ áo lên tới trong đầu, hơi lùi sau trục */
export function neckGeometry(top: number, radius: number) {
  const g = new THREE.CylinderGeometry(radius, radius * 1.08, top + 0.04, 16, 1, true);
  g.translate(0, top / 2 - 0.02, -0.03);
  return smooth(g);
}

export { handScale, openLength } from './core/act3';

/**
 * Bàn tay của người `clad` bên `side`: một lưới kín liền (`handSkin` của lõi) buộc vào các đốt của `handFrames`, da dời
 * trên CPU mỗi khi số bàn tay đổi — một lượt vẽ, vỏ viền dùng chung đỉnh nên chỉ có nét ở mép ngoài. Cỡ `scale`
 * (`handScale`), cỡ dọc `long`.
 */
export interface Hand {
  side: -1 | 1;
  scale: number;
  long: number;
  geo: THREE.BufferGeometry;
  skin: HandSkin;
  /** Số bàn tay (`HAND_DOF`) `act` đặt lần gần nhất */
  acted: readonly number[];
  /** Dáng giữ khi đang cầm đồ (`grip` của attach.ts): đè góc ngón của hành động, giữ xoay và gập cổ tay */
  held?: HandPose;
  /** Số bàn tay (`HAND_DOF`) của dáng giữ khi dáng ấy hoà từ hai dáng (chỗ cầm nhóm): đè dáng tên `held` */
  heldV?: readonly number[];
  /** Độ gập thêm từng đốt khi ngón ôm theo đồ (`HAND_FIT`, `heldFit` của lõi), cộng vào dáng `held` */
  fit?: readonly number[];
  /** Góc ngón đang vẽ */
  shown: number[];
}

/** Dựng bàn tay bên `side` cỡ `k`, cỡ dọc `long`, ở dáng nghỉ; `low` là lưới thưa cho người nền */
export function handRig(side: -1 | 1, k: number, long: number, low = false): Hand {
  const skin = handSkin(side, k, long, low), n = skin.pos.length / 3;
  const geo = new THREE.BufferGeometry();
  for (const name of ['position', 'normal']) geo.setAttribute(name, new THREE.BufferAttribute(new Float32Array(n * 3), 3).setUsage(THREE.DynamicDrawUsage));
  geo.setIndex(new THREE.BufferAttribute(skin.index, 1));
  // cầu và hộp bao cố định ôm mọi dáng (pipeline đọc hộp cho bóng và nét bóng dáng): không tính lại mỗi lần dời đỉnh
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, -0.1 * long, 0), 0.14 * Math.max(k, long) + 0.02);
  geo.boundingBox = geo.boundingSphere.getBoundingBox(new THREE.Box3());
  const h: Hand = { side, scale: k, long, geo, skin, acted: HAND_REST, shown: [] };
  poseHand(h);
  return h;
}

/**
 * Đặt bàn tay theo số `v` (`HAND_DOF`; bỏ trống là giữ số đặt lần trước); đang cầm đồ thì góc ngón theo dáng `held`. Xoay
 * và gập cổ tay là việc của khớp cổ tay (`act`), ở đây chỉ uốn da theo đốt. Số không đổi thì không làm gì.
 */
export function poseHand(h: Hand, v?: readonly number[]) {
  if (v) h.acted = v;
  // `heldV` của kiểu cầm soạn tay kèm `HAND_FIT`: `fit` của `heldFit` đã gồm nó
  const want = h.held ? [0, 0, ...(h.heldV?.slice(2, HAND_DOF.length) ?? fingerVec(HAND_POSES[h.held])), ...(h.fit ?? h.heldV?.slice(HAND_DOF.length) ?? [])] : h.acted;
  if (h.shown.length === want.length - 2 && h.shown.every((x, i) => Math.abs(x - want[i + 2]) < 1e-3)) return;
  h.shown = want.slice(2);
  const P = h.geo.attributes.position as THREE.BufferAttribute, N = h.geo.attributes.normal as THREE.BufferAttribute;
  skinHand(h.skin, want, P.array as Float32Array);
  smoothNormals(P.array as Float32Array, h.skin.index, N.array as Float32Array);
  P.needsUpdate = N.needsUpdate = true;
}

/**
 * Giày trong khung cổ chân, cỡ theo bán kính cổ chân `ra`: đế phẳng cách cổ chân `sole` xuống, gót tròn trùm mút ống
 * chân, mũi thấp dần về trước.
 */
export function shoeGeometry(sole: number, ra: number) {
  const heel = SHOE.heel * ra, toe = SHOE.toe * ra, half = SHOE.half * ra, top = SHOE.top * ra + sole;
  const g = new THREE.SphereGeometry(1, 22, 14), p = g.attributes.position;
  const cz = (heel + toe) / 2, rz = (toe - heel) / 2, mid = top / 2;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    let Y = mid + y * mid * (y > 0 ? 1 - 0.45 * Math.max(0, z) : 1.05);
    if (Y < 0.003) Y = 0.003 - (0.003 - Y) * 0.15;
    p.setXYZ(i, x * half * (1 - 0.12 * Math.max(0, z)), Y - sole, cz + z * rz);
  }
  return smooth(g);
}

/** Nang va chạm của giày trong khung cổ chân: gót, mũi (z), cao độ trục, bán kính */
export function shoeCapsule(sole: number, ra: number): [number, number, number, number] {
  const r = (SHOE.top * ra + sole) / 2;
  return [SHOE.heel * ra + r, SHOE.toe * ra - r, r - sole, r];
}

/** Mông trong khối hông, theo bán kính gốc đùi: tâm lùi sau `back`, thấp hơn khớp hông `drop`, bán kính `r` */
const BUTT = { back: 0.4, drop: 0.4, r: 0.9 };

/**
 * Khối hông nối thân áo với hai đùi, hệ nhóm thân (three, y lên từ hông): bao lồi của vành thân áo thu vào ở `ringY`, hai
 * khối cầu bán kính `r` quanh gốc chân `±hip` và hai khối cầu mông (`BUTT`). `profile` là mặt cắt thân áo (`[nửa rộng,
 * y xuống]`, px), `depth` nửa bề sâu từng hàng của nó.
 */
export function pelvisGeometry(profile: [number, number][], depth: number[], hip: number, r: number) {
  const bottom = profile[profile.length - 1][1];
  /** Nửa rộng, nửa sâu của thân áo ở `y` */
  const at = (y: number): [number, number] => {
    for (let i = 1; i < profile.length; i++) {
      const [a0, y0] = profile[i - 1], [a1, y1] = profile[i];
      if (y0 <= y && y <= y1) {
        const u = y1 === y0 ? 1 : (y - y0) / (y1 - y0);
        return [a0 + (a1 - a0) * u, depth[i - 1] + (depth[i] - depth[i - 1]) * u];
      }
    }
    return [profile[profile.length - 1][0], depth[depth.length - 1]];
  };
  const yRing = Math.min(-15, bottom - 3);
  const pts: THREE.Vector3[] = [];
  const [ra, rd] = at(yRing).map((v) => (v * 0.94) / 100);
  for (let i = 0; i < 32; i++) {
    const t = (2 * Math.PI * i) / 32;
    pts.push(new THREE.Vector3(ra * Math.sin(t), -yRing / 100, rd * Math.cos(t)));
  }
  const ball = (x: number, y: number, z: number, rr: number) => {
    for (let i = 0; i <= 6; i++)
      for (let j = 0; j < 12; j++) {
        const th = (Math.PI * i) / 6, ph = (2 * Math.PI * j) / 12;
        pts.push(new THREE.Vector3(x + rr * Math.sin(th) * Math.cos(ph), y + rr * Math.cos(th), z + rr * Math.sin(th) * Math.sin(ph)));
      }
  };
  for (const s of [-1, 1]) {
    ball(s * hip, 0, 0, r);
    ball(s * hip, -BUTT.drop * r, -BUTT.back * r, BUTT.r * r);
  }
  // tới nửa bán kính đùi dưới gấu, khối hông lùi hẳn vào trong thân áo: mặt bao lồi nối lên trên gấu không cắt qua lưng, sườn áo
  for (const p of pts) {
    const y = -p.y * 100;
    if (y >= bottom + 50 * r) continue;
    const [a, d] = at(y).map((v) => (v * 0.88) / 100), e = Math.hypot(p.x / a, p.z / d);
    if (e > 1) p.set(p.x / e, p.y, p.z / e);
  }
  return smooth(new ConvexGeometry(pts));
}
