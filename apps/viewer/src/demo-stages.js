import * as THREE from 'three';
import { createStage, room, setLights, setPalette, stickman } from '@stickman3d/rig';
import { BOY, GIRL } from './demos.js';

// Hai sân khấu cùng trang (`?demo=stages`), như hai `<Sequence>` chồng nhau: A phòng ngày có nắng qua cửa, B phòng
// đêm chỉ đèn bàn. Mỗi khung `update` đặt lại bộ đèn của phòng mình. Vẽ A một mình làm mẫu, dựng B, vẽ xen kẽ
// A B A B rồi so từng điểm ảnh với lần vẽ đầu: lệch là trạng thái đèn của sân khấu này lọt sang sân khấu kia.

function side(host, x, palette, lamps, who) {
  const canvas = document.createElement('canvas');
  canvas.style.cssText = `position:absolute;top:0;left:${x}px;width:640px;height:720px`;
  host.appendChild(canvas);
  const r = room({
    x: [-500, 500], z: [-400, 500], height: 700,
    windows: [{ wall: 'left', u: 450, width: 500, height: 320, sill: 220, panes: [3, 2] }],
    doors: [{ wall: 'back', u: 700, hinge: 'right' }],
  });
  const fig = stickman(who);
  fig.root.position.set(0.5, 0, 0);
  fig.root.rotation.y = -0.4;
  const camera = new THREE.PerspectiveCamera(30, 640 / 720, 0.3, 150);
  camera.position.set(2, 6, 17);
  camera.lookAt(0, 2.4, 0);
  const stage = createStage({
    canvas, size: { w: 640, h: 720 }, aa: 'ss2', camera,
    light: () => setPalette(palette),
    update: (t, st) => {
      r.cull(st.camera);
      setLights(r.lights({ lamps }));
    },
  });
  stage.scene.add(r.group, fig.root);
  return stage;
}

const pixels = (stage) => {
  const gl = stage.renderer.getContext(), px = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
  gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return px;
};
const diff = (a, b) => {
  let n = 0;
  for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2]) n++;
  return n;
};

/** Trả kết quả so và nhãn đặt lên khung; sân khấu chính của app vẽ sau cùng nên cũng xen vào giữa */
export function stagesDemo(host) {
  const t = 1;
  const a = side(host, 0, 'day', [], BOY);
  a.draw(t);
  const refA = pixels(a);
  const b = side(host, 640, 'night', [{ at: [300, -330, 100], target: [200, 0, 60], angle: 40, penumbra: 0.3, color: '#ffc77a', intensity: 1.6, range: 600 }], GIRL);
  b.draw(t);
  const refB = pixels(b);
  let da = 0, db = 0;
  for (let i = 0; i < 2; i++) {
    a.draw(t);
    da += diff(refA, pixels(a));
    b.draw(t);
    db += diff(refB, pixels(b));
  }
  const ok = da === 0 && db === 0;
  const label = document.createElement('pre');
  label.style.cssText = `position:absolute;left:12px;top:12px;margin:0;padding:8px 10px;border-radius:8px;font:13px/1.4 ui-monospace,monospace;color:#fff;background:${ok ? '#2a7a3a' : '#a82a2a'}`;
  label.textContent = `Vẽ xen kẽ hai sân khấu: A ${da ? `lệch ${da} điểm ảnh` : 'khớp'}, B ${db ? `lệch ${db} điểm ảnh` : 'khớp'}`;
  host.appendChild(label);
  if (!ok) console.error(label.textContent);
  window.__stagesOk = ok;
  return { objects: [], animate() {} };
}
