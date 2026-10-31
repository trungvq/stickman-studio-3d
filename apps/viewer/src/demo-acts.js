import { addItem, Batch, box, HAND_POSE_KINDS as HAND_POSES } from '@stickman3d/rig';

// Cảnh thử hành động soạn ở `side` (`?demo=acts`, `?demo=desk`, `?demo=heads`, `?demo=side`, `?demo=hands`,
// `?demo=gestures`): mỗi người một trạm trên một hàng, hành động bắt đầu ở giây 0,3 và giữ. `acts` đứng, `desk` ngồi ở bàn,
// `heads` là các hành động chỉ ghi đầu và thân, `side` là dang tay chân và nghiêng thân, `hands` là bảng dáng tay, `gestures`
// là vẫy tay (xoắn vai), nhún vai ngửa tay, gõ phím úp tay (`arms-on-table-3d` úp bàn tay), chỉ tay — hai cảnh cuối luôn
// là người mặc đồ.

const GAP = 240;
const at = (i, n) => (i - (n - 1) / 2) * GAP;
const START = 0.3;
const WOOD = { top: '#c9a679', lit: '#a98559' };
const METAL = { top: '#77736e', lit: '#5f5b57' };

/** Bàn cao 137 bắt đầu ở `x0` sâu 90, và ghế đẩu cao 87,5 có tâm ở `stool` (bỏ trống là không có ghế) */
function desk(b, x0, stool) {
  const legs = [[x0 + 5, -60], [x0 + 85, -60], [x0 + 5, 60], [x0 + 85, 60]];
  addItem(b, { at: { at: [0, 0, 0] }, parts: [
    { v: box(x0, x0 + 90, -143, -137, -66, 66), tone: WOOD },
    ...legs.map(([x, z]) => ({ v: box(x - 3, x + 3, -137, 0, z - 3, z + 3), tone: METAL })),
    ...(stool === undefined ? [] : [
      { v: box(stool - 30, stool + 30, -87.5, -80, -30, 30), tone: WOOD },
      { v: box(stool - 3, stool + 3, -80, 0, -3, 3), tone: METAL },
    ]),
  ] });
}

/** Đưa tay gần ra trước ngang ngực rồi giữ dáng tay `pose`: một trạm của bảng dáng tay */
const handShow = (pose) => ({
  name: `hand-${pose}`, duration: 0.8, end: 'hold', authoredAt: 'side', mask: ['armRight', 'hand'],
  keys: [
    { t: 0, pose: { armRight: [3, 8, 0] }, hand: { armRight: {} }, ease: 'smooth' },
    { t: 1, pose: { armRight: [40, 70, 0, 10] }, hand: { armRight: pose } },
  ],
});

/** Hành động chỉ người mặc đồ: vẫy tay bằng xoắn vai, nhún vai ngửa tay, úp tay gõ phím, chỉ tay */
const GESTURES = {
  'wave-3d': {
    name: 'wave-3d', duration: 1.2, end: 'wrap', authoredAt: 'side', mask: ['armRight', 'hand'],
    note: 'Vẫy tay: cánh tay trên ngang vai (dang 80 cộng tay choãi), xoay ngoài 90 dựng cẳng tay, khuỷu lắc 40 ↔ 75 nên cẳng tay ngả ra ngoài đầu qua lại; lòng tay ra trước.',
    keys: [
      { t: 0, pose: { armRight: [0, 58, 0, 80, 90] }, hand: { armRight: { pose: 'open', bend: -10 } }, ease: 'smooth' },
      { t: 0.25, pose: { armRight: [0, 40, 0, 80, 90] }, hand: { armRight: { pose: 'open', bend: -20 } }, ease: 'smooth' },
      { t: 0.75, pose: { armRight: [0, 75, 0, 80, 90] }, hand: { armRight: { pose: 'open', bend: 0 } }, ease: 'smooth' },
      { t: 1, pose: { armRight: [0, 58, 0, 80, 90] }, hand: { armRight: { pose: 'open', bend: -10 } } },
    ],
  },
  'shrug-palms-3d': {
    name: 'shrug-palms-3d', duration: 0.6, end: 'hold', authoredAt: 'side', mask: ['armRight', 'armLeft', 'hand'],
    note: 'Nhún vai ngửa tay: cẳng tay ra trước, dang 25, ngửa hẳn (turn −90).',
    keys: [
      { t: 0, pose: { armRight: [3, 8, 0], armLeft: [3, 8, 0] }, hand: { armRight: {}, armLeft: {} }, ease: 'smooth' },
      { t: 1, pose: { armRight: [10, 80, 0, 25], armLeft: [10, 80, 0, 25] }, hand: { armRight: { pose: 'open', w: 0.7, turn: -90, bend: -10 }, armLeft: { pose: 'open', w: 0.7, turn: -90, bend: -10 } } },
    ],
  },
  'point-out-3d': {
    name: 'point-out-3d', duration: 0.5, end: 'hold', authoredAt: 'side', mask: ['armRight', 'hand'],
    note: 'Chỉ sang ngang chếch ra trước: tay gần gần duỗi, hơi dưới vai, ngón trỏ theo trục cẳng tay, ngón cái lên.',
    keys: [
      { t: 0, pose: { armRight: [3, 8, 0] }, hand: { armRight: {} }, ease: 'smooth' },
      { t: 1, pose: { armRight: [40, 5, 0, 75] }, hand: { armRight: { pose: 'point', bend: -5 } } },
    ],
  },
};

