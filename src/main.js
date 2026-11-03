import "./style.css";
import { QUESTIONS } from "./questions.js";
import { TIME_QUESTIONS } from "./time-questions.js";
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
} from "./rules.js";

const ROUND_SECONDS = 60;

const KIDS = [
  { label: "1 號", tint: "#ff5a5a" },
  { label: "2 號", tint: "#3c7dff" },
  { label: "3 號", tint: "#2fce73" },
];

const state = {
  phase: "ready",
  mapIndex: 0,
  steps: {},
  secondsLeft: ROUND_SECONDS,
  finishAfterPlace: false,
  deck: [],
  lanes: [{}, {}, {}],
  pop: null,
  unlockId: null,
  toast: "",
  storyBeat: 0,
  sound: true,
};

const wrongTimers = [0, 0, 0];
let fxTimer = 0;
let storyTimer = 0;
let clockTimer = 0;
let audioCtx = null;
let fitObserver = null;

const app = document.querySelector("#app");

function h(tag, props, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props ?? {})) {
    if (value == null || value === false) continue;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else node.setAttribute(key, String(value));
  }
  const append = (child) => {
    if (child == null || child === false) return;
    if (Array.isArray(child)) {
      child.forEach(append);
      return;
    }
    node.append(child);
  };
  children.forEach(append);
  return node;
}

function shuffle(list) {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swap]] = [copy[swap], copy[index]];
  }
  return copy;
}

function currentMap() {
  return MAPS[state.mapIndex];
}

function questionBank() {
  return QUESTIONS.concat(TIME_QUESTIONS);
}

function facilityById(id) {
  return currentMap().facilities.find((item) => item.id === id);
}

function canBuild(id) {
  return openFacilityIds(currentMap().facilities, state.steps).includes(id);
}

function doneFacilities() {
  return completedCount(currentMap().facilities, state.steps);
}

function starsNow() {
  return starCount(doneFacilities(), currentMap().facilities.length);
}

function starGlyphs(count) {
  return `${"★".repeat(count)}${"☆".repeat(5 - count)}`;
}

