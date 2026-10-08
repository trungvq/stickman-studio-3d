import * as THREE from 'three';
import { canvasTexture, decal, type CanvasSurface } from './decal';
import { U } from './khoi';
import { npr, surface } from './npr';

// Món có phần chạy theo `t` mà repo video đặt vào phòng: đồng hồ tường, lịch bàn lật trang, màn hình. Cỡ tính px rig;
// mỗi món là một nhóm three gốc ở chỗ dựa (tâm mặt tường, đáy món trên bàn), mặt trước nhìn +z. Đặt bằng
// `position.copy(toThree(at))` và `rotation.y`.

type Color = THREE.ColorRepresentation;

/** Lưới phẳng mặt cắt `pts` (z, y) đùn theo x từ `x0` tới `x1`, pháp tuyến phẳng từng mặt */
function prism(pts: [number, number][], x0: number, x1: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const quad = (a: number[], b: number[], c: number[], d: number[]) => pos.push(...a, ...b, ...c, ...a, ...c, ...d);
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const [za, ya] = pts[i], [zb, yb] = pts[(i + 1) % n];
    quad([x0, ya, za], [x1, ya, za], [x1, yb, zb], [x0, yb, zb]);
  }
  for (let i = 1; i + 1 < n; i++) {
    pos.push(x1, pts[0][1], pts[0][0], x1, pts[i + 1][1], pts[i + 1][0], x1, pts[i][1], pts[i][0]);
    pos.push(x0, pts[0][1], pts[0][0], x0, pts[i][1], pts[i][0], x0, pts[i + 1][1], pts[i + 1][0]);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos.map((v) => v * U), 3));
  g.computeVertexNormals();
  return g;
}

const mesh = (g: THREE.BufferGeometry, m: THREE.Material) => new THREE.Mesh(g, m);

// ---------------------------------------------------------------- đồng hồ tường

export interface WallClockOptions {
  /** Bán kính (px). Mặc định 42. */
  r?: number;
  /** Bề dày vỏ (px). Mặc định 7. */
  depth?: number;
  rim?: Color;
  face?: Color;
  ink?: Color;
  /** Kim giây đỏ */
  second?: boolean;
  /** Số 12, 3, 6, 9 trên mặt */
  numbers?: boolean;
}

export interface WallClock {
  group: THREE.Group;
  /** Giờ số thực: 9,5 là 9:30; giảm dần là kim quay ngược (tua 15:00 → 8:30 là 15 → 8,5) */
  set(hours: number): void;
}

/** Đồng hồ treo tường: gốc ở tâm sau vỏ (áp mặt tường), mặt nhìn +z. Mặt số là texture tĩnh, kim là khối có bóng. */
export function wallClock(o: WallClockOptions = {}): WallClock {
  const r = o.r ?? 42, depth = o.depth ?? 7, ink = new THREE.Color(o.ink ?? '#1c1c1e').getStyle();
  const group = new THREE.Group();
  const rim = npr({ color: o.rim ?? '#2a2a2d', stipple: 0.05 });
  const lip = depth + 2.2;
  // điểm góc lặp đôi: LatheGeometry giữ pháp tuyến gãy ở góc thay vì vuốt tròn
  const profile = [[0, 0], [r, 0], [r, 0], [r, lip], [r, lip], [r * 0.9, lip], [r * 0.9, lip], [r * 0.9, depth]];
  const body = new THREE.LatheGeometry(profile.map(([x, y]) => new THREE.Vector2(x * U, y * U)), 40);
  body.rotateX(Math.PI / 2);
  group.add(mesh(body, rim));
  const dial = canvasTexture(512, 512, (ctx) => {
    ctx.fillStyle = new THREE.Color(o.face ?? '#ffffff').getStyle();
    ctx.fillRect(0, 0, 512, 512);
    ctx.translate(256, 256);
    ctx.strokeStyle = ctx.fillStyle = ink;
    ctx.lineCap = 'butt';
    for (let i = 0; i < 60; i++) {
      const big = i % 15 === 0, hour = i % 5 === 0, a = (i * Math.PI) / 30;
      ctx.lineWidth = big ? 16 : hour ? 8 : 3;
      const r0 = big ? 170 : hour ? 190 : 220;
      ctx.beginPath();
      ctx.moveTo(Math.sin(a) * r0, -Math.cos(a) * r0);
      ctx.lineTo(Math.sin(a) * 240, -Math.cos(a) * 240);
      ctx.stroke();
    }
    if (o.numbers) {
      ctx.font = '600 64px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (const [n, a] of [[12, 0], [3, 90], [6, 180], [9, 270]]) ctx.fillText(String(n), Math.sin((a * Math.PI) / 180) * 128, -Math.cos((a * Math.PI) / 180) * 128 + 4);
    }
  });
  dial.update(0);
  const face = mesh(new THREE.CircleGeometry(r * 0.9 * U, 48), surface({ map: dial.texture, stipple: 0.03 }));
  face.position.z = depth * U;
  face.userData.noShadow = true;
  group.add(face);
  const handMat = npr({ color: o.ink ?? '#1c1c1e', stipple: 0 });
  const hand = (lenPx: number, w: number, z: number, m: THREE.Material) => {
    const g = new THREE.BoxGeometry(w * U, lenPx * 1.18 * U, 1.1 * U);
    g.translate(0, lenPx * 0.41 * U, 0);
    const pivot = new THREE.Group();
    pivot.position.z = (depth + z) * U;
    pivot.add(mesh(g, m));
    group.add(pivot);
    return pivot;
  };
  const hh = hand(r * 0.5, 4, 0.9, handMat), mh = hand(r * 0.76, 2.6, 2.1, handMat);
  const sh = o.second ? hand(r * 0.8, 1, 3.3, npr({ color: '#d9534f', stipple: 0 })) : null;
  const cap = mesh(new THREE.CylinderGeometry(3 * U, 3 * U, 4.4 * U, 16).rotateX(Math.PI / 2), handMat);
  cap.position.z = (depth + 2) * U;
  group.add(cap);
  const turn = (x: number) => -x * Math.PI * 2;
  return {
    group,
    set(hours) {
      hh.rotation.z = turn(hours / 12);
      mh.rotation.z = turn(hours);
      if (sh) sh.rotation.z = turn(hours * 60);
    },
  };
}

