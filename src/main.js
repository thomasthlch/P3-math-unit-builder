import "./style.css";
import { QUESTIONS } from "./questions.js";
import {
  DIRECTIONS,
  GOAL,
  MAX,
  UNLOCK_AT,
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
  selected: "up",
  turn: 0,
  current: null,
  deck: [],
  lastId: null,
  feedback: null,
  popDir: null,
  lock: false,
  sound: true,
};

let nextTimer = 0;
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

function clearTimer() {
  if (nextTimer) window.clearTimeout(nextTimer);
  nextTimer = 0;
}

function dirById(id) {
  return DIRECTIONS.find((dir) => dir.id === id);
}

function canBuild(id) {
  return unlockedIds(state.counts).includes(id) && state.counts[id] < MAX;
}

function ensureSelected() {
  if (canBuild(state.selected)) return;
  const ids = DIRECTIONS.map((dir) => dir.id);
  const start = Math.max(0, ids.indexOf(state.selected));
  for (let step = 1; step <= ids.length; step += 1) {
    const id = ids[(start + step) % ids.length];
    if (canBuild(id)) {
      state.selected = id;
      return;
    }
  }
}

function doneCount() {
  return DIRECTIONS.filter((dir) => state.counts[dir.id] >= GOAL).length;
}

function draw() {
  if (state.deck.length === 0) {
    state.deck = shuffle(QUESTIONS.filter((question) => question.id !== state.lastId));
  }
  const question = state.deck.pop();
  state.current = {
    q: question,
    choices: shuffle(question.choices),
    disabled: new Set(),
  };
  state.feedback = null;
}

function startGame() {
  clearTimer();
  state.phase = "play";
  state.counts = emptyCounts();
  state.selected = "up";
  state.turn = 0;
  state.lock = false;
  state.popDir = null;
  state.feedback = null;
  state.lastId = state.current?.q.id ?? state.lastId;
  state.current = null;
  state.deck = [];
  draw();
  render();
}

function onDirection(id) {
  if (state.phase !== "play" || state.lock) return;
  const dir = dirById(id);
  if (!unlockedIds(state.counts).includes(id)) {
    const index = DIRECTIONS.findIndex((item) => item.id === id);
    const prev = DIRECTIONS[index - 1];
    state.feedback = {
      ok: false,
      text: `「${dir.label}」未解鎖。先把「${prev.label}」建成 ${UNLOCK_AT} 塊。`,
      hint: "",
    };
    render();
    return;
  }
  if (state.counts[id] >= MAX) {
    state.feedback = {
      ok: false,
      text: `「${dir.label}」已有 ${MAX} 塊，選別的方向吧。`,
      hint: "",
    };
    render();
    return;
  }
  state.selected = id;
  if (!(state.feedback && state.feedback.hint)) state.feedback = null;
  render();
}

function onAnswer(choice) {
  if (state.phase !== "play" || state.lock || !state.current) return;
  if (state.current.disabled.has(choice)) return;
  ensureSelected();
  if (!canBuild(state.selected)) {
    state.feedback = { ok: false, text: "請先選一個還能建造的方向。", hint: "" };
    render();
    return;
  }
  const question = state.current.q;
  if (choice === question.answer) {
    const dir = state.selected;
    const before = unlockedIds(state.counts);
    state.counts[dir] += 1;
    state.popDir = dir;
    state.lastId = question.id;
    const newly = unlockedIds(state.counts).filter((id) => !before.includes(id));
    const placed = dirById(dir);
    let text = `答對了！在「${placed.label}」放了一塊。`;
    if (newly.length) {
      const opened = dirById(newly[0]);
      text += ` 解鎖新方向：${opened.label}！`;
      state.selected = newly[0];
    }
    ensureSelected();
    if (state.counts[dir] >= MAX && state.selected !== dir && newly.length === 0) {
      text += ` 「${placed.label}」已建滿，下一塊改放「${dirById(state.selected).label}」。`;
    }
    state.turn = (state.turn + 1) % KIDS.length;
    state.feedback = { ok: true, text, hint: "" };
    if (isWin(state.counts)) {
      state.phase = "won";
      state.lock = true;
      playTone("win");
      render();
      return;
    }
    playTone("ok");
    state.lock = true;
    render();
    clearTimer();
    nextTimer = window.setTimeout(() => {
      state.lock = false;
      state.popDir = null;
      draw();
      render();
    }, 950);
    return;
  }
  state.current.disabled.add(choice);
  state.feedback = {
    ok: false,
    text: "再試一次。三人一起討論一下。",
    hint: question.hint,
  };
  playTone("bad");
  render();
}