function formatTime(seconds) {
  const safe = Math.max(0, seconds);
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

function clearTimers() {
  wrongTimers.forEach((timer, index) => {
    window.clearTimeout(timer);
    wrongTimers[index] = 0;
  });
  window.clearTimeout(fxTimer);
  fxTimer = 0;
  window.clearTimeout(storyTimer);
  storyTimer = 0;
  window.clearInterval(clockTimer);
  clockTimer = 0;
}

function startClock() {
  window.clearInterval(clockTimer);
  state.secondsLeft = ROUND_SECONDS;
  state.finishAfterPlace = false;
  clockTimer = window.setInterval(() => {
    if (state.phase !== "play") return;
    state.secondsLeft -= 1;
    const node = document.querySelector("[data-timer]");
    if (node) {
      node.textContent = formatTime(state.secondsLeft);
      node.classList.toggle("is-urgent", state.secondsLeft <= 10);
    }
    if (state.secondsLeft <= 0) onTimeUp();
  }, 1000);
}

function onTimeUp() {
  if (state.phase !== "play") return;
  window.clearInterval(clockTimer);
  clockTimer = 0;
  state.secondsLeft = 0;
  wrongTimers.forEach((timer, index) => {
    window.clearTimeout(timer);
    wrongTimers[index] = 0;
  });
  if (state.lanes.some((lane) => lane.status === "pick")) {
    state.finishAfterPlace = true;
    render();
    return;
  }
  enterResult();
}

function enterResult() {
  state.phase = "result";
  state.finishAfterPlace = false;
  state.pop = null;
  state.unlockId = null;
  state.toast = "";
  playTone("win");
  render();
}

function refill(exclude) {
  const bank = questionBank();
  const pool = bank.filter((question) => !exclude.has(question.id));
  state.deck = shuffle(pool.length ? pool : [...bank]);
}

function takeQuestion(exclude) {
  const usable = () => state.deck.some((question) => !exclude.has(question.id));
  if (!usable()) refill(exclude);
  for (let index = state.deck.length - 1; index >= 0; index -= 1) {
    if (!exclude.has(state.deck[index].id)) return state.deck.splice(index, 1)[0];
  }
  return state.deck.pop() ?? questionBank()[0];
}

function deal(laneIndex) {
  const exclude = new Set();
  state.lanes.forEach((lane, index) => {
    if (index !== laneIndex && lane.question) exclude.add(lane.question.id);
  });
  if (state.lanes[laneIndex]?.question) exclude.add(state.lanes[laneIndex].question.id);
  const question = takeQuestion(exclude);
  state.lanes[laneIndex] = {
    question,
    choices: shuffle(question.choices),
    status: "ask",
    hint: "",
  };
}

function startGame(mapIndex = 0) {
  clearTimers();
  state.mapIndex = mapIndex;
  state.phase = "play";
  state.steps = emptySteps(currentMap().facilities);
  state.deck = [];
  state.pop = null;
  state.unlockId = null;
  state.toast = "";
  state.storyBeat = 0;
  state.finishAfterPlace = false;
  state.secondsLeft = ROUND_SECONDS;
  state.lanes = [{}, {}, {}];
  for (let index = 0; index < KIDS.length; index += 1) deal(index);
  render();
  startClock();
}

function showMenu() {
  clearTimers();
  state.phase = "ready";
  state.finishAfterPlace = false;
  state.pop = null;
  state.unlockId = null;
  state.toast = "";
  state.storyBeat = 0;
  state.lanes = [{}, {}, {}];
  render();
}

function onAnswer(laneIndex, choice) {
  const lane = state.lanes[laneIndex];
  if (state.phase !== "play" || state.finishAfterPlace || !lane || lane.status !== "ask") return;
  if (choice === lane.question.answer) {
    lane.status = "pick";
    lane.hint = "";
    playTone("ok");
    render();
    return;
  }
  lane.status = "wrong";
  lane.hint = lane.question.hint;
  lane.miss = choice;
  playTone("bad");
  render();
  window.clearTimeout(wrongTimers[laneIndex]);
  wrongTimers[laneIndex] = window.setTimeout(() => {
    if (state.phase !== "play") return;
    if (state.lanes[laneIndex]?.status !== "wrong") return;
    deal(laneIndex);
    render();
  }, 2000);
}

function onPlace(laneIndex, facilityId) {
  const lane = state.lanes[laneIndex];
  if (state.phase !== "play" || !lane || lane.status !== "pick" || !canBuild(facilityId)) return;
  const before = openFacilityIds(currentMap().facilities, state.steps);
  state.steps[facilityId] = (state.steps[facilityId] ?? 0) + 1;
  const step = state.steps[facilityId];
  state.pop = facilityId;
  const facility = facilityById(facilityId);
  const finishedPiece = step >= BUILD_STEPS;
  state.toast = finishedPiece
    ? `${KIDS[laneIndex].label} 完成${facility.name}！`
    : `${KIDS[laneIndex].label} 起緊${facility.name} ${step}/5`;
  const newly = finishedPiece
    ? openFacilityIds(currentMap().facilities, state.steps).filter((id) => !before.includes(id))
    : [];
  state.unlockId = newly[0] ?? null;
  const won = isMapComplete(currentMap().facilities, state.steps);
  if (won) {
    window.clearInterval(clockTimer);
    state.phase = "story";
    state.storyBeat = 1;
    state.finishAfterPlace = false;
    state.lanes[laneIndex].status = "done";
    playTone("win");
    window.clearTimeout(storyTimer);
    storyTimer = window.setTimeout(() => {
      state.storyBeat = 2;
      render();
    }, 900);
  } else if (state.finishAfterPlace) {
    state.lanes[laneIndex].status = "done";
    if (!state.lanes.some((item) => item.status === "pick")) {
      enterResult();
      return;
    }
    if (state.unlockId) playTone("unlock");
    else playTone("place");
  } else {
    deal(laneIndex);
    if (state.unlockId) playTone("unlock");
    else playTone("place");
  }
  render();
  window.clearTimeout(fxTimer);
  fxTimer = window.setTimeout(() => {
    state.pop = null;
    state.unlockId = null;
    state.toast = "";
    if (state.phase === "play" || state.phase === "story") render();
  }, won || state.unlockId ? 2200 : 1600);
}

function playTone(kind) {
  if (!state.sound) return;
  const notes = {
    ok: [523, 784],
    place: [494, 659, 880],
    unlock: [523, 659, 784, 1046],
    win: [523, 659, 784, 1046, 784],
    bad: [196, 156],
  }[kind] ?? [440];
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === "suspended") void audioCtx.resume();
    notes.forEach((freq, index) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "square";
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      const start = audioCtx.currentTime + index * 0.07;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.04, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.14);
      osc.start(start);
      osc.stop(start + 0.16);
    });
  } catch {
    /* 沒有音效也可以玩。 */
  }
}