// ---------------------------------------------------------------- lịch bàn

export interface DeskCalendarOptions {
  /** Số trang */
  pages: number;
  /** Vẽ trang `page` lên canvas `w`×`h` px; chỉ gọi khi trang ấy vừa lên mặt */
  draw: (ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D, page: number, w: number, h: number) => void;
  /** Cỡ trang (px). Mặc định 64×48. */
  w?: number;
  h?: number;
  /** Bề sâu chân đế chữ A (px). Mặc định 34. */
  depth?: number;
  stand?: Color;
  ring?: Color;
  /** Màu mặt sau trang */
  back?: Color;
  /** Bề ngang texture trang (px canvas). Mặc định 512. */
  px?: number;
}

export interface DeskCalendar {
  group: THREE.Group;
  /**
   * Trang số thực: phần nguyên là trang đang trên mặt, phần lẻ là trang ấy đang lật qua gáy ra sau (3,4 là trang 3 lật
   * được 40%, trang 4 lộ ra dưới). Giảm dần là lật ngược.
   */
  set(page: number): void;
}

/** Lịch bàn chữ A: gốc ở giữa đáy chân đế, mặt trước nhìn +z, trang treo ở gáy vòng trên đỉnh và lật qua gáy ra sau. */
export function deskCalendar(o: DeskCalendarOptions): DeskCalendar {
  const w = o.w ?? 64, h = o.h ?? 48, d = o.depth ?? 34, px = o.px ?? 512, ph = Math.round((px * h) / w);
  const H = h + 6, half = d / 2;
  const group = new THREE.Group();
  const stand = mesh(prism([[half, 0], [0, H], [-half, 0]], -w / 2 - 3, w / 2 + 3), npr({ color: o.stand ?? '#3b3f46', stipple: 0.05 }));
  group.add(stand);
  // gáy vòng nằm ngang trên đỉnh
  const ringMat = npr({ color: o.ring ?? '#b9bcc2', stipple: 0 });
  for (let i = 0; i < 9; i++) {
    const ring = mesh(new THREE.TorusGeometry(2.6 * U, 0.6 * U, 6, 16), ringMat);
    ring.rotation.y = Math.PI / 2;
    ring.position.set((-w / 2 + 4 + ((w - 8) * i) / 8) * U, (H + 1.6) * U, 0);
    group.add(ring);
  }
  const alpha = Math.atan2(half, H);
  const hinge = new THREE.Vector2(0, H + 1.6);
  /** Một trang theo đường gập: góc tiếp tuyến từ gáy xuống, 0 là thẳng xuống, dương là ngả ra trước */
  const pageGeo = () => new THREE.PlaneGeometry(w * U, h * U, 1, 20);
  const bendPage = (g: THREE.BufferGeometry, f: number, lift: number) => {
    const p = g.attributes.position, uv = g.attributes.uv;
    const L = 0.55, n = 20, ys: number[] = [], zs: number[] = [];
    let y = hinge.y + 0.3, z = lift;
    for (let k = 0; k <= n; k++) {
      ys.push(y);
      zs.push(z);
      const s = (k + 0.5) / n;
      const g2 = Math.min(1, Math.max(0, f * (1 + L) - L * s));
      const phi = alpha + (2 * Math.PI - 2 * alpha) * (g2 * g2 * (3 - 2 * g2));
      y -= Math.cos(phi) * (h / n);
      z += Math.sin(phi) * (h / n);
    }
    for (let i = 0; i < p.count; i++) {
      const k = Math.round((1 - uv.getY(i)) * n);
      p.setXYZ(i, p.getX(i), ys[k] * U, zs[k] * U);
    }
    p.needsUpdate = true;
    g.computeVertexNormals();
    g.computeBoundingSphere();
  };
  const surfaces = [0, 1].map(() => {
    let page = -1;
    const s = canvasTexture(px, ph, (ctx) => o.draw(ctx, page, px, ph), { key: () => page });
    return { s, show(p: number) { page = p; s.update(0); } };
  });
  const back = surface({ color: o.back ?? '#ece8de', side: 'back', offset: false });
  const under = new THREE.Group(), flip = new THREE.Group();
  const underGeo = pageGeo(), flipGeo = pageGeo();
  // trang dưới phẳng trên mặt trước; trang đang lật nhích ra ngoài một chút cho khỏi giành điểm ảnh lúc mới nhấc
  bendPage(underGeo, 0, 0.6);
  under.add(mesh(underGeo, surface({ map: surfaces[0].s.texture, offset: false })));
  flip.add(mesh(flipGeo, surface({ map: surfaces[1].s.texture, offset: false })), mesh(flipGeo, back));
  group.add(under, flip);
  return {
    group,
    set(page) {
      const p = Math.min(o.pages - 1, Math.max(0, page));
      const i = Math.floor(p), f = p - i;
      if (f < 1e-4) {
        surfaces[0].show(i);
        flip.visible = false;
        return;
      }
      surfaces[0].show(i + 1);
      surfaces[1].show(i);
      flip.visible = true;
      bendPage(flipGeo, f, 1.2);
    },
  };
}