function playTone(kind) {
  if (!state.sound) return;
  try {
    if (!audioCtx) audioCtx = new AudioContext();
    if (audioCtx.state === "suspended") void audioCtx.resume();
    const notes = kind === "win" ? [523, 659, 784, 1046] : kind === "ok" ? [523, 784] : [220, 174];
    notes.forEach((freq, index) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "square";
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      const start = audioCtx.currentTime + index * 0.08;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.045, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.15);
      osc.start(start);
      osc.stop(start + 0.16);
    });
  } catch {
    /* 沒有音效時仍然可以玩。 */
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
  app.replaceChildren(renderShell());
  watchFit();
}

function renderShell() {
  return h(
    "div",
    { class: "shell" },
    renderHeader(),
    h("div", { class: "layout" }, renderScene(), renderPanel()),
    renderDirBar(),
  );
}

function renderHeader() {
  const turnText =
    state.phase === "play"
      ? `先討論，今次由 ${KIDS[state.turn].label} 按。`
      : state.phase === "won"
        ? "三人合作成功！"
        : "三人一組，共用進度。";
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
        h("div", { class: "brand-sub", text: "小三長度單位" }),
      ),
    ),
    h("div", { class: "progress-pill", text: `方向 ${doneCount()}/6` }),
    h("div", { class: "turn-line", text: turnText }),
    h(
      "div",
      { class: "kids", "aria-label": "三位同學" },
      KIDS.map((kid, index) =>
        h(
          "div",
          { class: `kid${state.phase === "play" && state.turn === index ? " is-turn" : ""}` },
          h("span", { class: "face", style: `--tint:${kid.tint}`, text: String(index + 1) }),
          h("span", { class: "kid-label", text: kid.label }),
        ),
      ),
    ),
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
    h("div", { class: "scene-fit" }, h("div", { class: "plot-sizer" }, h("div", { class: "plot" }, renderPlot()))),
    state.phase === "won" ? renderConfetti() : null,
  );
}