function toggleFullscreen() {
  if (document.fullscreenElement) {
    void document.exitFullscreen();
    return;
  }
  void document.documentElement.requestFullscreen?.().catch(() => {});
}

function render() {
  app.className = `phase-${state.phase}`;
  if (state.phase === "ready") {
    app.replaceChildren(h("div", { class: "shell" }, renderHeader(true), renderMapSelect()));
    return;
  }
  app.replaceChildren(
    h(
      "div",
      { class: "shell" },
      renderHeader(false),
      h("div", { class: "rule-strip", text: "三人各做各的題。答對就在自己的格子選設備；答錯會換下一題。" }),
      renderScene(),
      renderLanes(),
    ),
  );
  watchFit();
}

function renderHeader(selecting) {
  return h(
    "header",
    { class: "header" },
    h(
      "div",
      { class: "brand" },
      h("span", { class: "logo-brick", "aria-hidden": "true" }),
      h(
        "div",
        {},
        h("div", { class: "brand-title", text: "長度積木基地" }),
        h("div", {
          class: "brand-sub",
          text: selecting ? "五關都可以選" : `第 ${currentMap().level} 關 · ${currentMap().title}`,
        }),
      ),
    ),
    selecting
      ? null
      : h("div", {
          class: `timer${state.secondsLeft <= 10 ? " is-urgent" : ""}`,
          "data-timer": "1",
          text: formatTime(state.secondsLeft),
        }),
    selecting ? null : h("div", { class: "progress-pill", text: `${starGlyphs(starsNow())} ${starsNow()}/5` }),
    h(
      "div",
      { class: selecting ? "tools is-end" : "tools" },
      h("button", {
        type: "button",
        class: "tool",
        "data-action": "sound",
        "aria-pressed": state.sound ? "true" : "false",
        text: state.sound ? "音效 開" : "音效 關",
      }),
      h("button", {
        type: "button",
        class: "tool",
        "data-action": "fullscreen",
        text: document.fullscreenElement ? "退出全螢幕" : "全螢幕",
      }),
    ),
  );
}

function renderScene() {
  const map = currentMap();
  return h(
    "section",
    { class: `scene theme-${map.theme}${state.phase === "story" ? " is-won" : ""}`, "aria-label": "建造區" },
    renderSky(map),
    h("div", { class: "scene-name", text: map.title }),
    renderChecklist(),
    state.phase !== "story" && state.toast && !state.unlockId
      ? h("div", { class: "unlock-banner place-toast", text: state.toast })
      : null,
    state.phase !== "story" && state.unlockId
      ? h("div", { class: "unlock-banner", text: `解鎖設備：${facilityById(state.unlockId).name}！` })
      : null,
    h("div", { class: "scene-fit" }, h("div", { class: "plot-sizer" }, h("div", { class: "plot board" }, renderBoard()))),
    state.phase === "story" || state.phase === "result" ? renderFinale() : null,
  );
}

