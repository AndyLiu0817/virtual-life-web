import {
  mathQuestion,
  memoryDeck,
  minigames,
  type RoundScore,
} from "./game/minigames";
import {
  shootingFeedback,
  shootingSprite,
  shootingTargets,
  sprite,
} from "./minigame-art";

type Elements = { field: HTMLElement; score: HTMLElement; clock: HTMLElement };
type Round = (elements: Elements) => Promise<RoundScore>;

function pointerClick(
  element: HTMLElement,
  action: (event: MouseEvent) => void,
) {
  element.onclick = (event) => {
    if (event.detail > 0) action(event);
  };
}

function timedRound(
  clock: HTMLElement,
  seconds: number,
  start: number,
  update: (elapsed: number, finish: () => void) => void,
) {
  return new Promise<number>((resolve) => {
    const duration = seconds * 1000;
    let interval: number;
    let remaining = -1;
    const finish = () => {
      clearInterval(interval);
      resolve(Math.min(duration, Math.round(performance.now() - start)));
    };
    const tick = () => {
      const elapsed = performance.now() - start;
      const next = Math.max(0, Math.ceil((duration - elapsed) / 1000));
      if (next !== remaining) {
        clock.textContent = `${next} 秒`;
        remaining = next;
      }
      if (elapsed >= duration) finish();
      else update(elapsed, finish);
    };
    interval = window.setInterval(tick, 50);
    tick();
  });
}

const memory: Round = async ({ field, score, clock }) => {
  const deck = memoryDeck();
  field.innerHTML = `<div class="mg-deck">${deck
    .map(
      (_, i) =>
        `<button class="mg-card" type="button" aria-label="翻開第 ${i + 1} 張牌">${sprite("memory")}</button>`,
    )
    .join("")}</div>`;
  const cards = Array.from(field.querySelectorAll<HTMLButtonElement>("button"));
  const opened: number[] = [];
  let pairs = 0;
  let hideAt = Infinity;
  let finishRound: () => void;
  const start = performance.now();
  const paintScore = () => {
    score.textContent = `${pairs} ／ 8 對`;
  };
  paintScore();
  cards.forEach((card, index) => {
    pointerClick(card, () => {
      if (
        opened.length === 2 ||
        card.disabled ||
        performance.now() - start >= minigames.memory.normal * 1000
      )
        return;
      card.disabled = true;
      card.innerHTML = sprite("memory", deck[index]);
      opened.push(index);
      if (opened.length < 2) return;
      if (deck[opened[0]] !== deck[opened[1]]) {
        hideAt = performance.now() + 650;
        return;
      }
      opened.splice(0).forEach((i) => cards[i].classList.add("matched"));
      pairs++;
      paintScore();
      if (pairs === 8) finishRound();
    });
  });
  const elapsedMs = await timedRound(
    clock,
    minigames.memory.normal,
    start,
    (_, finish) => {
      finishRound = finish;
      if (performance.now() < hideAt) return;
      opened.splice(0).forEach((i) => {
        cards[i].innerHTML = sprite("memory");
        cards[i].disabled = false;
      });
      hideAt = Infinity;
    },
  );
  return { score: pairs, elapsedMs };
};

const math: Round = async ({ field, score, clock }) => {
  field.innerHTML = `<div class="mg-math">
    ${sprite("math")}
    <p class="mg-question"></p>
    <div class="mg-answers">${Array.from(
      { length: 4 },
      () =>
        `<button class="mg-answer" type="button">${sprite("math", 1)}<span></span></button>`,
    ).join("")}</div>
    <p class="mg-feedback" role="status"></p>
  </div>`;
  const prompt = field.querySelector(".mg-question")!;
  const feedback = field.querySelector(".mg-feedback")!;
  const buttons = Array.from(
    field.querySelectorAll<HTMLButtonElement>("button"),
  );
  let question = mathQuestion();
  let correct = 0;
  let readyAt = 0;
  const start = performance.now();
  const duration = 45;
  const present = () => {
    prompt.textContent = question.prompt;
    score.textContent = `答對 ${correct} 題`;
    buttons.forEach((button, i) => {
      button.lastElementChild!.textContent = String(question.options[i]);
    });
  };
  present();
  buttons.forEach((button, i) =>
    pointerClick(button, () => {
      const now = performance.now();
      if (now < readyAt || now - start >= duration * 1000) return;
      const right = question.options[i] === question.answer;
      if (right) correct++;
      feedback.textContent = right ? "答對了！" : `正解是 ${question.answer}`;
      feedback.classList.toggle("wrong", !right);
      question = mathQuestion();
      readyAt = now + 320;
      buttons.forEach((option) => {
        option.disabled = true;
      });
      score.textContent = `答對 ${correct} 題`;
    }),
  );
  await timedRound(clock, duration, start, () => {
    if (!readyAt || performance.now() < readyAt) return;
    readyAt = 0;
    buttons.forEach((button) => {
      button.disabled = false;
    });
    feedback.textContent = "";
    present();
  });
  return { score: correct };
};

