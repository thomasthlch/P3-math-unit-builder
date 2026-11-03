import "./style.css";
import { QUESTIONS } from "./questions.js";
import { TIME_QUESTIONS } from "./time-questions.js";
import { MAPS, isFacilityOpen, isMapComplete, openFacilityIds } from "./rules.js";

const KIDS = [
  { label: "1 號", tint: "#ff5a5a" },
  { label: "2 號", tint: "#3c7dff" },
  { label: "3 號", tint: "#2fce73" },
];

const state = {
  phase: "ready",
  mapIndex: 0,
  built: new Set(),
  deck: [],
  lanes: [{}, {}, {}],
  queue: [],
  chooser: null,
  holding: false,
  pop: null,
  unlockId: null,
  toast: "",
  storyBeat: 0,
  sound: true,
};

const wrongTimers = [0, 0, 0];
let handoffTimer = 0;
let fxTimer = 0;
let storyTimer = 0;
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
  return currentMap().bank === "time" ? TIME_QUESTIONS : QUESTIONS;
}

function facilityById(id) {
  return currentMap().facilities.find((item) => item.id === id);
}

function canBuild(id) {
  return openFacilityIds(currentMap().facilities, state.built).includes(id);
}

function builtCount() {
  return state.built.size;
}

function clearTimers() {
  wrongTimers.forEach((timer, index) => {
    window.clearTimeout(timer);
    wrongTimers[index] = 0;
  });
  window.clearTimeout(handoffTimer);
  handoffTimer = 0;
  window.clearTimeout(fxTimer);
  fxTimer = 0;
  window.clearTimeout(storyTimer);
  storyTimer = 0;
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
  state.built = new Set();
  state.deck = [];
  state.queue = [];
  state.chooser = null;
  state.holding = false;
  state.pop = null;
  state.unlockId = null;
  state.toast = "";
  state.storyBeat = 0;
  state.lanes = [{}, {}, {}];
  for (let index = 0; index < KIDS.length; index += 1) deal(index);
  render();
}

function promoteChooser() {
  if (state.chooser != null || state.holding || state.phase !== "play") return;
  if (state.queue.length === 0) return;
  state.chooser = state.queue[0];
}