/** Cảnh của các hành động; `h` là bộ dựng của demos.js */
export function actDemos({ member, track, clip, BOY, GIRL, CLAD }) {
  const stand = (i, n, yaw, actions, opts = BOY) =>
    member(`s${i}`, opts, { at: [at(i, n), 0, 0], yaw }, [track(clip('stand-3d')), ...actions.map((a) => track(clip(a, START))), track(clip('face-calm'))], i);
  /** Ngồi ghế đẩu nhìn +x, bàn trước mặt */
  const seat = (i, n, actions, opts = GIRL) =>
    member(`d${i}`, opts, { at: [at(i, n) - 60, -87.5, 0], yaw: 0, sit: true, floor: 0 },
      [track(clip('sit-3d')), ...actions.map((a) => track(Array.isArray(a) ? clip(a[0], a[1]) : clip(a, START))), track(clip('face-calm'))], i);
  return {
    acts: {
      cast: () => {
        const n = 5;
        return [
          stand(0, n, 60, ['eshaku-3d']),
          stand(1, n, 60, ['show-paper-3d'], GIRL),
          stand(2, n, 60, ['point-3d']),
          stand(3, n, 60, ['stop-palm-3d', 'point-lane-3d']),
          stand(4, n, 60, ['raise-laptop-3d'], GIRL),
        ];
      },
    },
    desk: {
      cast: () => {
        const n = 5;
        return [
          seat(0, n, [['arms-on-table-3d', 0], 'type-3d']),
          seat(1, n, ['phone-lift-3d'], BOY),
          seat(2, n, ['pick-paper-3d']),
          seat(3, n, [['arms-on-table-3d', 0], 'head-down-3d'], BOY),
          member('d4', BOY, { at: [at(4, n) + 8, -137, 0], yaw: 180, sit: true, floor: 0 }, [track(clip('perch-desk-3d')), track(clip('face-calm'))], 4),
        ];
      },
      props: () => {
        const b = new Batch();
        for (let i = 0; i < 4; i++) desk(b, at(i, 5), at(i, 5) - 60);
        desk(b, at(4, 5), undefined);
        return [b.build()];
      },
    },
    side: {
      cast: () => {
        const n = 5;
        return [
          stand(0, n, 90, ['step-side-3d']),
          stand(1, n, 90, ['arms-out-3d'], GIRL),
          stand(2, n, 90, ['hand-up-side-3d']),
          stand(3, n, 90, ['lean-side-3d'], GIRL),
          stand(4, n, 90, ['stance-wide-3d']),
        ];
      },
    },
    hands: {
      cast: () => HAND_POSES.map((p, i) =>
        member(`p${i}`, i % 2 ? CLAD.GIRL : CLAD.BOY, { at: [at(i, HAND_POSES.length) * 0.6, 0, 0], yaw: 60 },
          [track(clip('stand-3d')), track(clip(`hand-${p}`, START)), track(clip('face-calm'))], i)),
      actions: () => Object.fromEntries(HAND_POSES.map((p) => [`hand-${p}`, handShow(p)])),
    },
    gestures: {
      cast: () => {
        const n = 4;
        return [
          stand(0, n, 85, ['wave-3d'], CLAD.BOY),
          stand(1, n, 60, ['shrug-palms-3d'], CLAD.GIRL),
          member('g2', CLAD.BOY, { at: [at(2, n) - 60, -87.5, 0], yaw: 0, sit: true, floor: 0 },
            [track(clip('sit-3d')), track(clip('arms-on-table-3d', 0)), track(clip('type-3d', START)), track(clip('face-calm'))], 2),
          stand(3, n, 85, ['point-out-3d'], CLAD.GIRL),
        ];
      },
      props: () => {
        const b = new Batch();
        desk(b, at(2, 4), at(2, 4) - 60);
        return [b.build()];
      },
      actions: () => GESTURES,
    },
    heads: {
      cast: () => {
        const list = ['lean-in', 'slump-sigh', 'glance-left', 'glance-right', 'look-down-small', 'look-up-head', 'nod-once', 'talk-tilt'];
        const n = list.length;
        return list.map((a, i) =>
          member(`h${i}`, i % 2 ? GIRL : BOY, { at: [at(i, n) * 0.6, 0, 0], yaw: 60 }, [track(clip('stand-3d')), track(clip(a, START)), track(clip('face-calm'))], i));
      },
    },
  };
}