const shoot: Round = async ({ field, score, clock }) => {
  field.innerHTML = `<div class="mg-gallery">${Array.from(
    { length: 9 },
    (_, i) =>
      `<button class="mg-target" type="button" aria-label="命中靶子" style="grid-area:${Math.floor(i / 3) + 1} / ${(i % 3) + 1}" hidden></button>`,
  ).join("")}</div>
  <div class="mg-shot-feedback" aria-hidden="true" hidden>
    ${shootingSprite(shootingFeedback.hit)}${shootingSprite(shootingFeedback.miss)}
  </div>`;
  const targets = Array.from(
    field.querySelectorAll<HTMLButtonElement>(".mg-target"),
  );
  const feedback = field.querySelector<HTMLElement>(".mg-shot-feedback")!;
  const period = 1250;
  const visible = 1100;
  const duration = 30;
  let previous = -1;
  let current: HTMLButtonElement | undefined;
  let cycle = -1;
  let hits = 0;
  let feedbackUntil = 0;
  const start = performance.now();
  const hideTarget = () => {
    if (current) current.hidden = true;
    current = undefined;
  };
  const paintScore = () => {
    score.textContent = `命中 ${hits} 個`;
  };
  paintScore();

  // Score the target actually displayed when the pointer goes down.
  // Keyboard-generated clicks never pass through this handler.
  const shootAt = (event: PointerEvent) => {
    const elapsed = performance.now() - start;
    if (!event.isPrimary || event.button !== 0 || elapsed >= duration * 1000)
      return;

    const hit = current !== undefined && event.target === current;
    if (hit) {
      hits++;
      paintScore();
      hideTarget();
    }
    const bounds = field.getBoundingClientRect();
    feedback.style.left = `${event.clientX - bounds.left}px`;
    feedback.style.top = `${event.clientY - bounds.top}px`;
    feedback.dataset.shot = hit ? "hit" : "miss";
    feedback.hidden = false;
    feedbackUntil = elapsed + (hit ? 320 : 210);
  };
  field.addEventListener("pointerdown", shootAt);

  await timedRound(clock, duration, start, (elapsed) => {
    if (elapsed >= feedbackUntil) feedback.hidden = true;
    const next = Math.floor(elapsed / period);
    if (next !== cycle) {
      hideTarget();
      cycle = next;
      const offset = 1 + Math.floor(Math.random() * (targets.length - 1));
      previous = (previous + offset) % targets.length;
      if (elapsed % period >= visible) return;
      current = targets[previous];
      current.innerHTML = sprite("shoot", cycle % shootingTargets.length);
      current.hidden = false;
    }
    if (elapsed % period >= visible) hideTarget();
  });
  field.removeEventListener("pointerdown", shootAt);
  return { score: hits };
};

const beatCount = 20;
const beatMs = 600;
const leadMs = 1200;
const hitWindow = 125;

function scheduleBeat(start: number) {
  if (!window.AudioContext) return;
  let audio: AudioContext;
  try {
    audio = new AudioContext();
  } catch {
    return;
  }
  void audio
    .resume()
    .then(() => {
      const first = audio.currentTime + (start - performance.now()) / 1000;
      for (let i = 0; i < beatCount; i++) {
        const at = first + (i * beatMs) / 1000;
        if (at < audio.currentTime || audio.state !== "running") continue;
        const tone = audio.createOscillator();
        const gain = audio.createGain();
        tone.frequency.value = i % 4 === 0 ? 740 : 520;
        gain.gain.setValueAtTime(0.15, at);
        gain.gain.exponentialRampToValueAtTime(0.001, at + 0.075);
        tone.connect(gain).connect(audio.destination);
        tone.start(at);
        tone.stop(at + 0.08);
        tone.onended = () => {
          tone.disconnect();
          gain.disconnect();
        };
      }
    })
    .catch(() => {
      /* Visual cues work without audio. */
    });
  return audio;
}

const rhythm: Round = async ({ field, score, clock }) => {
  field.innerHTML = `<button class="mg-lane" type="button" aria-label="拍擊">
    <span class="mg-zone"></span>
    ${Array.from(
      { length: beatCount },
      (_, i) =>
        `<span class="mg-note" hidden>${sprite("rhythm", i % 4)}</span>`,
    ).join("")}
  </button>`;
  const lane = field.querySelector<HTMLButtonElement>("button")!;
  const notes = Array.from(field.querySelectorAll<HTMLElement>(".mg-note"));
  const hit = new Set<number>();
  let stray = 0;
  let accuracy = 0;
  let active = -1;
  const start = performance.now() + leadMs;
  const end = (beatCount - 1) * beatMs + hitWindow;
  const audio = scheduleBeat(start);
  score.textContent = "準確率 0%";
  const paintScore = () => {
    accuracy = Math.round((1000 * hit.size) / (beatCount + stray)) / 10;
    score.textContent = `準確率 ${accuracy}%`;
  };
  pointerClick(lane, () => {
    const elapsed = performance.now() - start;
    if (elapsed > end) return;
    const index = Math.round(elapsed / beatMs);
    if (
      index >= 0 &&
      index < beatCount &&
      Math.abs(elapsed - index * beatMs) <= hitWindow &&
      !hit.has(index)
    ) {
      hit.add(index);
      notes[index].hidden = true;
    } else {
      stray++;
    }
    paintScore();
  });
  await new Promise<void>((resolve) => {
    const frame = (now: number) => {
      const elapsed = now - start;
      if (elapsed > end) {
        resolve();
        return;
      }
      const beat = Math.max(
        1,
        Math.min(beatCount, Math.floor(elapsed / beatMs) + 1),
      );
      if (beat !== active) {
        active = beat;
        clock.textContent = `第 ${beat} ／ ${beatCount} 拍`;
      }
      const index = Math.round(elapsed / beatMs);
      lane.classList.toggle(
        "on-beat",
        index >= 0 && Math.abs(elapsed - index * beatMs) <= hitWindow,
      );
      notes.forEach((note, i) => {
        const until = i * beatMs - elapsed;
        const shown = until <= leadMs && until >= -hitWindow && !hit.has(i);
        note.hidden = !shown;
        if (shown)
          note.style.transform = `translateY(${(1 - until / leadMs) * 76}%)`;
      });
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  if (audio) void audio.close().catch(() => {});
  return { score: accuracy };
};

export const minigameRounds = { rhythm, memory, math, shoot };
