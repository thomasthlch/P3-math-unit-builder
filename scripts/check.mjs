import { QUESTIONS, UNIT_CHOICES } from "../src/questions.js";
import { TIME_QUESTIONS } from "../src/time-questions.js";
import {
  BUILD_STEPS,
  MAPS,
  completedCount,
  emptySteps,
  isFacilityOpen,
  isMapComplete,
  openFacilityIds,
  stageOf,
  starCount,
} from "../src/rules.js";

const G_ANSWERS = {
  G01: "厘米（cm）",
  G02: "米（m）",
  G03: "公里（km）",
  G04: "毫米（mm）",
  G05: "厘米（cm）",
  G06: "米（m）",
  G07: "毫米（mm）",
  G08: "厘米（cm）",
  G09: "公里（km）",
  G10: "毫米（mm）",
  G11: "米（m）",
  G12: "米（m）",
};

const errors = [];

function fail(message) {
  errors.push(message);
}

function compound(major, minor, majorUnit, minorUnit) {
  if (minor === 0) return `${major} ${majorUnit}`;
  return `${major} ${majorUnit} ${minor} ${minorUnit}`;
}

const ids = new Set();
const prompts = new Set();
const counts = {};

for (const question of QUESTIONS) {
  counts[question.type] = (counts[question.type] ?? 0) + 1;
  if (ids.has(question.id)) fail(`重複題號 ${question.id}`);
  ids.add(question.id);
  if (prompts.has(question.prompt)) fail(`重複題幹 ${question.id}`);
  prompts.add(question.prompt);
  if (!question.hint || question.hint.length < 8) fail(`${question.id} 缺少提示`);
  if (new Set(question.choices).size !== question.choices.length) {
    fail(`${question.id} 選項重複`);
  }
  if (!question.choices.includes(question.answer)) {
    fail(`${question.id} 答案不在選項中`);
  }
  if (question.choices.length !== 4) fail(`${question.id} 應該有 4 個選項`);
  if (question.type === "G" && G_ANSWERS[question.id] !== question.answer) {
    fail(`${question.id} 選擇題答案應為「${G_ANSWERS[question.id]}」`);
  }

  const expected = expectedAnswer(question);
  if (expected != null && question.answer !== expected) {
    fail(`${question.id} 答案應為「${expected}」，實際是「${question.answer}」`);
  }
  if (expected != null && question.choices.some((choice) => choice !== expected && choice === question.answer)) {
    fail(`${question.id} 干擾項撞到答案`);
  }
}

function expectedAnswer(question) {
  if (question.type === "A") {
    const match = question.prompt.match(
      /^(\d+)\s+(公里|km)\s+(\d+)\s+(米|m)\s+=\s+______\s+(米|m)$/,
    );
    if (!match) {
      fail(`${question.id} 題幹格式不符：${question.prompt}`);
      return null;
    }
    if (!question.hint.includes("×1000")) fail(`${question.id} 提示應有 ×1000`);
    return `${Number(match[1]) * 1000 + Number(match[3])} ${match[5]}`;
  }
  if (question.type === "B") {
    const match = question.prompt.match(
      /^(\d+)\s+(厘米|cm)\s+(\d+)\s+(毫米|mm)\s+=\s+______\s+(毫米|mm)$/,
    );
    if (!match) {
      fail(`${question.id} 題幹格式不符：${question.prompt}`);
      return null;
    }
    if (!question.hint.includes("×10")) fail(`${question.id} 提示應有 ×10`);
    return `${Number(match[1]) * 10 + Number(match[3])} ${match[5]}`;
  }
  if (question.type === "C") {
    const match = question.prompt.match(/^(\d+)\s+(毫米|mm)\s+=\s+______$/);
    if (!match) {
      fail(`${question.id} 題幹格式不符：${question.prompt}`);
      return null;
    }
    if (!question.hint.includes("÷10")) fail(`${question.id} 提示應有 ÷10`);
    const total = Number(match[1]);
    const unit = match[2];
    const majorUnit = unit === "毫米" ? "厘米" : "cm";
    return compound(Math.floor(total / 10), total % 10, majorUnit, unit);
  }
  if (question.type === "D") {
    const match = question.prompt.match(/^(\d+)\s+(米|m)\s+=\s+______$/);
    if (!match) {
      fail(`${question.id} 題幹格式不符：${question.prompt}`);
      return null;
    }
    if (!question.hint.includes("÷1000")) fail(`${question.id} 提示應有 ÷1000`);
    const total = Number(match[1]);
    const unit = match[2];
    const majorUnit = unit === "米" ? "公里" : "km";
    return compound(Math.floor(total / 1000), total % 1000, majorUnit, unit);
  }
  if (question.type === "E") {
    const match = question.prompt.match(
      /^(\d+)\s+(米|m)\s+(\d+)\s+(厘米|cm)\s+=\s+______\s+(厘米|cm)$/,
    );
    if (!match) {
      fail(`${question.id} 題幹格式不符：${question.prompt}`);
      return null;
    }
    if (!question.hint.includes("×100")) fail(`${question.id} 提示應有 ×100`);
    return `${Number(match[1]) * 100 + Number(match[3])} ${match[5]}`;
  }
  if (question.type === "F") {
    const match = question.prompt.match(/^(\d+)\s+(厘米|cm)\s+=\s+______$/);
    if (!match) {
      fail(`${question.id} 題幹格式不符：${question.prompt}`);
      return null;
    }
    if (!question.hint.includes("÷100")) fail(`${question.id} 提示應有 ÷100`);
    const total = Number(match[1]);
    const unit = match[2];
    const majorUnit = unit === "厘米" ? "米" : "m";
    return compound(Math.floor(total / 100), total % 100, majorUnit, unit);
  }
  if (question.type === "G") {
    if (!question.prompt.includes("最適合")) fail(`${question.id} 選擇題題幹應問最適合的單位`);
    if (question.choices.join("|") !== UNIT_CHOICES.join("|")) {
      fail(`${question.id} 單位選項不完整`);
    }
    return question.answer;
  }
  fail(`${question.id} 未知題型 ${question.type}`);
  return null;
}

