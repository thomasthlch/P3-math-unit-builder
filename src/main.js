import "./style.css";
import { QUESTIONS } from "./questions.js";
import {
  DIRECTIONS,
  GOAL,
  MAX,
  baseTitle,
  emptyCounts,
  isWin,
  unlockedIds,
} from "./rules.js";

const KIDS = [
  { label: "1 號", tint: "#ff5a5a" },
  { label: "2 號", tint: "#3c7dff" },
  { label: "3 號", tint: "#2fce73" },
];

const state = {
  phase: "ready",
  counts: emptyCounts(),
  deck: [],
  lanes: [{}, {}, {}],
  queue: [],
  chooser: null,
  holding: false,
  pop: null,
  unlockId: null,
  toast: "",
  sound: true,
};

const wrongTimers = [0, 0, 0];
let handoffTimer = 0;
let fxTimer = 0;
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

function dirById(id) {
  return DIRECTIONS.find((dir) => dir.id === id);
}

function canBuild(id) {
  return unlockedIds(state.counts).includes(id) && state.counts[id] < MAX;
}

function doneCount() {
  return DIRECTIONS.filter((dir) => state.counts[dir.id] >= GOAL).length;
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
}

function refill(exclude) {
  const pool = QUESTIONS.filter((question) => !exclude.has(question.id));
  state.deck = shuffle(pool.length ? pool : [...QUESTIONS]);
}

