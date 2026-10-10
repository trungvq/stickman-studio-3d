import { D, SCULPT_DEPTH, SCULPT_FLARE, SCULPT_HANG_FROM, SCULPT_TEMPLE, SCULPT_TUCK } from './core/constants';
import { SculptSchema, type Sculpt } from './core/schema';
import {
  bangAt, BUN_SEG, cross, CROWN_EASE, crownLat, curlCenters, dot, fromPart, hairline, HANG_EASE, hash, KNOT_RING, lockRings, NJ, NK, NT, partPlane, PONY_SEG, RING, rootLat, rowEase, SCULPT_STYLES, shellLift, spikeRings, step,
  type Spike,
} from './core/sculpt';
import { onSkull, type Vec3 } from './core/sphere';

// Tóc dựng khối từ bảng kiểu và các hàm dựng vỏ, chân tóc, mái lệch, lọn gai của lõi: như `sculptPaths` nhưng
// giữ lưới 3D thay vì chiếu ra path SVG.

/** Nét trên mặt vỏ như `buildSculpt`: đường ngôi, nét cắt, đường cong và khe búp xoăn; lọn dẹt có khối nên không vẽ nét; mẩu ngắn hơn một phần tư bị bỏ */
function hairLines(s: Sculpt, lines: Vec3[][]) {
  const def = SCULPT_STYLES[s.style];
  const rim = def.rim ?? 0.3;
  const trace = (pts: (Vec3 | undefined)[]) => {
    const least = Math.max(2, Math.ceil(pts.length / 4));
    let run: Vec3[] = [];
    const flush = () => {
      if (run.length >= least) lines.push(run);
      run = [];
    };
    for (const q of pts) if (q) run.push(q); else flush();
    flush();
  };
  const onShell = (lon: number, lat: number) => {
    const low = rootLat(s, lon);
    const j = ((lat - low) / (90 - low)) * NJ;
    return onSkull(lon, lat, shellLift(s, lon, lat, rowEase(j, s.style), rim * s.volume));
  };
  const lift = ([x, y, z]: Vec3) => onShell(Math.atan2(x, z) / D, Math.asin(y) / D);
  const side = Math.sign(s.part || 1);
  const from = hairline(s, s.part) - 2;
  const [n, c] = partPlane(s);
  const r0 = Math.sqrt(1 - c * c);
  const vert: Vec3 = [0, 1, 0];
  const ahead: Vec3 = [-n[2] * side, 0, Math.abs(n[0])];
  if (def.crease && !def.fringe) {
    const a0 = Math.asin(Math.sin(from * D) / r0) / D;
    trace(Array.from({ length: 17 }, (_, k) => {
      const a = (a0 + ((100 - a0) * k) / 16) * D;
      return lift(n.map((v, d) => v * c + r0 * (ahead[d] * Math.cos(a) + vert[d] * Math.sin(a))) as Vec3);
    }));
  } else if (!def.jag && !def.fringe && !def.crease && !def.crown && !def.pony && !def.bun)
    trace(Array.from({ length: 9 }, (_, k) => onShell(s.part - side * 3 * (k / 8), from + ((62 - from) * k) / 8)));
  if (def.cut) {
    const [at, , , rise = 12] = def.cut;
    const lon = s.part - side * (at + 1);
    const low = hairline(s, lon);
    trace(Array.from({ length: 9 }, (_, k) => {
      const v = k / 8;
      return onShell(lon - side * 7 * (1 - (1 - v) ** 2), low + 1 + rise * v);
    }));
  }
  for (const curve of def.curves ?? []) {
    const control = curve.map(([u, lat]) => onSkull(s.part - side * u, lat));
    trace(Array.from({ length: 49 }, (_, k) => {
      const v = k / 48;
      let row = control;
      while (row.length > 1) row = row.slice(1).map((p, i) => p.map((a, d) => row[i][d] * (1 - v) + a * v) as Vec3);
      const r = Math.hypot(...row[0]);
      const p = row[0].map((a) => a / r) as Vec3;
      const lon = Math.atan2(p[0], p[2]) / D;
      return Math.asin(p[1]) / D >= rootLat(s, lon) ? lift(p) : undefined;
    }));
  }
  if (def.curls && def.curlArc) {
    const [r, , count] = def.curls;
    const [at, a0, a1] = def.curlArc;
    const rho = at * r * D;
    for (const cc of curlCenters(count)) {
      const e = Math.atan2(cc[0], cc[2]);
      const east: Vec3 = [Math.cos(e), 0, -Math.sin(e)];
      const north = cross(cc, east);
      trace(Array.from({ length: 13 }, (_, k) => {
        const a = (a0 + ((a1 - a0) * k) / 12) * D;
        const p = cc.map((v, d) => v * Math.cos(rho) + (east[d] * Math.cos(a) + north[d] * Math.sin(a)) * Math.sin(rho)) as Vec3;
        const lon = Math.atan2(p[0], p[2]) / D;
        return Math.asin(p[1]) / D >= rootLat(s, lon) + 3 ? lift(p) : undefined;
      }));
    }
  }
}