if (QUESTIONS.length < 80) fail(`長度題只有 ${QUESTIONS.length} 題，少於 80`);
for (const type of ["A", "B", "C", "D", "E", "F", "G"]) {
  if (!counts[type]) fail(`缺少題型 ${type}`);
}

const chinese = QUESTIONS.filter((q) => /[公里米厘米毫米]/.test(q.prompt)).length;
const english = QUESTIONS.filter((q) => /\b(km|cm|mm|m)\b/.test(q.prompt)).length;
if (chinese < 20) fail("中文單位題太少");
if (english < 20) fail("英文縮寫題太少");

if (TIME_QUESTIONS.length < 45) fail(`時間題只有 ${TIME_QUESTIONS.length} 題，少於 45`);
const timeIds = new Set();
for (const question of TIME_QUESTIONS) {
  if (timeIds.has(question.id)) fail(`時間題號重複 ${question.id}`);
  timeIds.add(question.id);
  if (!question.choices.includes(question.answer) || new Set(question.choices).size !== 4) {
    fail(`${question.id} 時間題選項不完整`);
  }
  const expected = expectedTime(question);
  if (expected != null && question.answer !== expected) {
    fail(`${question.id} 時間答案應為「${expected}」，實際是「${question.answer}」`);
  }
}

function expectedTime(question) {
  if (question.type === "H" || question.type === "M") {
    const match = question.prompt.match(/^(\d+)\s+(\S+)\s+(\d+)\s+(\S+)\s+=\s+______\s+(\S+)$/);
    if (!match) {
      fail(`${question.id} 時間題幹不符：${question.prompt}`);
      return null;
    }
    if (!question.hint.includes("×60")) fail(`${question.id} 提示應有 ×60`);
    return `${Number(match[1]) * 60 + Number(match[3])} ${match[5]}`;
  }
  if (question.type === "S" || question.type === "F") {
    const match = question.prompt.match(/^(\d+)\s+(\S+)\s+=\s+______$/);
    if (!match) {
      fail(`${question.id} 時間題幹不符：${question.prompt}`);
      return null;
    }
    if (!question.hint.includes("÷60")) fail(`${question.id} 提示應有 ÷60`);
    const total = Number(match[1]);
    const major = Math.floor(total / 60);
    const minor = total % 60;
    const majorUnit = question.type === "S" ? (match[2] === "秒" ? "分" : "min") : match[2] === "分" ? "小時" : "h";
    const minorUnit = question.type === "S" ? (match[2] === "秒" ? "秒" : "s") : match[2] === "分" ? "分" : "min";
    return `${major} ${majorUnit} ${minor} ${minorUnit}`;
  }
  if (question.type === "U") {
    if (!question.prompt.includes("最適合")) fail(`${question.id} 應問最適合的單位`);
    return question.answer;
  }
  fail(`${question.id} 未知時間題型`);
  return null;
}

