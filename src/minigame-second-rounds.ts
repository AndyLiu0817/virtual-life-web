import { roundFeedback } from "./minigame-feedback";
import { catchPoints, minigames, whackPoints } from "./game/minigames";
import { differenceHotspots } from "./game/differences";
import { minigameBackground, sprite, whackCritters } from "./minigame-art";
import { differencePictures } from "./minigame-second-art";
import { timedRound, type Round } from "./minigame-timing";

const primary = (event: PointerEvent) => event.isPrimary && event.button === 0;

function place(element: HTMLElement, x: number, y: number) {
  element.style.left = `${x * 100}%`;
  element.style.top = `${y * 100}%`;
}

function feedback(className: string) {
  const mark = document.createElement("span");
  mark.className = className;
  mark.setAttribute("aria-hidden", "true");
  mark.hidden = true;
  return mark;
}

const signboard = `<div class="mg-signboard" aria-hidden="true">
  <span class="mg-sign-score"></span><span class="mg-sign-clock"></span>
</div>`;

const whack: Round = async ({ field, score, clock }) => {
  const holes = [
    [172, 122],
    [241, 122],
    [311, 122],
    [166, 149],
    [241, 149],
    [315, 149],
    [160, 180],
    [240, 180],
    [319, 180],
  ];
  field.innerHTML = `<div class="mg-whack-board">
    ${minigameBackground("whack")}
    ${signboard}
    <button class="mg-critter" type="button" aria-label="打小怪獸" hidden></button>
  </div>`;
  const board = field.querySelector<HTMLElement>(".mg-whack-board")!;
  const signScore = board.querySelector<HTMLElement>(".mg-sign-score")!;
  const signClock = board.querySelector<HTMLElement>(".mg-sign-clock")!;
  const critter = field.querySelector<HTMLButtonElement>(".mg-critter")!;
  const impact = feedback("mg-whack-impact");
  impact.innerHTML = sprite("whack", "burst") + sprite("whack", "hammer-glow");
  const puff = feedback("mg-whack-puff");
  puff.innerHTML = sprite("whack", "cloud");
  board.append(impact, puff);

  const duration = 30;
  const period = 800;
  const visible = 540;
  let cycle = -1;
  let hole = -1;
  let hits = 0;
  let hitAt = -Infinity;
  let puffUntil = 0;
  let struck = false;
  let critterName: (typeof whackCritters)[number] | "teacher" =
    whackCritters[0];
  const start = performance.now();
  score.textContent = signScore.textContent = "命中 0 隻";
  field.onpointerdown = (event) => {
    const elapsed = performance.now() - start;
    if (!primary(event) || elapsed >= duration * 1000) return;
    const hit =
      !struck &&
      !critter.hidden &&
      event.target === critter &&
      Math.floor(elapsed / period) === cycle &&
      elapsed % period < visible;
    if (hit) {
      const teacher = critterName === "teacher";
      hits = whackPoints(hits, teacher);
      score.textContent = signScore.textContent = `命中 ${hits} 隻`;
      if (teacher) roundFeedback(field, "−2", event);
      struck = true;
      hitAt = elapsed;
      critter.innerHTML = sprite(
        "whack",
        teacher ? "teacher-shocked" : `${critterName}-dizzy`,
      );
      impact.innerHTML = teacher
        ? sprite("whack", "cross")
        : sprite("whack", "burst") + sprite("whack", "hammer-glow");
      critter.classList.add("struck");
    } else {
      puffUntil = elapsed + 260;
    }
    const effect = hit ? impact : puff;
    const bounds = board.getBoundingClientRect();
    place(
      effect,
      (event.clientX - bounds.left) / bounds.width,
      (event.clientY - bounds.top) / bounds.height,
    );
    effect.hidden = false;
  };

  await timedRound(
    clock,
    duration,
    start,
    (elapsed) => {
      if (elapsed >= hitAt + 230) impact.hidden = true;
      if (elapsed >= puffUntil) puff.hidden = true;
      const next = Math.floor(elapsed / period);
      if (next !== cycle) {
        cycle = next;
        hole =
          (hole + 1 + Math.floor(Math.random() * (holes.length - 1))) %
          holes.length;
        const [x, y] = holes[hole];
        place(critter, x / 480, y / 270);
        struck = false;
        const teacher = cycle % 9 === 4 || (cycle % 9 === 0 && cycle > 0);
        critterName = teacher
          ? "teacher"
          : whackCritters[cycle % whackCritters.length];
        critter.setAttribute(
          "aria-label",
          teacher ? "不要打這一隻" : "打小怪獸",
        );
        critter.classList.remove("struck");
        critter.innerHTML = sprite("whack", critterName);
        critter.hidden = false;
      }
      if (struck ? elapsed >= hitAt + 250 : elapsed % period >= visible)
        critter.hidden = true;
    },
    signClock,
  );
  field.onpointerdown = null;
  return { score: hits };
};

