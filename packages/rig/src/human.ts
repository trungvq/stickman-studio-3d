import * as THREE from 'three';
import { ConvexGeometry } from 'three/addons/geometries/ConvexGeometry.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { faceSurface, HUMAN_HEAD, humanEar, headShape, humanSkull, humanSkullGlsl, noseNums } from './core/humanHead';
import { fingerVec, HAND_DOF, HAND_POSES, HAND_REST, type HandPose } from './core/hand';
import { handSkin, skinHand, smoothNormals, type HandSkin } from './core/handMesh';
import { FOOT_FREE, SHOE_CLEAR, shoeCut, shoeFit, shoeForm, shoeToes, type ShoeForm, type ShoeSection } from './core/shoe';
import { humanNeckAt } from './core/torso';
import { newCanvas } from './canvas';
import { G } from './npr';

// Khối của người 3D mặc đồ (`palette.clad`) và đầu `head.form: "human"`: đầu có quai hàm, tai, cổ; bàn tay, giày, khối
// hông. Chỉ hình học; `stickman.ts` gắn vào khớp và tô màu. docs/01-rig.md#người-3d-mặc-đồ

const _v = new THREE.Vector3(), _s = new THREE.Vector3(), _qk = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _e = new THREE.Euler();

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

/**
 * THỬ (feat/real-head-proto): mặt dưới sọ chỗ gặp cổ (sọ đơn vị). Pháp tuyến ở đó ngả về nằm ngang như mặt cổ ngay dưới:
 * đáy sọ úp xuống sau góc hàm không tối hơn cổ (ánh viền theo góc pháp tuyến, ánh trời theo `N.y`), nên chỗ đầu gặp cổ
 * không thành vòng khoanh tối. Trọng số: mặt úp xuống (`down`, theo −n.y), thấp hơn `low` (y), sau `back` (z, góc hàm ở
 * −0,05: quai hàm phía trước giữ bóng tối dưới hàm); phần `k` của độ ngả
 */
export const SKULL_NAPE_NORMAL = { down: [0.15, 0.6], low: [-0.45, -0.62], back: [0.12, -0.12], k: 0.85 } as const;

