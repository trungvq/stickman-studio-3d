// Trang Chromium của `stickman-render --three`: `boot(rig, world)` nhận rig và module `stickman.world` của repo
// video gói chung một bản (`bundleThreePage`), dựng sân khấu three như `Scene3D` của Remotion rồi vẽ từng mốc.
// Node điều khiển qua `globalThis.__three` — three.mjs.

export function boot(rig, world) {
  let held = null;
  const drop = () => {
    held?.stage.dispose();
    held = null;
  };

  /** Cảnh three: `worldOf` của repo như `check`, cảnh repo không dựng thì `plainRoom()` */
  const build = ({ id, scene, data, plain }) => {
    const { characters, actions, animals, props, held: items, heights, bodies } = data;
    const runtime = rig.resolveScene(scene, actions, animals, props, heights, bodies, items);
    const ctx = { id, scene, runtime, characters, actions, animals, props, heights, bodies };
    if (!plain && typeof world.worldOf === "function") {
      const w = world.worldOf(scene.name, ctx);
      if (w) {
        if (!w.root?.isObject3D || typeof w.pose !== "function" || !w.set?.room)
          throw new Error(
            `worldOf("${scene.name}") phải trả World3D của buildWorld để vẽ (có root, pose, set)`,
          );
        return { w, from: "world" };
      }
    }
    return {
      w: rig.buildWorld(scene, runtime, { set: () => rig.plainRoom() }, ctx),
      from: "plain",
    };
  };

  /** Đồ khối thêm vào bối cảnh (ghế của người ngồi một mình), `Item` của rig */
  const furnish = (w, items) => {
    if (!items?.length) return;
    const batch = new rig.Batch();
    for (const it of items) rig.addItem(batch, it);
    w.set.group.add(batch.build());
  };

  globalThis.__three = {
    /** Dựng sân khấu; gọi lại là dựng cảnh khác, sân khấu cũ huỷ */
    async setup(o) {
      drop();
      if (typeof rig.stageOf !== "function")
        throw new Error(
          "@stickman3d/rig của repo chưa có `stageOf` — nâng rig cùng version với render",
        );
      const warnings = [];
      let { w, from } = build(o);
      const fonts = w.set.fonts;
      if (fonts?.specs?.length) {
        const missing = await rig.loadFonts(fonts.specs, fonts.text);
        if (missing.length) warnings.push(`thiếu phông decal: ${missing.join(", ")}`);
        // đồ riêng vẽ chữ lúc dựng: dựng lại khi phông đã nạp
        ({ w, from } = build(o));
      }
      furnish(w, o.furniture);
      let made;
      try {
        made = await rig.stageOf(w, { size: o.size, software: o.software });
      } catch (e) {
        if (/WebGL/i.test(e.message))
          throw new Error(
            `Chromium không tạo được WebGL (${e.message}) — máy không có GPU thì vẽ phần mềm: --software / software: true`,
          );
        if (/không có GPU/.test(e.message))
          throw new Error(
            `${e.message} — Chromium đang vẽ phần mềm; chấp nhận chậm thì --software / software: true`,
          );
        throw e;
      }
      held = { ...made, times: o.times };
      const provided = w.cast.provided().map((p) => p.item);
      return { gpu: made.stage.gpu, from, warnings, provided };
    },
    /** Vẽ mốc thứ `i` của `times` rồi trả PNG base64 của đúng khung ấy */
    shot(i) {
      const { stage, world: w, times } = held;
      const t = times[i];
      const t0 = performance.now();
      stage.draw(t, w.view(t));
      const png = stage.canvas.toDataURL("image/png");
      return { png: png.slice(png.indexOf(",") + 1), ms: performance.now() - t0 };
    },
    dispose: drop,
  };
}
