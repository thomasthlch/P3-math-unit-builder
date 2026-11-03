/** 第 2 關時間換算。數字保持細小，進率是 60，不是多位數運算。 */

const TIME_UNITS = ["秒（s）", "分（min）", "小時（h）", "日（day）"];

const HINT = {
  H: "1 小時（h）= 60 分（min）。先把小時 ×60，再加上分。",
  M: "1 分（min）= 60 秒（s）。先把分 ×60，再加上秒。",
  S: "60 秒（s）= 1 分（min）。用秒 ÷60，得到的是分，剩下的是秒。",
  F: "60 分（min）= 1 小時（h）。用分 ÷60，得到的是小時，剩下的是分。",
};

function choiceSet(id, answer, distractors) {
  const choices = [answer, ...distractors];
  if (new Set(choices).size !== 4) {
    throw new Error(`${id} 選項需要 4 個而且不能重複：${choices.join(" | ")}`);
  }
  return choices;
}

function compound(major, minor, majorUnit, minorUnit) {
  return `${major} ${majorUnit} ${minor} ${minorUnit}`;
}

function makeAdd(id, type, big, small, bigUnit, smallUnit, ansUnit, factor, hint) {
  const value = big * factor + small;
  const answer = `${value} ${ansUnit}`;
  return {
    id,
    type,
    typeLabel: type === "H" ? "小時與分" : "分與秒",
    prompt: `${big} ${bigUnit} ${small} ${smallUnit} = ______ ${ansUnit}`,
    choices: choiceSet(id, answer, [
      `${big}${small} ${ansUnit}`,
      `${big + small} ${ansUnit}`,
      `${big * 100 + small} ${ansUnit}`,
    ]),
    answer,
    hint,
  };
}

function makeSplit(id, type, total, unit, majorUnit, minorUnit, factor, hint) {
  const major = Math.floor(total / factor);
  const minor = total % factor;
  const answer = compound(major, minor, majorUnit, minorUnit);
  return {
    id,
    type,
    typeLabel: type === "S" ? "秒換算" : "分換算",
    prompt: `${total} ${unit} = ______`,
    choices: choiceSet(id, answer, [
      `${total} ${majorUnit}`,
      compound(minor, major, majorUnit, minorUnit),
      compound(major + 1, minor, majorUnit, minorUnit),
    ]),
    answer,
    hint,
  };
}

function makeChoose(id, prompt, answer, hint) {
  return {
    id,
    type: "U",
    typeLabel: "選擇單位",
    prompt,
    choices: [...TIME_UNITS],
    answer,
    hint,
  };
}

export const TIME_QUESTIONS = [
  makeAdd("H01", "H", 1, 5, "小時", "分", "分", 60, HINT.H),
  makeAdd("H02", "H", 2, 3, "h", "min", "min", 60, HINT.H),
  makeAdd("H03", "H", 1, 8, "小時", "分", "分", 60, HINT.H),
  makeAdd("H04", "H", 2, 4, "小時", "min", "分", 60, HINT.H),
  makeAdd("H05", "H", 1, 6, "h", "分", "min", 60, HINT.H),
  makeAdd("H06", "H", 2, 1, "小時", "分", "分", 60, HINT.H),

  makeAdd("M01", "M", 1, 5, "分", "秒", "秒", 60, HINT.M),
  makeAdd("M02", "M", 2, 3, "min", "s", "s", 60, HINT.M),
  makeAdd("M03", "M", 1, 8, "分", "秒", "秒", 60, HINT.M),
  makeAdd("M04", "M", 2, 4, "分", "s", "秒", 60, HINT.M),
  makeAdd("M05", "M", 1, 6, "min", "秒", "s", 60, HINT.M),
  makeAdd("M06", "M", 2, 9, "分", "秒", "秒", 60, HINT.M),

  makeSplit("S01", "S", 70, "秒", "分", "秒", 60, HINT.S),
  makeSplit("S02", "S", 85, "秒", "分", "秒", 60, HINT.S),
  makeSplit("S03", "S", 100, "s", "min", "s", 60, HINT.S),
  makeSplit("S04", "S", 75, "秒", "分", "秒", 60, HINT.S),
  makeSplit("S05", "S", 90, "s", "min", "s", 60, HINT.S),
  makeSplit("S06", "S", 110, "秒", "分", "秒", 60, HINT.S),

  makeSplit("F01", "F", 65, "分", "小時", "分", 60, HINT.F),
  makeSplit("F02", "F", 70, "分", "小時", "分", 60, HINT.F),
  makeSplit("F03", "F", 80, "min", "h", "min", 60, HINT.F),
  makeSplit("F04", "F", 75, "分", "小時", "分", 60, HINT.F),
  makeSplit("F05", "F", 90, "min", "h", "min", 60, HINT.F),
  makeSplit("F06", "F", 100, "分", "小時", "分", 60, HINT.F),

  makeChoose("U01", "量度眨一眨眼的時間，最適合用哪一個單位？", "秒（s）", "眨眼非常短，比 1 分鐘更短，用秒。"),
  makeChoose("U02", "量度小息的時間，最適合用哪一個單位？", "分（min）", "小息大約幾分鐘到十多分鐘，用分。"),
  makeChoose("U03", "量度看一場電影的時間，最適合用哪一個單位？", "小時（h）", "一場電影大約一兩小時，用小時。"),
  makeChoose("U04", "量度煮一包即食麵的時間，最適合用哪一個單位？", "分（min）", "即食麵大約幾分鐘，用分。"),
  makeChoose("U05", "量度拍一下手的時間，最適合用哪一個單位？", "秒（s）", "拍一下手很短，用秒。"),
  makeChoose("U06", "量度晚上睡一覺的時間，最適合用哪一個單位？", "小時（h）", "睡一覺要好幾個小時，用小時。"),
];