// ---------------------------------------------------------------- màn hình

export interface MonitorOptions {
  /** Nội dung màn hình: `canvasTexture` (gọi `update(t)` của nó mỗi khung) hay texture */
  screen: CanvasSurface | THREE.Texture;
  /** Cỡ vùng sáng (px). Mặc định 150×88. */
  w?: number;
  h?: number;
  /** Viền (px). Mặc định 5. */
  bezel?: number;
  /** Cao từ mặt bàn tới mép dưới viền (px). Mặc định 26. */
  lift?: number;
  body?: Color;
  /** 1 là màn hình tự sáng đúng màu texture (đọc được trong phòng tối), 0 là nhận đèn như giấy. Mặc định 1. */
  glow?: number;
}

export interface Monitor {
  group: THREE.Group;
  /** Mặt kính: gốc ở tâm vùng sáng, +z ra trước, x sang phải màn hình (three). Gắn giấy nhớ, khung chat vào đây. */
  face: THREE.Group;
  screen: THREE.Mesh;
  /** Cỡ vùng sáng, đơn vị three */
  size: { w: number; h: number };
}

/** Màn hình để bàn: gốc ở giữa đáy chân đế trên mặt bàn, màn nhìn +z. */
export function monitor(o: MonitorOptions): Monitor {
  const w = o.w ?? 150, h = o.h ?? 88, b = o.bezel ?? 5, lift = o.lift ?? 26, depth = 4;
  const body = npr({ color: o.body ?? '#26272b', stipple: 0.04 });
  const group = new THREE.Group();
  const box = (x: number, y: number, z: number, cx: number, cy: number, cz: number) => {
    const m = mesh(new THREE.BoxGeometry(x * U, y * U, z * U), body);
    m.position.set(cx * U, cy * U, cz * U);
    group.add(m);
    return m;
  };
  const cy = lift + b + h / 2;
  box(w * 0.36, 2, 26, 0, 1, -6);
  box(10, lift + h * 0.4, 3, 0, (lift + h * 0.4) / 2, -6);
  box(w + 2 * b, h + 2 * b, depth, 0, cy, -6 + depth / 2 + 1.5);
  const face = new THREE.Group();
  face.position.set(0, cy * U, (-6 + depth + 1.5) * U);
  group.add(face);
  const map = (o.screen as THREE.Texture).isTexture ? (o.screen as THREE.Texture) : (o.screen as CanvasSurface).texture;
  const screen = decal(surface({ map, glow: o.glow ?? 1, stipple: 0 }), w, h);
  screen.position.z = 0.15 * U;
  face.add(screen);
  return { group, face, screen, size: { w: w * U, h: h * U } };
}
