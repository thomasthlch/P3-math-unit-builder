/** 小三長度換算題庫。數字保持細小，方便口算進率和換算，而不是多位數運算。 */

export const UNIT_CHOICES = ["毫米（mm）", "厘米（cm）", "米（m）", "公里（km）"];

const HINT = {
  A: "1 公里（km）= 1000 米（m）。先把公里 ×1000，再加上米。",
  B: "1 厘米（cm）= 10 毫米（mm）。先把厘米 ×10，再加上毫米。",
  C: "10 毫米（mm）= 1 厘米（cm）。用毫米 ÷10，得到的是厘米，剩下的是毫米。",
  D: "1000 米（m）= 1 公里（km）。用米 ÷1000，得到的是公里，剩下的是米。",
  E: "1 米（m）= 100 厘米（cm）。先把米 ×100，再加上厘米。",
  F: "100 厘米（cm）= 1 米（m）。用厘米 ÷100，得到的是米，剩下的是厘米。",
};

const TYPE_LABEL = {
  A: "公里與米",
  B: "厘米與毫米",
  C: "毫米換算",
  D: "米換算",
  E: "米與厘米",
  F: "厘米換算",
  G: "選擇單位",
};

function choiceSet(id, answer, distractors) {
  const choices = [answer, ...distractors];
  if (new Set(choices).size !== 4) {
    throw new Error(`${id} 選項需要 4 個而且不能重複：${choices.join(" | ")}`);
  }
  if (!choices.includes(answer)) {
    throw new Error(`${id} 答案不在選項中`);
  }
  return choices;
}

function compound(major, minor, majorUnit, minorUnit) {
  if (minor === 0) return `${major} ${majorUnit}`;
  return `${major} ${majorUnit} ${minor} ${minorUnit}`;
}

function cmUnitFor(mmUnit) {
  if (mmUnit === "毫米") return "厘米";
  if (mmUnit === "mm") return "cm";
  throw new Error(`未知毫米單位：${mmUnit}`);
}

function kmUnitFor(mUnit) {
  if (mUnit === "米") return "公里";
  if (mUnit === "m") return "km";
  throw new Error(`未知米單位：${mUnit}`);
}

function mUnitFor(cmUnit) {
  if (cmUnit === "厘米") return "米";
  if (cmUnit === "cm") return "m";
  throw new Error(`未知厘米單位：${cmUnit}`);
}

function make(id, type, prompt, choices, answer, hint) {
  return {
    id,
    type,
    typeLabel: TYPE_LABEL[type],
    prompt,
    choices,
    answer,
    hint,
  };
}

function makeA(id, km, m, kmUnit, mUnit, ansUnit) {
  const value = km * 1000 + m;
  const answer = `${value} ${ansUnit}`;
  const choices = choiceSet(id, answer, [
    `${km}${m} ${ansUnit}`,
    `${km * 100 + m} ${ansUnit}`,
    `${km + m} ${ansUnit}`,
  ]);
  const prompt = `${km} ${kmUnit} ${m} ${mUnit} = ______ ${ansUnit}`;
  return make(id, "A", prompt, choices, answer, HINT.A);
}

function makeB(id, cm, mm, cmUnit, mmUnit, ansUnit) {
  const value = cm * 10 + mm;
  const answer = `${value} ${ansUnit}`;
  const choices = choiceSet(id, answer, [
    `${cm + mm} ${ansUnit}`,
    `${mm}${cm} ${ansUnit}`,
    `${cm * 100 + mm} ${ansUnit}`,
  ]);
  const prompt = `${cm} ${cmUnit} ${mm} ${mmUnit} = ______ ${ansUnit}`;
  return make(id, "B", prompt, choices, answer, HINT.B);
}

function makeC(id, mm, mmUnit) {
  const cm = Math.floor(mm / 10);
  const rest = mm % 10;
  const cmUnit = cmUnitFor(mmUnit);
  const answer = compound(cm, rest, cmUnit, mmUnit);
  const choices = choiceSet(id, answer, [
    compound(rest, cm, cmUnit, mmUnit),
    `${mm} ${cmUnit}`,
    compound(cm + 1, rest, cmUnit, mmUnit),
  ]);
  return make(id, "C", `${mm} ${mmUnit} = ______`, choices, answer, HINT.C);
}

