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

export function isFacilityOpen(index, builtCount) {
  return index < builtCount + 2;
}

export function openFacilityIds(facilities, built) {
  return facilities.filter((item, index) => isFacilityOpen(index, built.size) && !built.has(item.id)).map((item) => item.id);
}

export function isMapComplete(facilities, built) {
  return facilities.every((item) => built.has(item.id));
}
