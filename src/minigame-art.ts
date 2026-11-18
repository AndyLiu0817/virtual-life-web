import rhythmBg from "../art/mg_rhythm_bg_final.jpg";
import rhythmSheet from "../art/mg_rhythm_sheet_final.jpg";
import memoryBg from "../art/mg_memory_bg_final.jpg";
import memorySheet from "../art/mg_memory_sheet_final.jpg";
import mathBg from "../art/mg_math_bg_final.jpg";
import mathSheet from "../art/mg_math_sheet_final.jpg";
import shootBg from "../art/mg_shoot_bg_final.jpg";
import shootSheet from "../art/mg_shoot_sheet_final.jpg";
import type { Minigame } from "./game/minigames";

type Crop = [x: number, y: number, width: number, height: number];
const art: Record<Minigame, { bg: string; sheet: string; crops: Crop[] }> = {
  rhythm: {
    bg: rhythmBg,
    sheet: rhythmSheet,
    crops: [
      [28, 21, 65, 65],
      [107, 21, 65, 65],
      [185, 21, 65, 65],
      [263, 21, 65, 65],
    ],
  },
  memory: {
    bg: memoryBg,
    sheet: memorySheet,
    crops: [11, 68, 119, 170, 221, 272, 323, 374, 424].map((x) => [
      x,
      57,
      47,
      66,
    ]),
  },
  math: {
    bg: mathBg,
    sheet: mathSheet,
    crops: [
      [35, 12, 52, 89],
      [24, 115, 74, 48],
    ],
  },
  shoot: {
    bg: shootBg,
    sheet: shootSheet,
    crops: [
      [40, 17, 63, 80],
      [126, 17, 64, 80],
      [211, 18, 65, 79],
      [295, 17, 64, 80],
    ],
  },
};

export function minigameBackground(game: Minigame) {
  return `<img class="mg-backdrop" src="${art[game].bg}" alt="" draggable="false">`;
}

// Coordinates use the same 480 × 270 scale for every 16:9 source sheet.
export function sprite(game: Minigame, index = 0) {
  const { sheet, crops } = art[game];
  const [x, y, width, height] = crops[index];
  return `<span class="mg-sprite" aria-hidden="true" style="aspect-ratio:${width}/${height};background-image:url('${sheet}');background-size:${(480 / width) * 100}% ${(270 / height) * 100}%;background-position:${(x / (480 - width)) * 100}% ${(y / (270 - height)) * 100}%"></span>`;
}

export const rhythmArt = `<img class="event-background" src="${rhythmBg}" alt="">`;
