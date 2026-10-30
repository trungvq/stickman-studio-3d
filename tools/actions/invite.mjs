// Tay mời "xin mời lối này" về một phía. Chạy `node tools/actions/invite.mjs`.
import { emit } from "./emit.mjs";

/** `lean` là số nghiêng của `torso`, về phía tay mời */
const ROWS = [
  {
    name: "invite-near-3d",
    arm: "armNear",
    rest: "armFar",
    lean: -4,
    side: "gần",
    mirror: "invite-far-3d",
  },
  {
    name: "invite-far-3d",
    arm: "armFar",
    rest: "armNear",
    lean: 4,
    side: "xa",
    mirror: "invite-near-3d",
  },
];

const FRONT = [0, 0.4, 1.4];
/** Tay nghỉ nằm dưới suốt clip, tay mời bắt đầu chồng lên trên nó: tay nghỉ không bị kéo theo */
const BELLY = { to: "belly", offset: [5, 28, -2], point: "palm", elbow: FRONT };
const STACK = { to: "otherBack", offset: [1, -3, 0], point: "palm", elbow: FRONT };
/** Hướng khuỷu xuống-sau, xa trục vai → cổ tay: hướng ra ngoài thì khuỷu lật lúc tới */
const OUT = { at: [55, -40, 95], elbow: [-0.5, 0.8, 0.2] };
const FLAT = { pose: "flat", w: 0.7, palm: "back", fingers: "in" };
const OPEN = { pose: "open", w: 1, palm: "up", fingers: [0.3, 0, 1] };

await emit(
  ROWS.map((r) => {
    const key = (t, arm, hand, pose) => ({
      t,
      pose,
      reach: { [r.arm]: arm, [r.rest]: BELLY },
      hand: { [r.arm]: hand, [r.rest]: FLAT },
      ease: "smooth",
    });
    const lean = { torso: [8, r.lean], head: [null, null, 4] };
    return {
      name: r.name,
      duration: 1.2,
      end: "hold",
      authoredAt: "side",
      mask: ["armFar", "armNear", "hand", "torso", "head"],
      keys: [
        key(0, STACK, FLAT, { torso: 0, head: [null, null, 0] }),
        key(0.4167, OUT, OPEN, lean),
        key(1, OUT, OPEN, lean),
      ],
      note: `Tay mời "xin mời lối này" về phía tay ${r.side}: từ hai bàn tay chồng trước bụng (tay ${r.side} ở trên), tay ${r.side} rời ra trước rồi mở chéo sang ngang tới đích hệ thân [${OUT.at.join(", ")}] (trên hông, khuỷu gập, rủ xuống), bàn tay \`open\` ngửa, ngón chĩa ra ngoài-trước theo lối đi; tay kia ở lại áp bụng (mốc \`belly\`); thân cúi 8°, nghiêng 4° về phía tay mời, đầu gật 4°. Tới trong 0,5 s rồi giữ. Chỉ ghi hai tay, \`hand\`, \`torso\`, gật của \`head\`. Nền \`stand-3d\`; người bụng phệ thì tay áp bụng lấn vào bụng. Lối đi phía bên kia thì \`${r.mirror}\`; buông bằng clip rỗng blend ~0,4, hay \`hands-front-3d\` blend ~0,5 để về tay chồng. Sinh bằng \`tools/actions/invite.mjs\`.`,
      preview: { stage: "stand" },
    };
  }),
);