function renderPlot() {
  return [
    zone(
      "up",
      "up-zone",
      h("div", { class: "vstack" }, bricks("up", { reverse: true })),
    ),
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
  const selected = state.phase === "play" && state.selected === id && open;
  return h(
    "div",
    {
      class: `zone ${className}${open ? "" : " is-locked"}${selected ? " is-selected" : ""}`,
    },
    h("div", { class: `zone-label tone-${id}`, text: caption }),
    ...children,
  );
}

function bricks(id, { reverse = false } = {}) {
  const count = state.counts[id];
  const total = Math.max(GOAL, count);
  const slots = [];
  for (let index = 0; index < total; index += 1) {
    const filled = index < count;
    const isNew = filled && state.popDir === id && index === count - 1;
    slots.push(
      h(
        "div",
        { class: `brick tone-${id} ${filled ? "filled" : "ghost"}${isNew ? " is-new" : ""}` },
        filled ? h("span", { class: "stud" }) : null,
      ),
    );
  }
  if (reverse) slots.reverse();
  return slots;
}

function renderConfetti() {
  const colors = ["#ff5a5a", "#ffd84a", "#3c7dff", "#2fce73", "#b06bff", "#ff8a2a"];
  return h(
    "div",
    { class: "confetti", "aria-hidden": "true" },
    Array.from({ length: 26 }, (_, index) =>
      h("i", {
        style: `left:${(index * 37) % 100}%;background:${colors[index % colors.length]};animation-delay:${(index % 7) * 0.11}s`,
      }),
    ),
  );
}

function renderPanel() {
  const panel = h("section", { class: "panel" });
  const content =
    state.phase === "ready" ? renderReady() : state.phase === "won" ? renderWon() : renderQuestion();
  panel.append(...content.filter(Boolean));
  return panel;
}

function renderReady() {
  return [
    h("p", { class: "eyebrow", text: "電子白板合作遊戲" }),
    h("h1", { class: "ready-title", text: "三人一起建造" }),
    h(
      "ol",
      { class: "rules" },
      h("li", { text: "三個人看同一題，先說出想法。" }),
      h("li", { text: "輪到誰，就由誰按下巨大的答案。" }),
      h("li", { text: "答對放一塊。六個方向各建成 3 塊，基地就完工。" }),
    ),
    h("button", { type: "button", class: "mega go", "data-action": "start", text: "開始建造" }),
  ];
}

function renderWon() {
  return [
    h("p", { class: "eyebrow", text: "完工" }),
    h("h1", { class: "ready-title", text: "秘密基地建成了！" }),
    h("p", {
      class: "win-copy",
      text: "向上、向前、向左、向右、向下和隧道，每個方向都有至少 3 塊積木。",
    }),
    h("button", { type: "button", class: "mega again", "data-action": "replay", text: "再玩一次" }),
  ];
}

function renderQuestion() {
  const current = state.current;
  const question = current.q;
  const meta = dirById(state.selected);
  return [
    h(
      "div",
      { class: "panel-top" },
      h("span", { class: "type-badge", text: question.typeLabel }),
      h("span", { class: "progress-mini", text: `完工方向 ${doneCount()}/6` }),
    ),
    h(
      "div",
      { class: `build-chip tone-${meta.id}` },
      h("i", { class: "swatch", "aria-hidden": "true" }),
      h("span", { text: `這塊積木會放在「${meta.label}」` }),
    ),
    h("div", { class: "prompt", id: "prompt", text: question.prompt }),
    h(
      "div",
      { class: "choices", role: "group", "aria-labelledby": "prompt" },
      current.choices.map((choice, index) => {
        const eliminated = current.disabled.has(choice);
        const correct = state.feedback?.ok && choice === question.answer;
        return h(
          "button",
          {
            type: "button",
            class: `choice${eliminated ? " is-out" : ""}${correct ? " is-right" : ""}`,
            "data-choice": choice,
            disabled: state.lock || eliminated ? true : null,
          },
          h("span", { text: `${index + 1}. ${choice}` }),
          eliminated ? h("small", { class: "tried", text: "已試過" }) : null,
        );
      }),
    ),
    state.feedback
      ? h("div", {
          class: `feedback${state.feedback.ok ? " ok" : " bad"}`,
          role: "status",
          text: state.feedback.text,
        })
      : null,
    state.feedback?.hint
      ? h(
          "div",
          { class: "hint" },
          h("span", { class: "hint-tag", text: "提示" }),
          h("p", { text: state.feedback.hint }),
        )
      : null,
  ];
}

function renderDirBar() {
  const open = unlockedIds(state.counts);
  return h(
    "nav",
    { class: "dir-bar", "aria-label": "建造方向" },
    DIRECTIONS.map((dir) => {
      const count = state.counts[dir.id];
      const unlocked = open.includes(dir.id);
      const selected = state.phase === "play" && state.selected === dir.id && unlocked;
      let note = "未解鎖";
      if (unlocked && count >= MAX) note = "已建滿";
      else if (selected) note = "建造中";
      else if (unlocked && count >= GOAL) note = "完成";
      else if (unlocked) note = `還差 ${GOAL - count} 塊`;
      return h(
        "button",
        {
          type: "button",
          class: `dir-btn tone-${dir.id}${selected ? " is-selected" : ""}${unlocked ? "" : " is-locked"}`,
          "data-dir": dir.id,
          "aria-pressed": selected ? "true" : "false",
        },
        h("span", { class: "dir-label", text: dir.label }),
        dots(count),
        h("span", { class: "dir-note", text: note }),
      );
    }),
  );
}

function dots(count) {
  return h(
    "span",
    { class: "dots", "aria-hidden": "true" },
    Array.from({ length: GOAL }, (_, index) => h("i", { class: index < count ? "dot on" : "dot" })),
    count > GOAL ? h("i", { class: "dot on bonus", text: "+" }) : null,
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
  const scale = Math.min(1.7, (availW - 28) / width, (availH - 16) / height);
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
  if (button.dataset.dir) {
    onDirection(button.dataset.dir);
    return;
  }
  if (button.hasAttribute("data-choice")) onAnswer(button.dataset.choice);
});

document.addEventListener("keydown", (event) => {
  if (event.repeat) return;
  if (state.phase !== "play" || state.lock || !state.current) return;
  const index = ["1", "2", "3", "4"].indexOf(event.key);
  if (index >= 0) {
    const choice = state.current.choices[index];
    if (choice) onAnswer(choice);
    return;
  }
  if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
    const open = DIRECTIONS.map((dir) => dir.id).filter((id) => canBuild(id));
    if (!open.length) return;
    const current = Math.max(0, open.indexOf(state.selected));
    const delta = event.key === "ArrowRight" ? 1 : -1;
    state.selected = open[(current + delta + open.length) % open.length];
    if (!(state.feedback && state.feedback.hint)) state.feedback = null;
    render();
    event.preventDefault();
  }
});

document.addEventListener("fullscreenchange", () => render());

render();