function makeD(id, meters, mUnit) {
  const km = Math.floor(meters / 1000);
  const rest = meters % 1000;
  const kmUnit = kmUnitFor(mUnit);
  const answer = compound(km, rest, kmUnit, mUnit);
  const choices = choiceSet(id, answer, [
    compound(km * 10, rest, kmUnit, mUnit),
    compound(km, rest * 10, kmUnit, mUnit),
    `${meters} ${kmUnit}`,
  ]);
  return make(id, "D", `${meters} ${mUnit} = ______`, choices, answer, HINT.D);
}

function makeE(id, m, cm, mUnit, cmUnit, ansUnit) {
  const value = m * 100 + cm;
  const answer = `${value} ${ansUnit}`;
  const choices = choiceSet(id, answer, [
    `${m}${cm} ${ansUnit}`,
    `${m + cm} ${ansUnit}`,
    `${m * 1000 + cm} ${ansUnit}`,
  ]);
  const prompt = `${m} ${mUnit} ${cm} ${cmUnit} = ______ ${ansUnit}`;
  return make(id, "E", prompt, choices, answer, HINT.E);
}

function makeF(id, totalCm, cmUnit) {
  const m = Math.floor(totalCm / 100);
  const rest = totalCm % 100;
  const mUnit = mUnitFor(cmUnit);
  const answer = compound(m, rest, mUnit, cmUnit);
  const choices = choiceSet(id, answer, [
    compound(m * 10, rest, mUnit, cmUnit),
    compound(m, rest * 10, mUnit, cmUnit),
    `${m}${rest} ${mUnit}`,
  ]);
  return make(id, "F", `${totalCm} ${cmUnit} = ______`, choices, answer, HINT.F);
}

function makeG(id, prompt, answer, hint) {
  return make(id, "G", prompt, [...UNIT_CHOICES], answer, hint);
}