function renderSky(map) {
  const body =
    map.sky === "moon" ? h("div", { class: "moon" }) : map.sky === "stars" ? h("div", { class: "stars" }) : h("div", { class: "sun" });
  return h(
    "div",
    { class: "sky-deco", "aria-hidden": "true" },
    map.sky === "stars" ? null : h("div", { class: "cloud a" }),
    map.sky === "stars" ? null : h("div", { class: "cloud b" }),
    body,
  );
}

function stepOf(id) {
  return state.steps[id] ?? 0;
}

function chipMark(step, open) {
  if (step >= BUILD_STEPS) return "完成";
  if (!open) return "未開";
  if (step === 0) return "未起";
  return `起緊 ${step}/5`;
}

function renderChecklist() {
  const facilities = currentMap().facilities;
  const totalSteps = facilities.reduce((sum, item) => sum + stepOf(item.id), 0);
  const maxSteps = facilities.length * BUILD_STEPS;
  const done = doneFacilities();
  return h(
    "div",
    { class: "checklist", "aria-label": "設備進度" },
    h("div", { class: "meter", "aria-hidden": "true" }, h("span", { style: `width:${Math.round((totalSteps / maxSteps) * 100)}%` })),
    ...facilities.map((item, index) => {
      const open = isFacilityOpen(index, done);
      const step = stepOf(item.id);
      const stage = stageOf(step);
      return h("span", {
        class: `chip stage-${stage}${open || stage === "done" ? "" : " is-locked"}`,
        text: `${item.name} ${chipMark(step, open)}`,
      });
    }),
  );
}

function renderBoard() {
  const done = doneFacilities();
  return currentMap().facilities.map((item, index) => {
    const open = isFacilityOpen(index, done);
    const step = stepOf(item.id);
    const stage = stageOf(step);
    const fresh = state.pop === item.id;
    return h(
      "div",
      {
        class: `slot${item.wide ? " wide" : ""} stage-${stage}${open || stage === "done" ? " is-open" : " is-locked"}${fresh ? " is-new" : ""}`,
        style: `left:${item.x}%;top:${item.y}%`,
      },
      stage === "empty"
        ? h("div", { class: "pad", text: open ? "未起" : "未開" })
        : facilityArt(item, stage),
      renderPips(step),
      h("div", { class: "slot-name", text: `${item.name} ${chipMark(step, open)}` }),
    );
  });
}

function renderPips(step) {
  return h(
    "span",
    { class: "pips", "aria-hidden": "true" },
    Array.from({ length: BUILD_STEPS }, (_, index) => h("i", { class: index < step ? "on" : "" })),
  );
}

function facilityArt(item, stage = "done") {
  if (item.emoji) {
    return h("div", { class: `art art-emoji is-${stage}`, "aria-hidden": "true", text: item.emoji });
  }
  return h(
    "div",
    { class: `art art-${item.art} is-${stage}`, "aria-hidden": "true" },
    h("i"),
    h("i"),
    h("i"),
  );
}

function renderFinale() {
  const map = currentMap();
  const hasNext = state.mapIndex + 1 < MAPS.length;
  const timedOut = state.phase === "result";
  const stars = starsNow();
  const showActions = state.storyBeat >= 2 || timedOut;
  return h(
    "div",
    { class: "story-layer" },
    renderConfetti(),
    h("div", { class: "story-banner", text: timedOut ? "時間到" : `${map.done}！` }),
    h("div", { class: "star-banner", text: `${starGlyphs(stars)} ${stars}/5` }),
    showActions
      ? h(
          "div",
          { class: "finale-actions" },
          h("button", {
            type: "button",
            class: "mega story-back",
            "data-action": "menu",
            text: "返回選關",
          }),
          hasNext
            ? h("button", {
                type: "button",
                class: "mega again",
                "data-action": "next",
                text: "下一關",
              })
            : null,
        )
      : h("p", { class: "story-wait", text: "三人一起建好了！" }),
  );
}