const sharedIds = new Set();
for (const question of [...QUESTIONS, ...TIME_QUESTIONS]) {
  if (sharedIds.has(question.id)) fail(`共用題庫題號重複 ${question.id}`);
  sharedIds.add(question.id);
}
if (QUESTIONS.length + TIME_QUESTIONS.length < 100) {
  fail(`共用題庫只有 ${QUESTIONS.length + TIME_QUESTIONS.length} 題，少於 100`);
}

if (starCount(4, 5) !== 5) fail("5 件完成 4 件應滿星");
if (starCount(3, 5) >= 5) fail("5 件完成 3 件不應滿星");
if (starCount(5, 6) !== 5 || starCount(4, 6) !== 4 || starCount(2, 6) !== 2) {
  fail("6 件關卡應維持完成 5 件滿星、之前按件數給星");
}
if (starCount(6, 7) !== 5) fail("7 件完成 6 件應滿星");
if (starCount(5, 7) >= 5) fail("7 件完成 5 件不應滿星");
if (starCount(1, 5) !== 1 || starCount(1, 6) !== 1 || starCount(1, 7) !== 1) {
  fail("完成 1 件應有 1 星");
}

const facilityCounts = [5, 5, 6, 7, 7];
if (MAPS.length !== facilityCounts.length) fail(`應有 ${facilityCounts.length} 關`);
const themes = new Set();
const titles = new Set();
for (const [index, map] of MAPS.entries()) {
  if (map.level !== index + 1) fail(`${map.title} 關卡編號應為 ${index + 1}`);
  if (map.facilities.length !== facilityCounts[index]) {
    fail(`${map.title} 應有 ${facilityCounts[index]} 件設備，實際 ${map.facilities.length}`);
  }
  if (!map.theme || !map.done || !map.title) fail(`第 ${map.level} 關缺少主題資料`);
  if (themes.has(map.theme)) fail(`主題重複 ${map.theme}`);
  themes.add(map.theme);
  if (titles.has(map.title)) fail(`關卡名稱重複 ${map.title}`);
  titles.add(map.title);
  const names = new Set(map.facilities.map((item) => item.name));
  const facilityIds = new Set(map.facilities.map((item) => item.id));
  if (names.size !== map.facilities.length) fail(`${map.title} 設備名稱重複`);
  if (facilityIds.size !== map.facilities.length) fail(`${map.title} 設備編號重複`);
  if (!isFacilityOpen(0, 0) || !isFacilityOpen(1, 0) || isFacilityOpen(2, 0)) {
    fail(`${map.title} 開局應只打開前兩項`);
  }
  if (!isFacilityOpen(2, 1)) fail(`${map.title} 建成 1 項後應打開第 3 項`);

  if (stageOf(0) !== "empty" || stageOf(3) !== "building" || stageOf(BUILD_STEPS) !== "done") {
    fail("設備應只有未起、起緊、完成三個畫面");
  }
  const count = map.facilities.length;
  const partial = emptySteps(map.facilities);
  partial[map.facilities[0].id] = BUILD_STEPS;
  partial[map.facilities[1].id] = BUILD_STEPS - 1;
  if (starCount(completedCount(map.facilities, partial), count) !== 1) {
    fail(`${map.title} 未建滿 5 步不應計星`);
  }
  if (starCount(count - 1, count) !== 5) fail(`${map.title} 完成 ${count - 1} 件應滿星`);

  function play(pick) {
    const steps = emptySteps(map.facilities);
    for (let n = 0; n < 40 && !isMapComplete(map.facilities, steps); n += 1) {
      const options = map.facilities.filter((item) => openFacilityIds(map.facilities, steps).includes(item.id));
      if (options.length === 0) {
        fail(`${map.title} 建造卡住`);
        return;
      }
      const id = pick(options).id;
      steps[id] += 1;
    }
    if (!isMapComplete(map.facilities, steps)) fail(`${map.title} 未能完工`);
    if (openFacilityIds(map.facilities, steps).length !== 0) fail(`${map.title} 完工後仍有空位`);
    if (starCount(completedCount(map.facilities, steps), count) !== 5) {
      fail(`${map.title} 全部完成應顯示 5 星`);
    }
  }
  play((options) => options[0]);
  play((options) => options[options.length - 1]);
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(
  `長度題 ${QUESTIONS.length} 題`,
  counts,
  `中文單位題幹 ${chinese}，英文縮寫題幹 ${english}`,
  `；時間題 ${TIME_QUESTIONS.length} 題`,
);