const diff: Round = async ({ field, score, clock }) => {
  let index = Math.floor(Math.random() * differencePictures.length);
  let debug = false;
  if (import.meta.env.DEV) {
    const requested = new URLSearchParams(location.search).get("diff-debug");
    const set = Number(requested);
    if (Number.isInteger(set) && set >= 1 && set <= differencePictures.length) {
      index = set - 1;
      debug = true;
    }
  }
  const spots = differenceHotspots[index];
  field.innerHTML = `<div class="mg-diff-pair${debug ? " debug" : ""}">
    ${differencePictures[index]
      .map(
        (url, side) => `<div class="mg-diff-picture">
      <img src="${url}" alt="比較圖 ${side === 0 ? "A" : "B"}" draggable="false">
      ${spots.map((spot) => `<span class="mg-diff-ring" ${debug ? `title="${spot.label}"` : ""} style="left:${spot.x * 100}%;top:${spot.y * 100}%;width:${spot.radius * 200}%"></span>`).join("")}
    </div>`,
      )
      .join("")}
  </div>`;
  const pictures = Array.from(
    field.querySelectorAll<HTMLElement>(".mg-diff-picture"),
  );
  const rings = pictures.map((picture) =>
    picture.querySelectorAll(".mg-diff-ring"),
  );
  const mark = feedback("mg-tap-mark");
  const found = new Set<number>();
  let misses = 0;
  const duration = 60;
  let lockedUntil = 0;
  let finishRound: () => void;
  const start = performance.now();
  score.textContent = "找到 0 ／ 5 處";

  pictures.forEach((picture) => {
    picture.onpointerdown = (event) => {
      const elapsed = performance.now() - start;
      if (
        !primary(event) ||
        elapsed < lockedUntil ||
        elapsed >= duration * 1000
      )
        return;
      const bounds = picture.getBoundingClientRect();
      const x = event.clientX - bounds.left;
      const y = event.clientY - bounds.top;
      let nearest = Infinity;
      let match = -1;
      spots.forEach((spot, i) => {
        const distance = Math.hypot(
          x - spot.x * bounds.width,
          y - spot.y * bounds.height,
        );
        if (
          distance <= Math.max(36, spot.radius * bounds.width) &&
          distance < nearest
        ) {
          match = i;
          nearest = distance;
        }
      });
      if (match === -1) {
        misses++;
        lockedUntil = elapsed + 1000;
        roundFeedback(field, "點錯", event);
        picture.append(mark);
        place(mark, x / bounds.width, y / bounds.height);
        mark.textContent = "×";
        mark.hidden = false;
      } else if (!found.has(match)) {
        found.add(match);
        rings.forEach((side) => side[match].classList.add("found"));
        score.textContent = `找到 ${found.size} ／ 5 處`;
        if (found.size === spots.length) finishRound();
      }
    };
  });

  await timedRound(clock, duration, start, (elapsed, finish) => {
    finishRound = finish;
    if (elapsed >= lockedUntil) mark.hidden = true;
  });
  pictures.forEach((picture) => {
    picture.onpointerdown = null;
  });
  return { score: found.size, misses };
};

