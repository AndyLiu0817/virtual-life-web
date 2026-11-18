import { MINI_GAMES, RULES } from "../data/config";
import { TEXT as T } from "../data/text";
import { integer } from "./engine";
const C = RULES.mini;
export function mountMini(
  root: HTMLElement,
  id: number,
  onFinish: (won: boolean, score: number) => void,
): () => void {
  let running = false,
    finished = false,
    start = 0,
    last = 0,
    score = 0,
    misses = 0,
    target = 0,
    targetX = 50,
    targetY = 50,
    beat = 0,
    lastBeat = -1,
    stackX = 50,
    basket = 1,
    fruitX = 1,
    fruitY = 0,
    fruitGeneration = 0,
    frame = 0,
    moves = 0;
  const deck = [...Array(C.memoryPairs).keys(), ...Array(C.memoryPairs).keys()]
    .map((v) => ({ v, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map((o) => o.v);
  let lastShot = -1,
    lastDrop = -C.stackCooldownMs;
  let flipped: number[] = [],
    matched: number[] = [],
    locked = false;
  const found = new Set<number>();
  const differences = [1, 5, 8];
  let mathA = 0,
    mathB = 0,
    mathAnswer = 0;
  let timers: ReturnType<typeof setTimeout>[] = [];
  root.innerHTML = `<div class="mini-head"><span>${T.points} <b data-score>0</b></span><span>${T.time} <b data-time>${C.durationMs / 1000}</b></span></div><div class="playfield" data-field></div><div class="mini-controls" data-controls></div><button class="primary wide" data-start>${T.miniStart}</button>`;
  const field = root.querySelector<HTMLElement>("[data-field]")!,
    controls = root.querySelector<HTMLElement>("[data-controls]")!,
    scoreEl = root.querySelector<HTMLElement>("[data-score]")!,
    timeEl = root.querySelector<HTMLElement>("[data-time]")!,
    startButton = root.querySelector<HTMLButtonElement>("[data-start]")!;
  const setScore = () => {
    scoreEl.textContent = String(score);
  };
  const end = () => {
    if (finished) return;
    finished = true;
    running = false;
    cancelAnimationFrame(frame);
    timers.forEach(clearTimeout);
    setScore();
    onFinish(score >= C.thresholds[id], score);
  };
  function math() {
    mathA = integer(2, 19);
    mathB = integer(2, 19);
    mathAnswer = mathA + mathB;
    const choices = [
      mathAnswer,
      mathAnswer + integer(1, 5),
      mathAnswer - integer(1, 5),
      mathAnswer + integer(6, 9),
    ].sort(() => Math.random() - 0.5);
    field.innerHTML = `<div class="equation">${mathA} + ${mathB} = ?</div><div class="math-options">${choices.map((n) => `<button data-answer="${n}">${n}</button>`).join("")}</div>`;
  }
  function renderMemory() {
    field.innerHTML = `<div class="memory-grid">${deck.map((v, i) => `<button data-card="${i}" class="memory-card ${matched.includes(i) ? "matched" : ""}" ${matched.includes(i) ? "disabled" : ""}>${flipped.includes(i) || matched.includes(i) ? ["●", "▲", "◆", "✦"][v] : "?"}</button>`).join("")}</div><p>${T.memoryMoves} ${moves} / ${C.memoryMoves}</p>`;
  }
  function renderDifferences() {
    field.innerHTML = `<div class="difference-grid original">${Array.from({ length: 9 }, (_, i) => `<span>${i % 2 ? "●" : "◆"}</span>`).join("")}</div><div class="difference-grid">${Array.from({ length: 9 }, (_, i) => `<button data-diff="${i}" class="${found.has(i) ? "found" : ""}">${differences.includes(i) ? (i % 2 ? "◆" : "●") : i % 2 ? "●" : "◆"}</button>`).join("")}</div>`;
  }
  function visuals() {
    if (id === 0) {
      field.innerHTML = `<button class="moving-target" aria-label="${T.target}" data-hit style="left:${targetX}%;top:${targetY}%">◎</button>`;
    }
    if (id === 1) {
      field.innerHTML = `<div class="rhythm-track"><div class="sweet-zone"></div><div class="beat-dot" data-beat></div></div>`;
      controls.innerHTML = `<button class="primary" data-beat-tap>${T.tap}</button>`;
    }
    if (id === 2) renderMemory();
    if (id === 3)
      field.innerHTML = `<div class="mole-grid">${Array.from({ length: 9 }, (_, i) => `<button data-mole="${i}" aria-label="${T.target} ${i + 1}">${i === (target * 7 + 3) % 9 ? "●" : "·"}</button>`).join("")}</div>`;
    if (id === 4) renderDifferences();
    if (id === 5) {
      field.innerHTML =
        '<div class="fruit" data-fruit>●</div><div class="basket" data-basket>▰</div>';
      controls.innerHTML = `<button data-left>${T.left}</button><button data-right>${T.right}</button>`;
    }
    if (id === 6) math();
    if (id === 7) {
      field.innerHTML =
        '<div class="stack-block" data-block></div><div class="stack-base"></div>';
      controls.innerHTML = `<button class="primary" data-drop>${T.drop}</button>`;
    }
  }
  function tick(now: number) {
    if (!running) return;
    const elapsed = now - start;
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    timeEl.textContent = String(
      Math.max(0, Math.ceil((C.durationMs - elapsed) / 1000)),
    );
    if (id === 0) {
      targetX = 50 + Math.sin(elapsed / 740) * 35;
      targetY = 48 + Math.cos(elapsed / 920) * 30;
      const el = field.querySelector<HTMLElement>("[data-hit]");
      if (el) {
        el.style.left = `${targetX}%`;
        el.style.top = `${targetY}%`;
      }
    }
    if (id === 1) {
      beat = Math.floor(elapsed / C.beatMs);
      const progress = (elapsed % C.beatMs) / C.beatMs;
      field.querySelector<HTMLElement>("[data-beat]")!.style.left =
        `${progress * 100}%`;
    }
    if (id === 3 && Math.floor(elapsed / C.targetIntervalMs) !== target) {
      target = Math.floor(elapsed / C.targetIntervalMs);
      const hole = (target * 7 + 3) % 9;
      field
        .querySelectorAll<HTMLButtonElement>("[data-mole]")
        .forEach((el, i) => {
          el.textContent = i === hole ? "●" : "·";
          el.classList.toggle("active-mole", i === hole);
        });
    }
    if (id === 5) {
      fruitY += dt * C.fruitSpeed;
      if (fruitY > 82) {
        if (fruitX === basket) score++;
        else {
          score = Math.max(0, score - 1);
          misses++;
        }
        fruitY = 0;
        fruitX = integer(0, 2);
        fruitGeneration++;
        setScore();
      }
      const fruit = field.querySelector<HTMLElement>("[data-fruit]")!;
      fruit.style.left = `${((fruitX + 0.5) * 100) / 3}%`;
      fruit.style.top = `${fruitY}%`;
      field.querySelector<HTMLElement>("[data-basket]")!.style.left =
        `${((basket + 0.5) * 100) / 3}%`;
    }
    if (id === 7) {
      stackX = 50 + Math.sin(elapsed / 430) * 40;
      field.querySelector<HTMLElement>("[data-block]")!.style.left =
        `${stackX}%`;
    }
    if (elapsed >= C.durationMs) end();
    else frame = requestAnimationFrame(tick);
  }
  const click = (event: Event) => {
    const el = (event.target as HTMLElement).closest<HTMLElement>("button");
    if (!el) return;
    if (el === startButton) {
      if (running || finished) return;
      running = true;
      start = performance.now();
      last = start;
      startButton.hidden = true;
      target = 0;
      visuals();
      frame = requestAnimationFrame(tick);
      return;
    }
    if (!running) return;
    if (el.hasAttribute("data-hit")) {
      const wave = Math.floor((performance.now() - start) / C.targetIntervalMs);
      if (wave !== lastShot) {
        score++;
        lastShot = wave;
        setScore();
      }
    }
    if (el.hasAttribute("data-beat-tap")) {
      const phase = (performance.now() - start) % C.beatMs;
      const center = C.beatMs / 2;
      if (Math.abs(phase - center) <= C.beatWindowMs && beat !== lastBeat) {
        score++;
        lastBeat = beat;
      }
      setScore();
    }
    if (el.hasAttribute("data-mole")) {
      const hole = (target * 7 + 3) % 9;
      if (Number(el.dataset.mole) === hole && el.textContent === "●") {
        score++;
        el.textContent = "·";
        setScore();
      }
    }
    if (el.hasAttribute("data-card") && !locked) {
      const i = Number(el.dataset.card);
      if (matched.includes(i) || flipped.includes(i)) return;
      flipped.push(i);
      renderMemory();
      if (flipped.length === 2) {
        moves++;
        if (deck[flipped[0]] === deck[flipped[1]]) {
          matched.push(...flipped);
          flipped = [];
          score++;
          renderMemory();
          setScore();
          if (score === C.memoryPairs) {
            end();
            return;
          }
        } else {
          locked = true;
          timers.push(
            setTimeout(() => {
              flipped = [];
              locked = false;
              if (running) renderMemory();
            }, 650),
          );
        }
        if (moves >= C.memoryMoves && score < C.memoryPairs) end();
      }
    }
    if (el.hasAttribute("data-diff")) {
      const i = Number(el.dataset.diff);
      if (differences.includes(i) && !found.has(i)) {
        found.add(i);
        score++;
        setScore();
        renderDifferences();
        if (score >= C.differences) end();
      }
    }
    if (el.hasAttribute("data-left")) basket = Math.max(0, basket - 1);
    if (el.hasAttribute("data-right")) basket = Math.min(2, basket + 1);
    if (el.hasAttribute("data-answer")) {
      score = Math.max(
        0,
        score + (Number(el.dataset.answer) === mathAnswer ? 1 : -1),
      );
      setScore();
      math();
    }
    if (el.hasAttribute("data-drop")) {
      const elapsed = performance.now() - start;
      if (elapsed - lastDrop < C.stackCooldownMs) return;
      lastDrop = elapsed;
      if (Math.abs(stackX - 50) <= C.stackTolerance * 100) {
        score++;
        const layer = document.createElement("div");
        layer.className = "stack-layer";
        layer.style.bottom = `${12 + score * 7}%`;
        field.append(layer);
        setScore();
        if (score >= C.thresholds[7]) end();
      } else end();
    }
  };
  root.addEventListener("click", click);
  visuals();
  return () => {
    running = false;
    cancelAnimationFrame(frame);
    timers.forEach(clearTimeout);
    root.removeEventListener("click", click);
    void misses;
    void fruitGeneration;
  };
}