function renderConfetti() {
  const colors = ["#ff5a5a", "#ffd84a", "#3c7dff", "#2fce73", "#b06bff", "#ff8a2a", "#fff"];
  return h(
    "div",
    { class: "confetti", "aria-hidden": "true" },
    Array.from({ length: 32 }, (_, index) =>
      h("i", {
        style: `left:${(index * 29) % 100}%;background:${colors[index % colors.length]};animation-delay:${(index % 8) * 0.08}s`,
      }),
    ),
  );
}

function renderMapSelect() {
  return h(
    "section",
    { class: "map-select" },
    h(
      "div",
      { class: "ready-copy" },
      h("p", { class: "eyebrow", text: "電子白板合作" }),
      h("h1", { text: "選一關開始" }),
      h(
        "ol",
        {},
        h("li", { text: "五關都可以直接開始，不用解鎖。" }),
        h("li", { text: "三人各做各的題。答對就在自己的格子選設備。" }),
        h("li", { text: "每關約 60 秒。時間到會按建成的設備給星星。" }),
      ),
    ),
    h(
      "div",
      { class: "map-grid" },
      MAPS.map((map, index) =>
        h(
          "button",
          {
            type: "button",
            class: `map-card theme-${map.theme}`,
            "data-action": "start",
            "data-map": String(index),
          },
          h("span", { class: "map-mark", "aria-hidden": "true", text: map.mark }),
          h(
            "span",
            { class: "map-copy" },
            h("span", { class: "map-level", text: `第 ${map.level} 關` }),
            h("span", { class: "map-title", text: map.title }),
          ),
          h("span", { class: "map-count", text: `${map.facilities.length} 件` }),
        ),
      ),
    ),
  );
}

function renderLanes() {
  return h(
    "section",
    { class: "lanes", "aria-label": "三人作答" },
    KIDS.map((kid, index) => renderLane(index, kid)),
  );
}

function renderLane(index, kid) {
  const lane = state.lanes[index] ?? {};
  if (state.phase === "story" || state.phase === "result") {
    return h(
      "article",
      { class: "lane is-done", "data-lane-panel": String(index) },
      h(
        "div",
        { class: "lane-head", style: `--tint:${kid.tint}` },
        h("span", { class: "face", text: String(index + 1) }),
        h("span", { class: "lane-name", text: kid.label }),
      ),
      h("div", { class: "lane-note good" }, h("p", { class: "note-title", text: "完工" })),
    );
  }
  return h(
    "article",
    {
      class: `lane${lane.status === "pick" ? " is-active" : ""}${lane.status === "wrong" ? " is-wrong" : ""}`,
      "data-lane-panel": String(index),
    },
    h(
      "div",
      { class: "lane-head", style: `--tint:${kid.tint}` },
      h("span", { class: "face", text: String(index + 1) }),
      h("span", { class: "lane-name", text: kid.label }),
      lane.question && lane.status === "ask"
        ? h("span", { class: "type-badge", text: lane.question.typeLabel })
        : null,
    ),
    laneBody(index, lane),
  );
}

function laneBody(index, lane) {
  if (state.finishAfterPlace && lane.status !== "pick") {
    return h(
      "div",
      { class: "lane-note wait", role: "status" },
      h("p", { class: "note-title", text: "時間到" }),
    );
  }
  if (lane.status === "ask") return renderAsk(index, lane);
  if (lane.status === "pick") return renderPick(index);
  if (lane.status === "wrong") {
    return h(
      "div",
      { class: "lane-note bad", role: "status" },
      h("p", { class: "note-title", text: "再想一想，即將換下一題" }),
      h("p", { class: "note-hint", text: lane.hint }),
    );
  }
  return h(
    "div",
    { class: "lane-note wait", role: "status" },
    h("p", { class: "note-title", text: "等下一題" }),
  );
}

