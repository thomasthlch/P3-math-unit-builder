/** 建造方向。下一個方向要等上一個累積到 UNLOCK_AT 塊才打開。 */
export const DIRECTIONS = [
  { id: "up", label: "向上", place: "向上疊高" },
  { id: "forward", label: "向前", place: "向前擴建" },
  { id: "left", label: "向左", place: "向左加建" },
  { id: "right", label: "向右", place: "向右加建" },
  { id: "down", label: "向下", place: "向下挖深" },
  { id: "tunnel", label: "隧道", place: "開通隧道" },
];

/** 每個方向至少這麼多塊才算完工。 */
export const GOAL = 3;

/** 畫面最多放這麼多塊，避免某個方向被一直疊下去。 */
export const MAX = 4;

/** 上一個方向達到這個數量，就解鎖下一個方向。 */
export const UNLOCK_AT = 2;

export function emptyCounts() {
  return Object.fromEntries(DIRECTIONS.map((dir) => [dir.id, 0]));
}

export function unlockedIds(counts) {
  const open = ["up"];
  for (let i = 0; i < DIRECTIONS.length - 1; i += 1) {
    if (counts[DIRECTIONS[i].id] >= UNLOCK_AT) open.push(DIRECTIONS[i + 1].id);
  }
  return open;
}

export function isWin(counts) {
  return DIRECTIONS.every((dir) => counts[dir.id] >= GOAL);
}

export function baseTitle(counts) {
  if (isWin(counts)) return "秘密基地";
  const open = unlockedIds(counts);
  if (open.includes("tunnel")) return "隧道工程";
  if (open.includes("down")) return "地下層";
  if (open.includes("left")) return "左右翼";
  if (open.includes("forward")) return "前庭";
  if (counts.up > 0) return "瞭望塔";
  return "空地";
}