function onAnswer(laneIndex, choice) {
  const lane = state.lanes[laneIndex];
  if (state.phase !== "play" || !lane || lane.status !== "ask") return;
  if (choice === lane.question.answer) {
    lane.status = "queued";
    lane.hint = "";
    state.queue.push(laneIndex);
    playTone("ok");
    promoteChooser();
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

function onPlace(facilityId) {
  if (state.chooser == null || state.phase !== "play" || !canBuild(facilityId)) return;
  const laneIndex = state.chooser;
  const before = openFacilityIds(currentMap().facilities, state.built);
  state.built.add(facilityId);
  state.pop = facilityId;
  const facility = facilityById(facilityId);
  state.toast = `${KIDS[laneIndex].label} 建好了${facility.name}！`;
  const newly = openFacilityIds(currentMap().facilities, state.built).filter((id) => !before.includes(id));
  state.unlockId = newly[0] ?? null;
  state.queue.shift();
  state.chooser = null;
  state.holding = true;
  const won = isMapComplete(currentMap().facilities, state.built);
  if (won) state.lanes[laneIndex].status = "done";
  else deal(laneIndex);
  if (won) {
    state.phase = "story";
    state.storyBeat = 1;
    state.queue = [];
    playTone("win");
    window.clearTimeout(storyTimer);
    storyTimer = window.setTimeout(() => {
      state.storyBeat = 2;
      render();
    }, 900);
  } else if (state.unlockId) playTone("unlock");
  else playTone("place");
  render();
  window.clearTimeout(handoffTimer);
  handoffTimer = window.setTimeout(() => {
    state.holding = false;
    if (state.phase === "play") promoteChooser();
    render();
  }, won ? 400 : 650);
  window.clearTimeout(fxTimer);
  fxTimer = window.setTimeout(() => {
    state.pop = null;
    state.unlockId = null;
    state.toast = "";
    render();
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
  app.replaceChildren(
    h(
      "div",
      { class: "shell" },
      renderHeader(),
      h("div", { class: "rule-strip", text: "三人各做各的題。答對就選一件設備來建造；答錯會換下一題。" }),
      renderScene(),
      state.phase === "ready" ? renderReady() : renderLanes(),
    ),
  );
  watchFit();
}

function renderHeader() {
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
        h("div", { class: "brand-sub", text: `第 ${currentMap().level} 關 · ${currentMap().title}` }),
      ),
    ),
    h("div", { class: "progress-pill", text: `設備 ${builtCount()}/${currentMap().facilities.length}` }),
    h(
      "div",
      { class: "tools" },
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
    h(
      "div",
      { class: "sky-deco", "aria-hidden": "true" },
      h("div", { class: "cloud a" }),
      h("div", { class: "cloud b" }),
      map.theme === "day" ? h("div", { class: "sun" }) : h("div", { class: "moon" }),
    ),
    h("div", { class: "scene-name", text: map.title }),
    renderChecklist(),
    state.phase !== "story" && state.toast && !state.unlockId
      ? h("div", { class: "unlock-banner place-toast", text: state.toast })
      : null,
    state.phase !== "story" && state.unlockId
      ? h("div", { class: "unlock-banner", text: `解鎖設備：${facilityById(state.unlockId).name}！` })
      : null,
    h("div", { class: "scene-fit" }, h("div", { class: "plot-sizer" }, h("div", { class: "plot board" }, renderBoard()))),
    state.phase === "story" ? renderStory() : null,
    state.chooser != null ? renderChooser() : null,
  );
}

function renderChecklist() {
  const facilities = currentMap().facilities;
  return h(
    "div",
    { class: "checklist", "aria-label": "設備進度" },
    h("div", {
      class: "meter",
      "aria-hidden": "true",
    }, h("span", { style: `width:${Math.round((builtCount() / facilities.length) * 100)}%` })),
    ...facilities.map((item, index) => {
      const open = isFacilityOpen(index, builtCount());
      const done = state.built.has(item.id);
      const mark = done ? "完成" : open ? "可建" : "未開";
      return h("span", { class: `chip${done ? " is-done" : ""}${open ? "" : " is-locked"}`, text: `${item.name} ${mark}` });
    }),
  );
}

function renderBoard() {
  return currentMap().facilities.map((item, index) => {
    const open = isFacilityOpen(index, builtCount());
    const done = state.built.has(item.id);
    const fresh = done && state.pop === item.id;
    return h(
      "div",
      {
        class: `slot${item.wide ? " wide" : ""}${done ? " is-built" : ""}${open ? " is-open" : " is-locked"}${fresh ? " is-new" : ""}`,
        style: `left:${item.x}%;top:${item.y}%`,
      },
      done ? facilityArt(item.art) : h("div", { class: "pad", text: open ? "可建" : "未開" }),
      h("div", { class: "slot-name", text: item.name }),
    );
  });
}

function facilityArt(art) {
  return h(
    "div",
    { class: `art art-${art}`, "aria-hidden": "true" },
    h("i"),
    h("i"),
    h("i"),
  );
}

function renderChooser() {
  const laneIndex = state.chooser;
  const kid = KIDS[laneIndex];
  const waiting = state.queue.slice(1).map((index) => KIDS[index].label);
  return h(
    "div",
    { class: "chooser-back" },
    h(
      "div",
      { class: "chooser", role: "dialog", "aria-label": `${kid.label}選擇建造方向` },
      h("p", { class: "chooser-title", text: `${kid.label} 答對了！要建哪一件？` }),
      h(
        "div",
        { class: "chooser-grid" },
        currentMap().facilities.map((item, index) => {
          const open = isFacilityOpen(index, builtCount());
          const done = state.built.has(item.id);
          const enabled = open && !done;
          const note = done ? "已建成" : open ? "可建" : "未開";
          return h(
            "button",
            {
              type: "button",
              class: `place-btn art-btn${enabled ? "" : " is-locked"}`,
              "data-action": "place",
              "data-facility": item.id,
              disabled: enabled ? null : true,
            },
            facilityArt(item.art),
            h("span", { class: "place-name", text: item.name }),
            h("span", { class: "place-note", text: note }),
          );
        }),
      ),
      waiting.length ? h("p", { class: "chooser-queue", text: `接著排隊：${waiting.join("、")}` }) : null,
    ),
  );
}

function renderStory() {
  const map = currentMap();
  const last = state.mapIndex >= MAPS.length - 1;
  return h(
    "div",
    { class: "story-layer" },
    renderConfetti(),
    h("div", { class: "story-banner", text: `${map.done}！` }),
    state.storyBeat >= 2
      ? h("button", {
          type: "button",
          class: "mega again story-next",
          "data-action": last ? "replay" : "next",
          text: last ? "再玩一次" : "下一關",
        })
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

function renderReady() {
  return h(
    "section",
    { class: "ready" },
    h("div", { class: "ready-copy" },
      h("p", { class: "eyebrow", text: "電子白板合作" }),
      h("h1", { text: "三人一起建造" }),
      h(
        "ol",
        {},
        h("li", { text: "下面分成三格，每人做自己的題。" }),
      h("li", { text: "答對後，由你選一件設備建上去。" }),
      h("li", { text: "第 1 關是長度。建成後可以去第 2 關時間。" }),
      ),
    ),
    h("button", { type: "button", class: "mega go", "data-action": "start", text: "開始建造" }),
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
  const active = state.chooser === index;
  const queuedAt = state.queue.indexOf(index);
  if (state.phase === "story") {
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
      class: `lane${active ? " is-active" : ""}${lane.status === "wrong" ? " is-wrong" : ""}`,
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
    lane.status === "ask" ? renderAsk(index, lane) : renderLaneStatus(index, lane, queuedAt),
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

function renderLaneStatus(index, lane, queuedAt) {
  if (lane.status === "wrong") {
    return h(
      "div",
      { class: "lane-note bad", role: "status" },
      h("p", { class: "note-title", text: "再想一想，即將換下一題" }),
      h("p", { class: "note-hint", text: lane.hint }),
    );
  }
  const title = state.chooser === index ? "答對了！請在上面選設備" : "答對了，排隊等選位置";
  const detail =
    state.chooser === index
        ? "點選還沒建成的設備。"
      : queuedAt > 0
        ? `前面還有 ${queuedAt} 人`
        : "等積木放好就輪到你";
  return h(
    "div",
    { class: `lane-note ${state.chooser === index ? "good" : "wait"}`, role: "status" },
    h("p", { class: "note-title", text: title }),
    h("p", { text: detail }),
  );
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
  const availW = wrap.clientWidth;
  const availH = wrap.clientHeight;
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
  if (action === "start" || action === "replay") {
    startGame(0);
    return;
  }
  if (action === "next") {
    startGame(state.mapIndex + 1);
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
    onPlace(button.dataset.facility);
    return;
  }
  if (button.hasAttribute("data-lane") && button.hasAttribute("data-choice")) {
    onAnswer(Number(button.dataset.lane), button.dataset.choice);
  }
});

document.addEventListener("fullscreenchange", () => render());

render();