function renderPick(laneIndex) {
  const done = doneFacilities();
  return h(
    "div",
    { class: "lane-pick" },
    h("p", { class: "note-title", text: "答對了！建哪一件？" }),
    h(
      "div",
      { class: "lane-places" },
      currentMap().facilities.map((item, index) => {
        const open = isFacilityOpen(index, done);
        const step = stepOf(item.id);
        const enabled = open && step < BUILD_STEPS;
        const label = item.emoji ? `${item.emoji} ${item.name}` : item.name;
        return h(
          "button",
          {
            type: "button",
            class: `lane-place${enabled ? "" : " is-locked"}`,
            "data-action": "place",
            "data-lane": String(laneIndex),
            "data-facility": item.id,
            disabled: enabled ? null : true,
          },
          h("span", { class: "place-name", text: label }),
          h("span", { class: "place-note", text: chipMark(step, open) }),
        );
      }),
    ),
  );
}

function renderAsk(index, lane) {
  return [
    h("p", { class: "prompt", text: lane.question.prompt }),
    h(
      "div",
      { class: "choices", role: "group", "aria-label": `${KIDS[index].label}的答案` },
      lane.choices.map((choice) =>
        h("button", {
          type: "button",
          class: "choice",
          "data-lane": String(index),
          "data-choice": choice,
          text: choice,
        }),
      ),
    ),
  ];
}

function fitPlot() {
  const wrap = document.querySelector(".scene-fit");
  const sizer = document.querySelector(".plot-sizer");
  const plot = document.querySelector(".plot");
  if (!wrap || !sizer || !plot) return;
  plot.style.transform = "none";
  sizer.style.width = "auto";
  sizer.style.height = "auto";
  const width = Math.max(plot.offsetWidth, plot.scrollWidth);
  const height = Math.max(plot.offsetHeight, plot.scrollHeight);
  const pad = getComputedStyle(wrap);
  const availW = wrap.clientWidth - parseFloat(pad.paddingLeft) - parseFloat(pad.paddingRight);
  const availH = wrap.clientHeight - parseFloat(pad.paddingTop) - parseFloat(pad.paddingBottom);
  if (!width || !height || !availW || !availH) return;
  const scale = Math.min(1.65, (availW - 24) / width, (availH - 12) / height);
  sizer.style.width = `${Math.floor(width * scale)}px`;
  sizer.style.height = `${Math.floor(height * scale)}px`;
  plot.style.transformOrigin = "top left";
  plot.style.transform = `scale(${scale})`;
}

function watchFit() {
  const wrap = document.querySelector(".scene-fit");
  if (!wrap) return;
  if (!fitObserver) fitObserver = new ResizeObserver(() => fitPlot());
  fitObserver.disconnect();
  fitObserver.observe(wrap);
  fitPlot();
}

app.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button || !app.contains(button)) return;
  const action = button.dataset.action;
  if (action === "start") {
    const index = Number(button.dataset.map);
    if (!Number.isInteger(index) || !MAPS[index]) return;
    startGame(index);
    return;
  }
  if (action === "menu") {
    showMenu();
    return;
  }
  if (action === "next") {
    if (state.mapIndex + 1 < MAPS.length) startGame(state.mapIndex + 1);
    return;
  }
  if (action === "fullscreen") {
    toggleFullscreen();
    return;
  }
  if (action === "sound") {
    state.sound = !state.sound;
    render();
    return;
  }
  if (action === "place") {
    onPlace(Number(button.dataset.lane), button.dataset.facility);
    return;
  }
  if (button.hasAttribute("data-lane") && button.hasAttribute("data-choice")) {
    onAnswer(Number(button.dataset.lane), button.dataset.choice);
  }
});

document.addEventListener("fullscreenchange", () => render());

render();
