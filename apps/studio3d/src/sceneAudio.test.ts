import { describe, expect, it } from "vitest";
import { planCue, sceneCues, type PlayCue, type SoundData } from "./sceneAudio";

const data = (more: Partial<SoundData>): SoundData => ({ episode: "e", fps: 30, ...more });

describe("sceneCues", () => {
  it("cue của shot đổi ra giây cảnh, cắt ở cuối shot, cue ngoài shot thì bỏ", () => {
    const cues = sceneCues(
      data({
        shots: [
          {
            scene: "a",
            from: 10,
            to: 12,
            duration: 2,
            audio: [
              { file: "x.mp3", at: 0.5 },
              { file: "ngoai.mp3", at: 3 },
            ],
          },
          { scene: "a", from: 12, to: 15, duration: 3, audio: [{ file: "y.mp3", volume: 0.5 }] },
        ],
      }),
      "a",
      {},
    );
    expect(cues.map((c) => [c.file, c.start, c.end, c.volume])).toEqual([
      ["x.mp3", 10.5, 12, 1],
      ["y.mp3", 12, 15, 0.5],
    ]);
  });

  it("cue khai mốc tính từ mốc của cảnh", () => {
    const cues = sceneCues(
      data({
        shots: [
          { scene: "a", from: 2, to: 8, duration: 6, audio: [{ file: "x.mp3", at: "@m+0.5" }] },
        ],
      }),
      "a",
      { m: 5 },
    );
    expect(cues[0].start).toBeCloseTo(5.5);
  });

  it("nhạc tầng tập đổi theo chỗ đoạn shot trong tập, đang chạy dở thì nghe từ đầu đoạn", () => {
    const cues = sceneCues(
      data({
        shots: [
          { scene: "khac", from: 0, to: 10, duration: 10 },
          { scene: "a", from: 20, to: 30, duration: 10 },
        ],
        audio: [
          { file: "bgm.mp3", at: 4, dur: 60 },
          { file: "som.mp3", at: 0, dur: 5 },
          { file: "muon.mp3", at: 25, dur: 5 },
        ],
      }),
      "a",
      {},
    );
    expect(cues.map((c) => [c.file, c.start, c.from, c.end])).toEqual([["bgm.mp3", 14, 20, 30]]);
  });

  it("hook cắt lại từ cảnh không phát chồng lên đoạn chính", () => {
    const cues = sceneCues(
      data({
        shots: [
          { scene: "a", from: 5, to: 6, duration: 1, audio: [{ file: "hook.mp3" }] },
          { scene: "khac", from: 0, to: 2, duration: 2 },
          { scene: "a", from: 0, to: 20, duration: 20, audio: [{ file: "chinh.mp3" }] },
        ],
      }),
      "a",
      {},
    );
    expect(cues.map((c) => c.file)).toEqual(["chinh.mp3"]);
  });
});

const cue = (more: Partial<PlayCue>): PlayCue => ({
  file: "x",
  start: 10,
  from: 10,
  end: 100,
  volume: 1,
  fadeIn: 0,
  fadeOut: 0,
  ...more,
});

describe("planCue", () => {
  it("bắt đầu nghe giữa cue thì phát từ giữa file", () => {
    expect(planCue(cue({}), 5, 12, 1)).toEqual([
      {
        when: 0,
        offset: 2,
        length: 3,
        gains: [
          { when: 0, v: 1 },
          { when: 3, v: 1 },
        ],
      },
    ]);
  });

  it("cue chưa tới thì đợi, đã hết thì không phát", () => {
    expect(planCue(cue({}), 5, 8, 2)[0].when).toBe(1);
    expect(planCue(cue({}), 5, 16, 1)).toEqual([]);
  });

  it("`from` muộn hơn `start` thì vào giữa file đúng ở `from`", () => {
    const [s] = planCue(cue({ start: 14, from: 20 }), 60, 0, 1);
    expect(s.when).toBe(20);
    expect(s.offset).toBe(6);
  });

  it("bè lặp phát lại từng vòng tới hết `dur`, vòng dở phát tiếp đúng chỗ", () => {
    const segs = planCue(cue({ loop: 2, dur: 5 }), 3, 11, 1);
    expect(segs.map((s) => [s.when, s.offset, s.length])).toEqual([
      [0, 1, 1],
      [1, 0, 2],
      [3, 0, 1],
    ]);
  });

  it("mức âm theo fade như Remotion", () => {
    const [s] = planCue(cue({ volume: 0.5, dur: 4, fadeIn: 1, fadeOut: 1 }), 10, 10, 1);
    expect(s.gains).toEqual([
      { when: 0, v: 0 },
      { when: 1, v: 0.5 },
      { when: 3, v: 0.5 },
      { when: 4, v: 0 },
    ]);
  });
});
