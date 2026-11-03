import { QUESTIONS, UNIT_CHOICES } from "../src/questions.js";
import {
  DIRECTIONS,
  GOAL,
  MAX,
  UNLOCK_AT,
  emptyCounts,
  unlockedIds,
  isWin,
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

if (QUESTIONS.length < 60) fail(`題目只有 ${QUESTIONS.length} 題，少於 60`);
for (const type of ["A", "B", "C", "D", "E", "F", "G"]) {
  if (!counts[type]) fail(`缺少題型 ${type}`);
}

const chinese = QUESTIONS.filter((q) => /[公里米厘米毫米]/.test(q.prompt)).length;
const english = QUESTIONS.filter((q) => /\b(km|cm|mm|m)\b/.test(q.prompt)).length;
if (chinese < 20) fail("中文單位題太少");
if (english < 20) fail("英文縮寫題太少");

function canBuild(counts, id) {
  return unlockedIds(counts).includes(id) && counts[id] < MAX;
}

function play(pick) {
  const counts = emptyCounts();
  for (let step = 0; step < 80 && !isWin(counts); step += 1) {
    const options = DIRECTIONS.filter((dir) => canBuild(counts, dir.id));
    if (options.length === 0) {
      fail(`建造卡住：${JSON.stringify(counts)}`);
      return;
    }
    counts[pick(options, counts).id] += 1;
  }
  if (!isWin(counts)) fail(`未能完工：${JSON.stringify(counts)}`);
}

play((options) => options[0]);
play((options) => options[options.length - 1]);
play((options, counts) =>
  options.reduce((best, dir) => (counts[dir.id] > counts[best.id] ? dir : best)),
);
let seed = 7;
for (let round = 0; round < 30; round += 1) {
  play((options) => {
    seed = (seed * 17 + 3) % 997;
    return options[seed % options.length];
  });
}

if (UNLOCK_AT >= GOAL) fail("解鎖門檻應早於完工塊數，學生才有方向可選");
if (MAX < GOAL) fail("上限不能低於完工所需塊數");
const sample = emptyCounts();
sample.up = UNLOCK_AT;
if (!unlockedIds(sample).includes("forward")) fail("向上達標後應解鎖向前");
if (unlockedIds(sample).includes("left")) fail("不應一次跳過中間方向");

if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(
  `題庫 ${QUESTIONS.length} 題`,
  counts,
  `中文單位題幹 ${chinese}，英文縮寫題幹 ${english}`,
);