/**
 * Lưới tóc trong hệ sọ đơn vị (y lên, z ra trước mặt), đầu thẳng: `shell` vỏ và vách chân tóc, `spikes` lọn gai,
 * đuôi ngựa và búi, `hang` mặt rủ, mỗi phần là dãy tam giác; `lines` nét trên mặt vỏ (ngôi, nét chải, khe búp xoăn).
 */
export interface SculptMesh {
  shell: Vec3[][];
  spikes: Vec3[][];
  hang: Vec3[][];
  lines: Vec3[][];
}

export function sculptMesh(raw: Partial<Sculpt>): SculptMesh {
  const s = SculptSchema.parse(raw);
  const def = SCULPT_STYLES[s.style];
  const rim = def.rim ?? 0.3;
  const hanging = s.length > 0;
  const hangFrom = def.hangFrom ?? SCULPT_HANG_FROM;
  const g: Vec3 = [0, -1, 0];
  const up = -1;
  const out: SculptMesh = { shell: [], spikes: [], hang: [], lines: [] };
  /** Tam giác quay mặt ra xa `ref` (mặc định tâm sọ): viền vỏ ngược và bóng cần pháp tuyến ra ngoài */
  const tri = (to: Vec3[][], t: Vec3[], ref: Vec3 = [0, 0, 0]) => {
    const [a, b, c] = t;
    const n = cross([b[0] - a[0], b[1] - a[1], b[2] - a[2]], [c[0] - a[0], c[1] - a[1], c[2] - a[2]]);
    const m: Vec3 = [(a[0] + b[0] + c[0]) / 3 - ref[0], (a[1] + b[1] + c[1]) / 3 - ref[1], (a[2] + b[2] + c[2]) / 3 - ref[2]];
    to.push(dot(n, m) < 0 ? [a, c, b] : t);
  };
  const quad = (to: Vec3[][], [a, b, c, d]: Vec3[], ref?: Vec3) => (tri(to, [a, b, c], ref), tri(to, [a, c, d], ref));
  const mid = (r: Vec3[]) => r.reduce((m, p) => [m[0] + p[0] / r.length, m[1] + p[1] / r.length, m[2] + p[2] / r.length], [0, 0, 0] as Vec3);
  const temple = (p: Vec3, lat: number): Vec3 =>
    hanging && p[2] > 0 ? [p[0], p[1], p[2] * (1 - SCULPT_TEMPLE * (1 - step(0, 40, lat)))] : p;

  const cols = Array.from({ length: NT + 1 }, (_, i) => {
    const lon = -180 + (i * 360) / NT;
    const a = Math.abs(lon);
    const hang = hanging && a >= hangFrom - 1e-6;
    const ease = def.hangEase ?? HANG_EASE;
    const w = hanging ? step(hangFrom - ease, hangFrom, a) : 0;
    const fall = hanging ? Math.max(0, Math.min(1, (a - hangFrom + ease) / ease)) ** 3 : 0;
    const h = rootLat(s, lon);
    const leave = w > 0 ? Math.atan2(dot(onSkull(lon, 0), g), -up) / D : h;
    const low = h + (leave - h) * fall;
    const thick = bangAt(s, lon)[1];
    const base = Math.max(rim * s.volume, s.bangThick * thick) * (1 - w) + s.volume * w;
    const high = crownLat(s, lon, low);
    const rowE = (lat: number, j: number) =>
      def.crown ? step(0, CROWN_EASE, lat - low) * step(0, CROWN_EASE, high - lat) : rowEase(j, s.style);
    const shell: Vec3[] = [];
    for (let j = 0; j <= NJ; j++) {
      const lat = low + ((high - low) * j) / NJ;
      shell.push(temple(onSkull(lon, lat, shellLift(s, lon, lat, rowE(lat, j), base)), lat));
    }
    return { lon, hang, bare: high - low < 0.5, shell, skin: temple(onSkull(lon, low, 0), low), top: onSkull(lon, high, 0) };
  });
  const clad = (i: number) => !cols[i].bare && !cols[i + 1].bare;

  for (let i = 0; i < NT; i++) {
    const [A, B] = [cols[i], cols[i + 1]];
    if (!clad(i)) continue;
    for (let j = 0; j < NJ; j++) quad(out.shell, [A.shell[j], B.shell[j], B.shell[j + 1], A.shell[j + 1]]);
    if (!(A.hang && B.hang)) quad(out.shell, [A.skin, A.shell[0], B.shell[0], B.skin]);
    if (def.crown) quad(out.shell, [A.top, A.shell[NJ], B.shell[NJ], B.top]);
  }

  /** Ống từ các vòng tiết diện, phần tử cuối là mũi: nắp chân, thân, chóp */
  const tube = (rings: Vec3[][]) => {
    const tip = rings[rings.length - 1][0];
    for (let r = 1; r + 1 < RING; r++) tri(out.spikes, [rings[0][0], rings[0][r], rings[0][r + 1]], tip);
    for (let m = 0; m + 1 < rings.length; m++) {
      const c = mid(rings[m]);
      for (let r = 0; r < RING; r++) {
        const [a, b] = [rings[m][r], rings[m][(r + 1) % RING]];
        const next = rings[m + 1];
        if (next.length === 1) tri(out.spikes, [a, b, next[0]], c);
        else quad(out.spikes, [a, b, next[(r + 1) % RING], next[r]], c);
      }
    }
  };
  if (s.spike > 0)
    for (const [k, base, arch] of [
      ...def.spikes.map((k) => [k, s.volume, 0.55] as const),
      ...(def.swept ?? []).map(([u, lat, len, heading, bend, width]) => {
        const side = Math.sign(s.part || 1);
        const lon = s.part - side * u;
        const low = rootLat(s, lon);
        const j = ((lat - low) / (90 - low)) * NJ;
        return [
          [lon, lat, len, -side * heading, bend, width] as Spike,
          shellLift(s, lon, lat, rowEase(j, s.style), rim * s.volume),
          def.sweptArch ?? 0.55,
        ] as const;
      }),
    ]) tube(spikeRings(s, k, base, arch));
  if (s.spike > 0) for (const k of def.locks ?? []) tube(lockRings(s, k));

  if (hanging) {
    const fwd: Vec3 = [0, 0, 1];
    const sheet = (root: Vec3, lon: number): Vec3[] => {
      const [tw, td, rounded = false, jitter = 0] = def.tips ?? [1, 0];
      const k0 = fromPart(s, lon) / tw;
      const scallop = rounded ? Math.sin(Math.PI * k0) ** 2 : Math.abs(2 * (k0 - Math.round(k0))) ** 0.7;
      const len = s.length - td * scallop - jitter * hash(Math.round(k0)) * (1 - scallop);
      const along = dot(root, g);
      const radial = root.map((v, d) => v - along * g[d]) as Vec3;
      const n = Math.hypot(...radial) || 1;
      const outward = radial.map((v, d) => v - (1 - SCULPT_DEPTH) * dot(radial, fwd) * fwd[d]);
      return Array.from({ length: NK + 1 }, (_, k) => {
        const v = k / NK;
        const d = (len - along) * v;
        const [start, bend, turn = 0] = def.curl ?? [0, 0];
        const [width, depth] = def.wave ?? [360, 0];
        const wave = depth * Math.sin(2 * Math.PI * v) * Math.cos((fromPart(s, lon) * 2 * Math.PI) / width);
        const fl = ((def.flare ?? SCULPT_FLARE) * v * v + bend * step(start, 0.85, v) - turn * step(0.85, 1, v) + wave) / n;
        const m = g.map((gd, i) => gd * d + outward[i] * fl) as Vec3;
        const ahead = dot(root, fwd) + dot(m, fwd);
        const tuck = ahead > 0 ? -ahead * SCULPT_TUCK * (1 - (1 - v) ** 2) : 0;
        return root.map((r, i) => r + m[i] + fwd[i] * tuck) as Vec3;
      });
    };
    const hung = cols.map((c) => (c.hang ? { outer: sheet(c.shell[0], c.lon), inner: sheet(c.skin, c.lon) } : undefined));
    for (let i = 0; i < NT; i++) {
      const [A, B] = [hung[i], hung[i + 1]];
      if (A && B) {
        for (let k = 0; k < NK; k++) {
          const axis: Vec3 = [0, A.outer[k][1], 0];
          quad(out.hang, [A.outer[k], B.outer[k], B.outer[k + 1], A.outer[k + 1]], axis);
          quad(out.hang, [A.inner[k], B.inner[k], B.inner[k + 1], A.inner[k + 1]], axis);
        }
        quad(out.hang, [A.outer[NK], B.outer[NK], B.inner[NK], A.inner[NK]], [0, 0, 0]);
      }
      const E = A && !B ? A : B && !A ? B : undefined;
      if (E) for (let k = 0; k < NK; k++) quad(out.hang, [E.inner[k], E.outer[k], E.outer[k + 1], E.inner[k + 1]]);
    }
  }

  hairLines(s, out.lines);

  if (def.pony || def.bun) {
    const n = onSkull(180, s.tie);
    const east: Vec3 = [1, 0, 0];
    const unit = (v: Vec3, alt: Vec3) => {
      const k = Math.hypot(...v);
      return k > 1e-3 ? (v.map((a) => a / k) as Vec3) : alt;
    };
    const rings: Vec3[][] = [];
    const ring = (c: Vec3, u: Vec3, w: Vec3, r: number, flat = 1) =>
      rings.push(Array.from({ length: KNOT_RING }, (_, i) => {
        const a = (i / KNOT_RING) * 2 * Math.PI;
        return c.map((v, d) => v + (u[d] * Math.cos(a) + w[d] * Math.sin(a) * flat) * r) as Vec3;
      }));
    if (def.pony) {
      const [width, arch, flat] = def.pony;
      const anchor = onSkull(180, s.tie, 0);
      const at = (a: number, b: number): Vec3 => anchor.map((v, d) => v + n[d] * arch * a + g[d] * s.tail * b) as Vec3;
      const P = [anchor, at(1, 0), at(1.1, 0.45), at(0.8, 1)];
      const b = unit(cross(n, g), east);
      const radius = (v: number) => width * (0.3 + 0.7 * step(0, 0.3, v)) * (1 - v ** 3);
      // trục lọt vào trong đầu thì đẩy ra theo bán kính như softplus: đuôi ôm gáy chứ không xuyên sọ
      const centers = Array.from({ length: PONY_SEG + 1 }, (_, k) => {
        const v = k / PONY_SEG;
        const c = P[0].map((_, d) => (1 - v) ** 3 * P[0][d] + 3 * (1 - v) ** 2 * v * P[1][d] + 3 * (1 - v) * v * v * P[2][d] + v ** 3 * P[3][d]) as Vec3;
        const len = Math.hypot(...c);
        const clear = 1 + s.volume + radius(v) * 0.9;
        const soft = clear + 0.05 * Math.log1p(Math.exp((len - clear) / 0.05));
        const k0 = 1 + (soft / len - 1) * step(0.04, 0.2, v);
        return c.map((a) => a * k0) as Vec3;
      });
      centers.forEach((c, k) => {
        const tan = centers[Math.min(k + 1, PONY_SEG)].map((a, d) => a - centers[Math.max(k - 1, 0)][d]) as Vec3;
        ring(c, b, unit(cross(b, tan), n), radius(k / PONY_SEG), flat);
      });
    } else {
      const [radius, squash] = def.bun!;
      const h = radius * squash;
      const anchor = onSkull(180, s.tie, s.volume + h * 0.35);
      const b = unit(cross(n, east), east);
      const m = cross(n, b);
      for (let k = 0; k <= BUN_SEG; k++) {
        const u = -1 + (2 * k) / BUN_SEG;
        ring(anchor.map((v, d) => v + n[d] * u * h) as Vec3, b, m, radius * Math.sqrt(Math.max(0, 1 - u * u)));
      }
    }
    for (let k = 0; k + 1 < rings.length; k++) {
      const c = mid([...rings[k], ...rings[k + 1]]);
      for (let r = 0; r < KNOT_RING; r++) {
        const r1 = (r + 1) % KNOT_RING;
        quad(out.spikes, [rings[k][r], rings[k][r1], rings[k + 1][r1], rings[k + 1][r]], c);
      }
    }
    for (const end of [rings[0], rings[rings.length - 1]]) {
      const c = mid(end);
      for (let r = 0; r < KNOT_RING; r++) tri(out.spikes, [c, end[r], end[(r + 1) % KNOT_RING]], mid(rings[Math.floor(rings.length / 2)]));
    }
  }
  return out;
}
