import { addItem, Batch, box } from '@stickman3d/rig';

// Cảnh thử hành động soạn ở `side` (`?demo=acts`, `?demo=desk`, `?demo=heads`, `?demo=side`): mỗi người một trạm trên một
// hàng, hành động bắt đầu ở giây 0,3 và giữ. `acts` đứng, `desk` ngồi ở bàn, `heads` là các hành động chỉ ghi đầu và thân,
// `side` là dang tay chân và nghiêng thân.

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

/** Cảnh của các hành động; `h` là bộ dựng của demos.js */
export function actDemos({ member, track, clip, BOY, GIRL }) {
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
    heads: {
      cast: () => {
        const list = ['lean-in', 'slump-sigh', 'glance-left', 'glance-right', 'look-down-small', 'look-up-head', 'nod-once', 'talk-tilt-back'];
        const n = list.length;
        return list.map((a, i) =>
          member(`h${i}`, i % 2 ? GIRL : BOY, { at: [at(i, n) * 0.6, 0, 0], yaw: 60 }, [track(clip('stand-3d')), track(clip(a, START)), track(clip('face-calm'))], i));
      },
    },
  };
}