/** Khối sọ `human`: mặt cầu bán kính `r` qua `humanSkull` rồi phóng `scale` như sọ cầu; pháp tuyến đáy sau theo `SKULL_NAPE_NORMAL` */
export function humanHeadGeometry(r: number, segs: [number, number], scale: THREE.Vector3) {
  const g = new THREE.SphereGeometry(1, ...segs), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const [x, y, z] = humanSkull([p.getX(i), p.getY(i), p.getZ(i)]);
    p.setXYZ(i, x * r * scale.x, y * r * scale.y, z * r * scale.z);
  }
  const m = smooth(g), P = m.attributes.position, N = m.attributes.normal, W = SKULL_NAPE_NORMAL;
  const step = (a: number, b: number, v: number) => {
    const u = Math.max(0, Math.min(1, (v - a) / (b - a)));
    return u * u * (3 - 2 * u);
  };
  const n = new THREE.Vector3(), h = new THREE.Vector3();
  for (let i = 0; i < P.count; i++) {
    n.fromBufferAttribute(N, i);
    const uy = P.getY(i) / (r * scale.y), uz = P.getZ(i) / (r * scale.z);
    const w = W.k * step(W.down[0], W.down[1], -n.y) * step(W.low[0], W.low[1], uy) * step(W.back[0], W.back[1], uz);
    if (w <= 0) continue;
    h.set(n.x, 0, n.z);
    if (h.lengthSq() < 0.04) h.set(P.getX(i), 0, P.getZ(i));
    h.normalize();
    n.lerp(h, w).normalize();
    N.setXYZ(i, n.x, n.y, n.z);
  }
  return m;
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
  // shader dò mặt sọ theo dáng đầu đang dựng (kiểu mặt, hình hàm): mỗi dáng một vật liệu
  const shape = headShape(), key = `${ink}|${shape.face}|${shape.jaw}`;
  let m = earInk.get(key);
  if (m) return m;
  m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    uniforms: { uMap: { value: earCurl() }, uColor: { value: new THREE.Color(ink) }, uW: { value: EAR_SEAM }, uShade: G.uShade, uLine: { value: 1 } },
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
      uniform sampler2D uMap; uniform vec3 uColor; uniform float uW, uShade, uLine;
      varying float vGap, vScale; varying vec3 vW, vS, vL, vEye; varying vec4 vFit, vH0, vH1, vH2; varying vec2 vUv;
      vec3 local(vec3 p){ return vFit.xyz * p + vec3(vFit.w, 0.0, 0.0); }
      vec3 toHead(vec3 l){ vec4 h = vec4(l, 1.0); return vec3(dot(vH0, h), dot(vH1, h), dot(vH2, h)); }
      // humanSkull của core/humanHead.ts (hàm V); cao trên sọ theo tia từ tâm, sọ đơn vị
      ${humanSkullGlsl(shape)}
      float above(vec3 x){ return length(x) - length(humanSkull(normalize(x))); }
      void main(){
        // chữ C chỉ ở nửa ngoài: dấu của fit.w là bên
        float a = texture2D(uMap, vUv).a * step(0.0, vS.x * vFit.w);
        // THỬ (feat/real-head-proto): vẽ không viền thì chữ C chỉ còn vệt bóng mờ trên da, bỏ dải cắt má và dải bóng dáng
        if (uLine < 0.5) a *= 0.28;
        if (abs(uShade - 1.0) > 0.5 && uLine > 0.5) {
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
  m.userData.earInk = true;
  earInk.set(key, m);
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

/** THỬ (feat/real-head-proto): số mũi gốc (mặt `western`); dựng theo kiểu mặt đang đặt thì đọc `noseNums` — `HUMAN_NOSE` của lõi */
export { HUMAN_NOSE as NOSE } from './core/humanHead';

/**
 * THỬ (feat/real-head-proto): mũi khối riêng trên đầu `human`, hệ nhóm đầu: một tấm phủ dải giữa mặt, từng điểm nằm trên
 * mặt sọ (`faceSurface`, nên theo đúng `humanSkull` hiện hành) rồi nhô ra trước (+z) theo một trường cao — sống mũi mọc dần
 * từ giữa hai mắt, chóp tròn, cánh mũi hai bên chóp (kiểu mặt có `ala.h`), mặt dưới dốc về nhân trung. Số theo kiểu mặt
 * đang đặt (`noseNums`, `HUMAN_NOSE` của lõi). Mép tấm chìm `sink` dưới da nên sống mũi liền vào mặt, không có mép dán.
 * `eyes` là `offsetY`, `mouthGap` sau `chibiShape`; `spec` là `head.nose` của nhân vật.
 */
export function noseGeometry(r: number, scale: THREE.Vector3, eyes: { offsetY: number; mouthGap: number }, spec: { length?: number; out?: number } = {}, low = false) {
  const N = noseNums(headShape()), len = spec.length ?? 1, out = N.out * (spec.out ?? 1), A = N.ala;
  const mouth = eyes.offsetY + eyes.mouthGap;
  const y0 = eyes.offsetY - N.root;
  const yt = Math.min(y0 + N.tip * eyes.mouthGap * len, mouth - N.gap);
  const y1 = Math.min(yt + N.under, mouth - N.gap / 2);
  const vt = (yt - y0) / (y1 - y0);
  // cao dọc sống mũi (0..1): mọc từ gốc không gãy, cong `bow`, hoà tròn vào mặt dưới chóp
  const rise = (v: number) => Math.pow(Math.max(v, 0) / vt, N.bow);
  const fall = (v: number) => {
    if (v <= vt) return 2 + (vt - v) * 10;
    const w = Math.min((v - vt) / (1 - vt), 1);
    return 1.04 * (1 - w * w) ** 2;
  };
  const smin = (a: number, b: number, k: number) => {
    const h = Math.max(k - Math.abs(a - b), 0) / k;
    return Math.min(a, b) - (h * h * k) / 4;
  };
  const [nu, nv] = low ? [6, 10] : [28, 48];
  const pos: number[] = [], idx: number[] = [];
  for (let j = 0; j <= nv; j++) {
    const v = j / nv, py = y0 + v * (y1 - y0);
    const ht = Math.max(smin(rise(v), fall(v), 0.35), 0);
    const m = Math.min(v / vt, 1);
    const half = N.wRoot + (N.wTip - N.wRoot) * m ** N.flare;
    // cánh mũi theo dọc: gò quanh `ala.v`, tắt về mép dưới dải (nhân trung)
    const av = A.h > 0 ? Math.exp(-(((v - A.v) / A.vh) ** 2)) * Math.min(1, (1 - v) * 6) : 0;
    for (let i = 0; i <= nu; i++) {
      const u = -1 + (2 * i) / nu;
      // mặt cắt ngang: sống hẹp ở gốc, tròn dần về chóp; tới mép dải thì phẳng hẳn
      const ut = u / (1 + (N.tipW - 1) * m);
      const c = Math.max(1 - ut * ut, 0) ** (N.ridge[0] + (N.ridge[1] - N.ridge[0]) * m);
      const wing = av > 0 ? A.h * av * Math.exp(-(((Math.abs(u) - A.u) / A.w) ** 2)) * (1 - u * u) : 0;
      const [x, y, z] = faceSurface(u * half, py, 1, true);
      // cánh mũi chồng với chóp bằng max mềm: hai gò tách bạch, không cộng thành sống bè
      const hm = wing > 0 ? -smin(-ht * c, -wing, 0.12) : ht * c;
      const h = out * hm - N.sink;
      pos.push(x * r * scale.x, y * r * scale.y, (z + h) * r * scale.z);
    }
  }
  for (let j = 0; j < nv; j++)
    for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i, b = a + 1, c = a + nu + 1, d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return smooth(g);
}

/**
 * Cổ trong nhóm cổ của đầu `human`: từ trong cổ áo lên tới trong đầu theo `HUMAN_NECK_ROWS` (mặt cắt dẹt, mép trước chúi
 * ra trước về dưới hàm, mép sau vào gáy, chân loe thành dốc vai), nửa rộng nhân `k` (`humanNeckWidth`); `rows` đoạn dọc
 * cho `bendNeck` uốn, tối thiểu đủ để mặt nghiêng trơn
 */
/** Nửa sau cổ `human` hẹp bớt bấy nhiêu phần ở giữa gáy, từ hàng 0,2 lên 0,38 (three, hệ khớp cổ) */
const HUMAN_NECK_NAPE = 0.18;
export function neckGeometry(top: number, k = 1, rows = 1) {
  const n = Math.max(rows, 12), m = 32, y0 = -0.02, y1 = top + 0.02;
  const pos: number[] = [], idx: number[] = [];
  for (let j = 0; j <= n; j++) {
    const y = y0 + ((y1 - y0) * j) / n;
    const [a, back, front] = humanNeckAt(y, k);
    for (let i = 0; i < m; i++) {
      const t = (2 * Math.PI * i) / m, c = Math.cos(t);
      // nửa sau thon dần lên trên: góc sau hai bên gáy không lồi khỏi gáy sọ đang thu vào
      const x = a * Math.sin(t) * (c < 0 ? 1 + HUMAN_NECK_NAPE * c * Math.max(0, Math.min(1, (y - 0.2) / 0.18)) : 1);
      pos.push(x, y, c >= 0 ? front * c : -back * c);
    }
  }
  for (let j = 0; j < n; j++)
    for (let i = 0; i < m; i++) {
      const a = j * m + i, b = j * m + ((i + 1) % m), c = a + m, d = b + m;
      idx.push(a, b, d, a, d, c);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
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

/** Bậc siêu elip của mặt cắt giày: nửa trên tròn, nửa dưới gần vuông (đế phẳng); chỗ rộng nhất ở phần này chiều cao từ đáy */
const SHOE_RING = { top: 2.4, bottom: 5, mid: 0.42 };

/**
 * Khối dọc bàn chân, three hệ cổ chân: `n + 1` vòng mặt cắt `at` từ `z0` tới `z1` (dày ở hai đầu), mỗi vòng `m` đỉnh;
 * `cut` chặn đỉnh (miệng giày thấp). Hai đầu khép thì lưới kín.
 */
function shoeLoft(z0: number, z1: number, at: (z: number) => ShoeSection, n: number, m: number, cut?: (z: number) => number) {
  const pos: number[] = [], idx: number[] = [];
  for (let i = 0; i <= n; i++) {
    const z = z0 + (z1 - z0) * (0.5 - 0.5 * Math.cos((Math.PI * i) / n));
    const { half, bottom, top } = at(z), mid = bottom + (top - bottom) * SHOE_RING.mid, c = cut ? cut(z) : Infinity;
    for (let j = 0; j < m; j++) {
      const a = (2 * Math.PI * j) / m, sn = Math.sin(a), cs = Math.cos(a), e = 2 / (cs >= 0 ? SHOE_RING.top : SHOE_RING.bottom);
      const x = half * Math.sign(sn) * Math.abs(sn) ** e;
      const y = cs >= 0 ? mid + (top - mid) * cs ** e : mid - (mid - bottom) * (-cs) ** e;
      pos.push(x / 100, Math.min(y, c) / 100, z / 100);
    }
  }
  for (let i = 0; i < n; i++)
    for (let j = 0; j < m; j++) {
      const a = i * m + j, b = i * m + ((j + 1) % m), c = a + m, d = b + m;
      idx.push(a, d, b, a, c, d);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  return smooth(g);
}

/** Đế dưới khối `F`: theo mặt đế nhìn từ trên, dày `t` px */
const soleLoft = (F: ShoeForm, t: number, n: number, m: number) => shoeLoft(F.back, F.tip, (z) => {
  const p = F.plan(z);
  return { half: p.half, bottom: p.bottom, top: p.bottom + t };
}, n, m);

/**
 * Dải quai ôm khối `F` ở `zc` (px), rộng `w`, nổi `g` px trên mặt; hai mép chìm vào trong khối nên không cần nắp. Đáy dải
 * nằm trong đế
 */
function strapLoft(F: ShoeForm, zc: number, w: number, g: number, m: number) {
  const at = (z: number) => {
    const d = Math.abs(z - zc) - w / 2, k = d <= 0 ? g : g - (g + 1) * Math.min(1, d / 0.4);
    const s = F.at(z);
    return { half: Math.max(0, s.half + k), bottom: s.bottom - 0.5, top: s.top + k };
  };
  return shoeLoft(zc - w / 2 - 0.4, zc + w / 2 + 0.4, at, 8, m);
}

/** Khối gót của giày có gót: dưới lòng giày ở gót, từ lưng gót tới `length`, mặt trước phẳng */
function heelLoft(F: ShoeForm, n: number, m: number) {
  // khối gót liền đế tới chỗ lòng giày hạ về sàn: không hở vòm
  let z1 = F.back + 1;
  while (z1 < F.tip && F.plan(z1).bottom > F.floor + 0.2) z1 += 0.25;
  return shoeLoft(F.back, z1, (z) => {
    const p = F.plan(z), f = Math.sqrt(1 - Math.max(0, (z - (z1 - 1.5)) / 1.5) ** 2);
    return { half: p.half * 0.88 * f, bottom: F.floor, top: p.bottom + 0.5 };
  }, n, m);
}

/** Khối của giày kiểu `kind` bên `side` (three, hệ cổ chân), nửa bề dày chân `legHalf` px. `low`: lưới thưa cho người nền */
export interface ShoeParts {
  /** Vỏ giày (màu giày); dép hở thì không có */
  upper?: THREE.BufferGeometry;
  /** Đế, khối gót (màu đế) */
  sole: THREE.BufferGeometry;
  heel?: THREE.BufferGeometry;
  /** Bàn chân trong giày miệng thấp, dép hở (màu da hay màu tất); ngón của dép hở */
  foot?: THREE.BufferGeometry;
  toes: THREE.BufferGeometry[];
  /** Quai dép (màu giày) */
  straps: THREE.BufferGeometry[];
}

// ống tròn thon từ gốc `(x, y0, z0)` bán kính `r0` tới đầu `(x, y1, z1)` bán kính `r1`, hai đầu tròn
function toeTube([x, y0, z0, y1, z1, r0, r1]: number[], low: boolean) {
  const g = new THREE.CapsuleGeometry(1, 1, low ? 3 : 6, low ? 6 : 12), q = g.attributes.position;
  const len = Math.hypot(y1 - y0, z1 - z0), dy = (y1 - y0) / len, dz = (z1 - z0) / len;
  for (let i = 0; i < q.count; i++) {
    const v = q.getY(i), s = Math.min(1, Math.max(0, v + 0.5)), k = r0 + (r1 - r0) * s;
    const a = s * len + (v < -0.5 ? (v + 0.5) * k : v > 0.5 ? (v - 0.5) * k : 0), u = q.getZ(i) * k;
    q.setXYZ(i, (x + q.getX(i) * k) / 100, (y0 + a * dy + u * dz) / 100, (z0 + a * dz - u * dy) / 100);
  }
  g.computeVertexNormals();
  return g;
}

/**
 * Khối giày theo `SHOE_STYLES[kind]` của lõi: vỏ giày từ `shoeForm` (lưng gót gần thẳng hàng mặt sau ống chân), đế dày
 * `sole` theo mặt đế, khối gót `heel`, miệng thấp `cut` lộ bàn chân, dép hở `open` (bàn chân, ngón `shoeToes`, quai).
 * Cổ ủng `shaft` bám cẳng chân nên `stickman.ts` dựng nó trên ống chân. docs/12-trang-phuc-3d.md#giày-dép
 */
export function shoeMesh(kind: string, legHalf: number, side: -1 | 1, low = false): ShoeParts {
  const { S } = shoeFit(kind, legHalf);
  const [n, m] = low ? [14, 10] : [40, 28];
  const out: ShoeParts = { sole: soleLoft(shoeForm(kind, legHalf, 0.45), S.sole, n, m), toes: [], straps: [] };
  if (S.open) {
    // bàn chân trần nhỏ hơn dáng giày `SHOE_CLEAR`: lưng gót, hai bên gót trùng mặt ống chân
    const F = shoeForm(kind, legHalf, -SHOE_CLEAR, true);
    out.foot = shoeLoft(F.back, F.tip, F.at, n, m);
    for (const t of shoeToes(kind, legHalf, side)) out.toes.push(toeTube(t, low));
    const L = F.tip - F.back;
    for (const u of S.open.straps) out.straps.push(strapLoft(F, F.back + u * L, 0.11 * L, 0.9, m));
  } else {
    const F = shoeForm(kind, legHalf);
    out.upper = shoeLoft(F.back, F.tip, F.at, n, m, S.cut && ((z) => shoeCut(kind, legHalf, z)));
    if (S.cut) {
      const B = shoeForm(kind, legHalf, -SHOE_CLEAR);
      out.foot = shoeLoft(B.back, B.tip, B.at, n, m);
    }
  }
  if (S.heel) out.heel = heelLoft(shoeForm(kind, legHalf), low ? 10 : 24, m);
  return out;
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