function animateRound(
  clock: HTMLElement,
  seconds: number,
  frame: (elapsed: number) => boolean,
  signClock?: HTMLElement,
) {
  return new Promise<void>((resolve) => {
    const start = performance.now();
    let remaining = -1;
    const step = (now: number) => {
      const elapsed = Math.max(0, now - start);
      const next = Math.max(0, Math.ceil(seconds - elapsed / 1000));
      if (next !== remaining) {
        remaining = next;
        clock.textContent = `${remaining} 秒`;
        if (signClock) signClock.textContent = clock.textContent;
      }
      if (frame(Math.min(elapsed, seconds * 1000)) || !next) resolve();
      else requestAnimationFrame(step);
    };
    step(start);
  });
}

const catchFruit: Round = async ({ field, score, clock }) => {
  field.innerHTML = `<div class="mg-basket">${sprite("catch", 10)}</div>`;
  const scene = document.createElement("div");
  scene.className = "mg-catch-scene";
  scene.innerHTML = minigameBackground("catch") + signboard;
  field.before(scene);
  const signScore = scene.querySelector<HTMLElement>(".mg-sign-score")!;
  const signClock = scene.querySelector<HTMLElement>(".mg-sign-clock")!;
  const basket = field.querySelector<HTMLElement>(".mg-basket")!;
  const items: {
    element: HTMLElement;
    at: number;
    x: number;
    junk: boolean;
  }[] = [];
  const fall = 1860;
  let caught = 0;
  let misses = 0;
  let center = 0.5;
  let pointer: number | null = null;
  const input = new AbortController();
  const options = { signal: input.signal };

  const paint = () => {
    score.textContent = `接到 ${caught}・漏接 ${misses}`;
    signScore.textContent = `接到 ${caught}・漏接 ${misses}/${minigames.catch.maxMisses}`;
  };
  const move = (event: PointerEvent) => {
    const bounds = field.getBoundingClientRect();
    center = Math.max(
      0.12,
      Math.min(0.88, (event.clientX - bounds.left) / bounds.width),
    );
    basket.style.left = `${center * 100}%`;
  };
  field.addEventListener(
    "pointerdown",
    (event) => {
      if (!primary(event) || pointer !== null) return;
      pointer = event.pointerId;
      field.setPointerCapture(pointer);
      move(event);
    },
    options,
  );
  field.addEventListener(
    "pointermove",
    (event) => {
      if (event.pointerId === pointer) move(event);
    },
    options,
  );
  field.addEventListener(
    "lostpointercapture",
    (event) => {
      if (event.pointerId === pointer) pointer = null;
    },
    options,
  );

  // 35 fruit arrive before the 30 s horn; junk lands between fruit.
  const junkSprites = [7, 8, 9, "bomb", "rotten"];
  let previousLane = 2;
  for (let i = 0; i < 35; i++) {
    previousLane = (previousLane + 1 + Math.floor(Math.random() * 4)) % 5;
    addItem(300 + i * 790, 0.1 + previousLane * 0.2, false);
    if (i % 4 === 2)
      addItem(695 + i * 790, 0.1 + Math.floor(Math.random() * 5) * 0.2, true);
  }

  function addItem(at: number, x: number, junk: boolean) {
    const element = document.createElement("div");
    element.className = "mg-falling";
    element.style.left = `${x * 100}%`;
    element.innerHTML = sprite(
      "catch",
      junk
        ? junkSprites[Math.floor(Math.random() * junkSprites.length)]
        : Math.floor(Math.random() * 7),
    );
    items.push({ element, at, x, junk });
  }

  const active = new Set<(typeof items)[number]>();
  let nextItem = 0;
  paint();
  await animateRound(
    clock,
    30,
    (elapsed) => {
      while (nextItem < items.length && items[nextItem].at <= elapsed) {
        const item = items[nextItem++];
        field.append(item.element);
        active.add(item);
      }
      for (const item of active) {
        const progress = (elapsed - item.at) / fall;
        if (progress < 1) {
          item.element.style.top = `${-10 + 92 * progress}%`;
          continue;
        }
        active.delete(item);
        item.element.remove();
        if (Math.abs(item.x - center) <= 0.135) {
          caught = catchPoints(caught, item.junk);
          if (item.junk) {
            const bounds = basket.getBoundingClientRect();
            roundFeedback(field, "−2", {
              clientX: bounds.x + bounds.width / 2,
              clientY: bounds.y,
            });
          }
        } else if (!item.junk) misses++;
        paint();
      }
      return false;
    },
    signClock,
  );
  input.abort();
  return { score: caught, misses };
};