function takeQuestion(exclude) {
  const usable = () => state.deck.some((question) => !exclude.has(question.id));
  if (!usable()) refill(exclude);
  for (let index = state.deck.length - 1; index >= 0; index -= 1) {
    if (!exclude.has(state.deck[index].id)) return state.deck.splice(index, 1)[0];
  }
  return state.deck.pop() ?? QUESTIONS[0];
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

function startGame() {
  clearTimers();
  state.phase = "play";
  state.counts = emptyCounts();
  state.deck = [];
  state.queue = [];
  state.chooser = null;
  state.holding = false;
  state.pop = null;
  state.unlockId = null;
  state.toast = "";
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

function onPlace(dirId) {
  if (state.chooser == null || state.phase !== "play" || !canBuild(dirId)) return;
  const laneIndex = state.chooser;
  const before = unlockedIds(state.counts);
  state.counts[dirId] += 1;
  state.pop = { dir: dirId, lane: laneIndex };
  state.toast = `${KIDS[laneIndex].label} 在「${dirById(dirId).label}」放了一塊！`;
  const newly = unlockedIds(state.counts).filter((id) => !before.includes(id));
  state.unlockId = newly[0] ?? null;
  state.queue.shift();
  state.chooser = null;
  state.holding = true;
  const won = isWin(state.counts);
  if (won) state.lanes[laneIndex].status = "done";
  else deal(laneIndex);
  if (won) {
    state.phase = "won";
    state.queue = [];
    playTone("win");
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
      h("div", { class: "rule-strip", text: "三人各做各的題。答對就選方向放積木；答錯會換下一題。" }),
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
        h("div", { class: "brand-sub", text: "小三長度單位 · 三人同時" }),
      ),
    ),
    h("div", { class: "progress-pill", text: `方向 ${doneCount()}/6` }),
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
  return h(
    "section",
    { class: `scene${state.phase === "won" ? " is-won" : ""}`, "aria-label": "建造區" },
    h(
      "div",
      { class: "sky-deco", "aria-hidden": "true" },
      h("div", { class: "cloud a" }),
      h("div", { class: "cloud b" }),
      h("div", { class: "sun" }),
    ),
    h("div", { class: "scene-name", text: baseTitle(state.counts) }),
    state.toast && !state.unlockId
      ? h("div", { class: "unlock-banner place-toast", text: state.toast })
      : null,
    state.unlockId
      ? h("div", { class: "unlock-banner", text: `解鎖新方向：${dirById(state.unlockId).label}！` })
      : null,
    h("div", { class: "scene-fit" }, h("div", { class: "plot-sizer" }, h("div", { class: "plot" }, renderPlot()))),
    state.phase === "won" ? renderWin() : null,
    state.chooser != null ? renderChooser() : null,
  );
}

function renderPlot() {
  return [
    zone("up", "up-zone", h("div", { class: "vstack" }, bricks("up", { reverse: true }))),
    h(
      "div",
      { class: "land" },
      h(
        "div",
        { class: "ground" },
        zone("left", "wing", h("div", { class: "row" }, bricks("left", { reverse: true }))),
        h(
          "div",
          { class: "brick filled base" },
          h("span", { class: "stud" }),
          h("span", { class: "stud second" }),
          h("span", { class: "base-name", text: "基地" }),
        ),
        zone("right", "wing", h("div", { class: "row" }, bricks("right"))),
      ),
      zone("forward", "forward-zone", h("div", { class: "row" }, bricks("forward"))),
      h(
        "div",
        { class: "under" },
        zone("down", "down-zone", h("div", { class: "row" }, bricks("down"))),
        zone(
          "tunnel",
          "tunnel-zone",
          h("div", { class: "tunnel-row" }, h("div", { class: "arch", "aria-hidden": "true" }), bricks("tunnel")),
        ),
      ),
    ),
  ];
}

function zone(id, className, ...children) {
  const meta = dirById(id);
  const open = unlockedIds(state.counts).includes(id);
  const count = state.counts[id];
  let caption = `${meta.label} 未開`;
  if (open && count >= GOAL) caption = `${meta.label} 完成`;
  else if (open) caption = `${meta.label} ${count}/${GOAL}`;
  const hot = state.pop?.dir === id;
  const unlocking = state.unlockId === id;
  return h(
    "div",
    { class: `zone ${className}${open ? "" : " is-locked"}${hot ? " is-hot" : ""}${unlocking ? " is-unlock" : ""}` },
    h("div", { class: `zone-label tone-${id}`, text: caption }),
    ...children,
    hot ? renderSparks() : null,
  );
}

function bricks(id, { reverse = false } = {}) {
  const count = state.counts[id];
  const total = Math.max(GOAL, count);
  const slots = [];
  for (let index = 0; index < total; index += 1) {
    const filled = index < count;
    const isNew = filled && state.pop?.dir === id && index === count - 1;
    slots.push(
      h(
        "div",
        { class: `brick tone-${id} ${filled ? "filled" : "ghost"}${isNew ? " is-new" : ""}` },
        filled ? h("span", { class: "stud" }) : null,
        filled ? h("span", { class: "shine" }) : null,
      ),
    );
  }
  if (reverse) slots.reverse();
  return slots;
}

function renderSparks() {
  return h(
    "span",
    { class: "sparks", "aria-hidden": "true" },
    Array.from({ length: 6 }, () => h("i")),
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
      h("p", { class: "chooser-title", text: `${kid.label} 答對了！這塊放哪裡？` }),
      h(
        "div",
        { class: "chooser-grid" },
        DIRECTIONS.map((dir) => {
          const open = unlockedIds(state.counts).includes(dir.id);
          const count = state.counts[dir.id];
          const enabled = canBuild(dir.id);
          let note = "未開";
          if (!open) note = "未開";
          else if (count >= MAX) note = "已滿";
          else if (count >= GOAL) note = "可加建";
          else note = `${count}/${GOAL}`;
          return h(
            "button",
            {
              type: "button",
              class: `place-btn tone-${dir.id}${enabled ? "" : " is-locked"}`,
              "data-action": "place",
              "data-dir": dir.id,
              disabled: enabled ? null : true,
            },
            h("span", { class: "place-name", text: dir.label }),
            h("span", { class: "place-note", text: note }),
          );
        }),
      ),
      waiting.length ? h("p", { class: "chooser-queue", text: `接著排隊：${waiting.join("、")}` }) : null,
    ),
  );
}

function renderWin() {
  return h(
    "div",
    { class: "win-layer" },
    renderConfetti(),
    h(
      "div",
      { class: "win-card", role: "dialog", "aria-label": "完工" },
      h("p", { class: "eyebrow", text: "完工" }),
      h("h2", { text: "秘密基地建成了！" }),
      h("p", { text: "六個方向都有至少 3 塊積木。三人一起完成。" }),
      h("button", { type: "button", class: "mega again", "data-action": "replay", text: "再玩一次" }),
    ),
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
        h("li", { text: "答對後，由你選積木放在哪個方向。" }),
        h("li", { text: "答錯會換下一題，其他人繼續做。" }),
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
  if (state.phase === "won") {
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
  const title = state.chooser === index ? "答對了！請在上面選方向" : "答對了，排隊等選位置";
  const detail =
    state.chooser === index
      ? "點選還沒建滿的方向。"
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
    startGame();
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
    onPlace(button.dataset.dir);
    return;
  }
  if (button.hasAttribute("data-lane") && button.hasAttribute("data-choice")) {
    onAnswer(Number(button.dataset.lane), button.dataset.choice);
  }
});

document.addEventListener("fullscreenchange", () => render());

render();
