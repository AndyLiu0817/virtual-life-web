import rhythmBg from "../art/mg_rhythm_bg_final.jpg";
import memoryBg from "../art/mg_memory_bg_final.jpg";
import mathBg from "../art/mg_math_bg_final.jpg";
import shootBg from "../art/mg_shoot_bg_final.jpg";
import bullseye from "../art/shoot/bullseye.webp";
import sun from "../art/shoot/sun.webp";
import star from "../art/shoot/star.webp";
import coin from "../art/shoot/coin.webp";
import burst from "../art/shoot/burst.webp";
import miss from "../art/shoot/miss.webp";
import type { Minigame } from "./game/minigames";

import { differencePictures, secondArt } from "./minigame-second-art";

const art = {
  ...secondArt,
  rhythm: { bg: rhythmBg },
  memory: { bg: memoryBg },
  math: { bg: mathBg },
};

const sprites = import.meta.glob<string>("../art/minigames/*/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
});

export const whackCritters = ["clock", "ghost", "worm"] as const;

export function minigameBackground(game: Minigame) {
  const bg =
    game === "shoot"
      ? shootBg
      : game === "diff"
        ? differencePictures[0][0]
        : art[game].bg;
  const img = `<img class="mg-backdrop" src="${bg}" alt="" draggable="false">`;
  return game === "stack"
    ? `<picture><source media="(orientation: portrait)" srcset="${secondArt.stack.portrait}">${img}</picture>`
    : img;
}

export function sprite(game: Minigame, index: number | string = 0) {
  if (game === "shoot") return shootingSprite(shootingTargets[Number(index)]);
  if (game === "diff") return "";
  const name = game === "whack" && index === 0 ? whackCritters[0] : index;
  return `<img class="mg-sprite" src="${sprites[`../art/minigames/${game}/${name}.webp`]}" alt="" draggable="false">`;
}

export const shootingTargets = [bullseye, sun, star, coin];
export const shootingFeedback = { hit: burst, miss };

export function shootingSprite(src: string) {
  return `<img class="mg-shoot-sprite" src="${src}" alt="" draggable="false">`;
}

export const rhythmArt = `<img class="event-background" src="${rhythmBg}" alt="">`;