const stack: Round = async ({ field, score, clock }) => {
  field.innerHTML = `<div class="mg-stack-world">
    <div class="mg-stack-pile"></div>
    <div class="mg-stack-moving"></div>
  </div>`;
  const world = field.querySelector<HTMLElement>(".mg-stack-world")!;
  const pile = field.querySelector<HTMLElement>(".mg-stack-pile")!;
  const moving = field.querySelector<HTMLElement>(".mg-stack-moving")!;
  const originalWidth = 0.45;
  let layers = 0;
  let top = (1 - originalWidth) / 2;
  let width = originalWidth;
  let x = 0.04;
  let slideStart = 0;
  let elapsed = 0;
  let dropAt: number | undefined;
  let ended = false;
  let dropPoint: PointerEvent | undefined;

  function block(element: HTMLElement, index: number) {
    element.innerHTML = sprite("stack", index % 9);
    element.style.width = `${originalWidth * 100}%`;
  }
  const base = document.createElement("div");
  block(base, 0);
  base.style.left = `${top * 100}%`;
  pile.append(base);
  block(moving, 1);
  const paint = () => {
    score.textContent = `疊好 ${layers} 層`;
    world.style.setProperty("--layers", String(layers));
    world.style.setProperty("--rise", String(Math.max(0, layers - 4)));
    moving.style.clipPath = `inset(0 ${(1 - width / originalWidth) * 100}% 0 0)`;
  };
  paint();

  field.onpointerdown = (event) => {
    if (primary(event) && dropAt === undefined) {
      dropAt = elapsed;
      dropPoint = event;
    }
  };

  await animateRound(clock, 60, (now) => {
    elapsed = now;
    if (dropAt === undefined) {
      const travel = 0.92 - width;
      const phase = (((now - slideStart) * 0.00037) / travel) % 2;
      x = 0.04 + travel * (1 - Math.abs(phase - 1));
      moving.style.left = `${x * 100}%`;
    } else {
      const progress = Math.min(1, (now - dropAt) / 140);
      moving.style.setProperty("--drop", String(progress));
      if (progress < 1) return false;
      // A small perfect-placement window keeps a well-timed stack viable.
      if (Math.abs(x - top) < 0.025) x = top;
      const left = Math.max(top, x);
      const right = Math.min(top + width, x + width);
      if (right <= left) {
        ended = true;
        roundFeedback(field, "沒疊中", dropPoint!);
      } else {
        if (right - left < width - 0.0001)
          roundFeedback(field, "切掉了", dropPoint!, false);
        const layer = document.createElement("div");
        block(layer, layers + 1);
        layer.style.left = `${x * 100}%`;
        layer.style.bottom = `calc(var(--step) * ${++layers})`;
        layer.style.clipPath = `inset(0 ${(1 - (right - x) / originalWidth) * 100}% 0 ${((left - x) / originalWidth) * 100}%)`;
        pile.append(layer);
        top = left;
        width = right - left;
        block(moving, layers + 1);
        dropAt = undefined;
        slideStart = now;
        x = 0.04;
        moving.style.left = "4%";
        moving.style.setProperty("--drop", "0");
        paint();
      }
    }
    return ended;
  });
  field.onpointerdown = null;
  if (ended)
    await new Promise<void>((resolve) => window.setTimeout(resolve, 500));
  return { score: layers };
};

export const secondRounds = { whack, diff, catch: catchFruit, stack };
