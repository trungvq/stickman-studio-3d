import { screenOf } from '@stickman3d/rig';

// Chữ 2D đè lên canvas, bám mốc trên người qua `screenOf` mỗi khung: nhãn có mũi chỉ xuống, hay bong bóng có đuôi.

const CSS = `
.mark { position: absolute; left: 0; top: 0; pointer-events: none; font: 600 15px system-ui, sans-serif; color: #1b1918; will-change: transform; }
.mark > span { position: absolute; left: 0; bottom: 0; transform: translate(-50%, -12px); white-space: nowrap; padding: 4px 10px;
  background: #fffdf6; border: 2.5px solid #1b1918; border-radius: 6px; }
.mark > span::after { content: ''; position: absolute; left: 50%; bottom: -9px; margin-left: -6px; border: 6px solid transparent; border-top: 7px solid #1b1918; border-bottom: 0; }
.mark.bubble > span { transform: translate(-100%, -24px); border-radius: 16px; }
.mark.bubble > span::after { left: auto; right: 8px; bottom: -22px; border-width: 0 0 22px 10px; border-color: transparent transparent transparent #1b1918; }
.mark::before { content: ''; position: absolute; left: -4px; top: -4px; width: 8px; height: 8px; border-radius: 50%; background: #e0452b; }
.mark.hidden { display: none; }
.mark.occluded { opacity: 0.35; }
`;

/** Gắn các mốc `{ fig, at, text, bubble }` vào `host`; trả hàm cập nhật gọi sau mỗi `stage.draw`. */
export function createMarks(host, marks, occluders) {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);
  const els = marks.map((m) => {
    const el = document.createElement('div');
    el.className = `mark${m.bubble ? ' bubble' : ''}`;
    el.innerHTML = '<span></span>';
    el.firstChild.textContent = m.text;
    host.appendChild(el);
    return el;
  });
  return (stage) =>
    marks.forEach((m, i) => {
      const p = screenOf(stage, m.fig, m.at, { occluders });
      const el = els[i];
      el.classList.toggle('hidden', !p.inFrame);
      el.classList.toggle('occluded', !!p.occluded);
      el.style.transform = `translate(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px)`;
    });
}
