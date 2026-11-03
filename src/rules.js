/** 每一關要建成的設備。前兩項一開始就能選，每建成 1 項就再打開下一個。 */
export const MAPS = [
  {
    id: "base",
    level: 1,
    title: "秘密基地",
    done: "秘密基地完成",
    theme: "day",
    bank: "length",
    facilities: [
      { id: "gate", name: "大門", art: "gate", x: 40, y: 62 },
      { id: "tower", name: "塔樓", art: "tower", x: 10, y: 6 },
      { id: "runway", name: "跑道", art: "runway", x: 28, y: 36, wide: true },
      { id: "power", name: "發電站", art: "power", x: 66, y: 34 },
      { id: "cannon", name: "炮台", art: "cannon", x: 78, y: 6 },
      { id: "tunnel", name: "隧道口", art: "tunnel", x: 8, y: 62 },
    ],
  },
  {
    id: "station",
    level: 2,
    title: "時間車站",
    done: "時間車站完成",
    theme: "dusk",
    bank: "time",
    facilities: [
      { id: "clock", name: "大鐘", art: "clock", x: 42, y: 4 },
      { id: "hall", name: "候車室", art: "hall", x: 8, y: 18 },
      { id: "bridge", name: "天橋", art: "bridge", x: 24, y: 40, wide: true },
      { id: "engine", name: "車頭", art: "engine", x: 62, y: 28 },
      { id: "signal", name: "信號燈", art: "signal", x: 80, y: 8 },
      { id: "platform", name: "月台", art: "platform", x: 18, y: 64, wide: true },
    ],
  },
];

/** 每件設備要放對 5 次才算建成。 */
export const BUILD_STEPS = 5;

/**
 * 星星上限 5。一件設備建滿 5 步得 1 星。
 * 每關有 6 件，完成 5 件即滿星；第 6 件仍要建完才算過關，但不加第 6 顆星。
 */
export const STAR_CAP = 5;

export function emptySteps(facilities) {
  return Object.fromEntries(facilities.map((item) => [item.id, 0]));
}

export function completedCount(facilities, steps) {
  return facilities.filter((item) => (steps[item.id] ?? 0) >= BUILD_STEPS).length;
}

export function starCount(completed) {
  return Math.min(STAR_CAP, completed);
}

/** 只有三個畫面：0 未起、1–4 起緊、5 完成。 */
export function stageOf(step) {
  if (step >= BUILD_STEPS) return "done";
  if (step > 0) return "building";
  return "empty";
}

export function isFacilityOpen(index, builtCount) {
  return index < builtCount + 2;
}

export function openFacilityIds(facilities, steps) {
  const done = completedCount(facilities, steps);
  return facilities
    .filter((item, index) => isFacilityOpen(index, done) && (steps[item.id] ?? 0) < BUILD_STEPS)
    .map((item) => item.id);
}

export function isMapComplete(facilities, steps) {
  return facilities.every((item) => (steps[item.id] ?? 0) >= BUILD_STEPS);
}
