/** 五關都用同一份長度＋時間題庫。前兩項一開始就能選，每建成 1 項就再打開下一個。 */
export const MAPS = [
  {
    id: "base",
    level: 1,
    title: "秘密基地",
    done: "秘密基地完成",
    blurb: "一起砌秘密基地",
    mark: "🏰",
    theme: "day",
    sky: "sun",
    facilities: [
      { id: "gate", name: "大門", art: "gate", x: 40, y: 62 },
      { id: "tower", name: "塔樓", art: "tower", x: 10, y: 6 },
      { id: "runway", name: "跑道", art: "runway", x: 28, y: 36, wide: true },
      { id: "power", name: "發電站", art: "power", x: 66, y: 34 },
      { id: "cannon", name: "炮台", art: "cannon", x: 78, y: 6 },
    ],
  },
  {
    id: "station",
    level: 2,
    title: "時間車站",
    done: "時間車站完成",
    blurb: "一起起時間車站",
    mark: "🚂",
    theme: "dusk",
    sky: "moon",
    facilities: [
      { id: "clock", name: "大鐘", art: "clock", x: 42, y: 4 },
      { id: "hall", name: "候車室", art: "hall", x: 8, y: 18 },
      { id: "bridge", name: "天橋", art: "bridge", x: 24, y: 40, wide: true },
      { id: "engine", name: "車頭", art: "engine", x: 62, y: 28 },
      { id: "signal", name: "信號燈", art: "signal", x: 80, y: 8 },
    ],
  },
  {
    id: "oasis",
    level: 3,
    title: "沙漠綠洲",
    done: "沙漠綠洲完成",
    blurb: "在沙漠建成綠洲",
    mark: "🌵",
    theme: "desert",
    sky: "sun",
    facilities: [
      { id: "tent", name: "帳篷", emoji: "⛺", x: 8, y: 8 },
      { id: "camel", name: "駱駝", emoji: "🐪", x: 38, y: 8 },
      { id: "well", name: "水井", emoji: "💧", x: 68, y: 8 },
      { id: "cactus", name: "仙人掌", emoji: "🌵", x: 8, y: 58 },
      { id: "campfire", name: "營火", emoji: "🔥", x: 38, y: 58 },
      { id: "palm", name: "棕櫚", emoji: "🌴", x: 68, y: 58 },
    ],
  },
  {
    id: "space",
    level: 4,
    title: "太空站",
    done: "太空站完成",
    blurb: "建造太空站",
    mark: "🚀",
    theme: "space",
    sky: "stars",
    facilities: [
      { id: "rocket", name: "火箭", emoji: "🚀", x: 4, y: 1 },
      { id: "moon", name: "月球", emoji: "🌙", x: 36, y: 1 },
      { id: "star", name: "星星", emoji: "⭐", x: 68, y: 1 },
      { id: "scope", name: "望遠鏡", emoji: "🔭", x: 12, y: 34 },
      { id: "ufo", name: "飛碟", emoji: "🛸", x: 56, y: 34 },
      { id: "comet", name: "彗星", emoji: "☄️", x: 8, y: 64 },
      { id: "earth", name: "地球", emoji: "🌍", x: 46, y: 64 },
    ],
  },
  {
    id: "water",
    level: 5,
    title: "水上樂園",
    done: "水上樂園完成",
    blurb: "砌一座水上樂園",
    mark: "🏊",
    theme: "water",
    sky: "sun",
    facilities: [
      { id: "pool", name: "泳池", emoji: "🏊", x: 4, y: 1 },
      { id: "boat", name: "帆船", emoji: "⛵", x: 36, y: 1 },
      { id: "dolphin", name: "海豚", emoji: "🐬", x: 68, y: 1 },
      { id: "ice", name: "雪糕", emoji: "🍦", x: 12, y: 34 },
      { id: "beach", name: "沙灘", emoji: "🏖️", x: 56, y: 34 },
      { id: "spray", name: "噴泉", emoji: "💦", x: 8, y: 64 },
      { id: "surf", name: "衝浪", emoji: "🏄", x: 46, y: 64 },
    ],
  },
];

/** 每件設備要放對 5 次才算建成。 */
export const BUILD_STEPS = 5;

/**
 * 星星上限 5。完成（設備數 − 1）件即滿星。
 * 5 件完成 4 件、6 件完成 5 件、7 件完成 6 件都是滿星。
 * 最後一件仍要建完才算過關，但不會多出第 6 顆星。
 */
export const STAR_CAP = 5;

export function emptySteps(facilities) {
  return Object.fromEntries(facilities.map((item) => [item.id, 0]));
}

export function completedCount(facilities, steps) {
  return facilities.filter((item) => (steps[item.id] ?? 0) >= BUILD_STEPS).length;
}

export function starCount(completed, facilityCount) {
  const fullAt = Math.max(1, facilityCount - 1);
  if (completed >= fullAt) return STAR_CAP;
  if (completed <= 0) return 0;
  const scaled = Math.round((completed / fullAt) * STAR_CAP);
  return Math.min(STAR_CAP - 1, Math.max(1, scaled));
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