export const QUESTIONS = [
  makeA("A01", 2, 3, "公里", "米", "米"),
  makeA("A02", 1, 4, "km", "m", "m"),
  makeA("A03", 3, 5, "公里", "米", "米"),
  makeA("A04", 4, 2, "km", "m", "m"),
  makeA("A05", 2, 6, "公里", "m", "米"),
  makeA("A06", 5, 1, "km", "米", "m"),
  makeA("A07", 1, 8, "公里", "米", "米"),
  makeA("A08", 3, 7, "km", "m", "米"),
  makeA("A09", 4, 9, "公里", "m", "m"),
  makeA("A10", 2, 1, "km", "米", "米"),
  makeA("A11", 6, 2, "km", "m", "m"),
  makeA("A12", 3, 8, "公里", "米", "米"),
  makeA("A13", 5, 4, "km", "m", "米"),
  makeA("A14", 1, 9, "公里", "米", "米"),

  makeB("B01", 2, 3, "厘米", "毫米", "毫米"),
  makeB("B02", 3, 4, "cm", "mm", "mm"),
  makeB("B03", 1, 5, "厘米", "毫米", "毫米"),
  makeB("B04", 4, 2, "cm", "mm", "mm"),
  makeB("B05", 2, 8, "厘米", "mm", "毫米"),
  makeB("B06", 5, 6, "cm", "毫米", "mm"),
  makeB("B07", 3, 1, "厘米", "毫米", "毫米"),
  makeB("B08", 1, 7, "cm", "mm", "毫米"),
  makeB("B09", 4, 5, "厘米", "mm", "mm"),
  makeB("B10", 2, 9, "cm", "毫米", "毫米"),
  makeB("B11", 6, 2, "厘米", "毫米", "毫米"),
  makeB("B12", 3, 8, "cm", "mm", "mm"),
  makeB("B13", 5, 4, "厘米", "mm", "毫米"),
  makeB("B14", 6, 7, "cm", "毫米", "mm"),

  makeC("C01", 23, "毫米"),
  makeC("C02", 35, "mm"),
  makeC("C03", 18, "毫米"),
  makeC("C04", 42, "mm"),
  makeC("C05", 27, "毫米"),
  makeC("C06", 51, "mm"),
  makeC("C07", 16, "毫米"),
  makeC("C08", 39, "mm"),
  makeC("C09", 14, "毫米"),
  makeC("C10", 47, "mm"),
  makeC("C11", 19, "毫米"),

  makeD("D01", 2003, "米"),
  makeD("D02", 1004, "m"),
  makeD("D03", 3005, "米"),
  makeD("D04", 4002, "m"),
  makeD("D05", 5008, "米"),
  makeD("D06", 1006, "m"),
  makeD("D07", 2009, "米"),
  makeD("D08", 3001, "m"),
  makeD("D09", 6003, "米"),
  makeD("D10", 1007, "m"),
  makeD("D11", 4006, "米"),

  makeE("E01", 2, 3, "米", "厘米", "厘米"),
  makeE("E02", 1, 4, "m", "cm", "cm"),
  makeE("E03", 3, 5, "米", "厘米", "厘米"),
  makeE("E04", 1, 8, "m", "cm", "cm"),
  makeE("E05", 2, 6, "米", "cm", "厘米"),
  makeE("E06", 4, 1, "m", "厘米", "cm"),
  makeE("E07", 3, 2, "米", "厘米", "厘米"),
  makeE("E08", 2, 7, "m", "cm", "cm"),
  makeE("E09", 5, 2, "米", "厘米", "厘米"),
  makeE("E10", 3, 8, "m", "cm", "cm"),
  makeE("E11", 4, 6, "米", "厘米", "厘米"),

  makeF("F01", 203, "厘米"),
  makeF("F02", 104, "cm"),
  makeF("F03", 305, "厘米"),
  makeF("F04", 108, "cm"),
  makeF("F05", 402, "厘米"),
  makeF("F06", 206, "cm"),
  makeF("F07", 301, "厘米"),
  makeF("F08", 109, "cm"),
  makeF("F09", 503, "厘米"),
  makeF("F10", 207, "cm"),
  makeF("F11", 406, "厘米"),

  makeG(
    "G01",
    "量度手腕的闊度，最適合用哪一個單位？",
    "厘米（cm）",
    "手腕大約只有幾厘米那麼闊，比 1 米短很多。",
  ),
  makeG(
    "G02",
    "量度課室門的高度，最適合用哪一個單位？",
    "米（m）",
    "課室門比我們高一點點，用米最合適。",
  ),
  makeG(
    "G03",
    "量度由屯門前往尖沙咀的路程，最適合用哪一個單位？",
    "公里（km）",
    "這段路要坐很久車，比米長很多很多，用公里。",
  ),
  makeG(
    "G04",
    "量度硬幣的厚度，最適合用哪一個單位？",
    "毫米（mm）",
    "硬幣很薄，比 1 厘米更薄，用毫米。",
  ),
  makeG(
    "G05",
    "量度數學書的長度，最適合用哪一個單位？",
    "厘米（cm）",
    "數學書的長度跟直尺差不多，用厘米。",
  ),
  makeG(
    "G06",
    "量度一輛校巴的長度，最適合用哪一個單位？",
    "米（m）",
    "校巴比課室門長很多，但遠不到 1 公里，用米。",
  ),
  makeG(
    "G07",
    "量度鉛筆芯的直徑，最適合用哪一個單位？",
    "毫米（mm）",
    "鉛筆芯非常幼，比 1 厘米更小，用毫米。",
  ),
  makeG(
    "G08",
    "量度一塊膠擦的長度，最適合用哪一個單位？",
    "厘米（cm）",
    "膠擦可以用直尺量到，用厘米。",
  ),
  makeG(
    "G09",
    "量度港島來往九龍的距離，最適合用哪一個單位？",
    "公里（km）",
    "要過海或坐一段車，路程很長，用公里。",
  ),
  makeG(
    "G10",
    "量度指甲的厚度，最適合用哪一個單位？",
    "毫米（mm）",
    "指甲非常薄，比 1 厘米更薄，用毫米。",
  ),
  makeG(
    "G11",
    "量度黑板的長度，最適合用哪一個單位？",
    "米（m）",
    "黑板比張開雙手更長，用米。",
  ),
  makeG(
    "G12",
    "量度學校操場直跑道的長度，最適合用哪一個單位？",
    "米（m）",
    "直跑道大約是一百米那種長度，用米，不用公里。",
  ),
];
