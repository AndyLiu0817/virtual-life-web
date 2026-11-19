import whackBg from "../art/mg_whack_bg_final.jpg";
import catchBg from "../art/mg_catch_bg_final.jpg";
import stackBg from "../art/mg_stack_bg_landscape_final.jpg";
import stackPortrait from "../art/mg_stack_bg_portrait_final.jpg";
import whackSheet from "../art/minigames/whack.webp";
import catchSheet from "../art/minigames/catch.webp";
import stackSheet from "../art/minigames/stack.webp";
import diff1a from "../art/mg_diff1_a_final.jpg";
import diff1b from "../art/mg_diff1_b_final.jpg";
import diff2a from "../art/mg_diff2_a_final.jpg";
import diff2b from "../art/mg_diff2_b_final.jpg";
import diff3a from "../art/mg_diff3_a_final.jpg";
import diff3b from "../art/mg_diff3_b_final.jpg";

export const differencePictures = [
  [diff1a, diff1b],
  [diff2a, diff2b],
  [diff3a, diff3b],
] as const;

type Crop = [x: number, y: number, width: number, height: number];

export const secondArt: Record<
  "whack" | "catch" | "stack",
  { bg: string; portrait?: string; sheet: string; crops: Crop[] }
> = {
  whack: {
    bg: whackBg,
    sheet: whackSheet,
    crops: [
      [13, 14, 80, 80],
      [179, 16, 70, 79],
      [332, 17, 60, 76],
    ],
  },
  catch: {
    bg: catchBg,
    sheet: catchSheet,
    crops: [
      [16, 17, 65, 72],
      [82, 17, 64, 72],
      [149, 17, 69, 73],
      [220, 17, 58, 74],
      [283, 17, 54, 72],
      [343, 20, 61, 69],
      [407, 17, 63, 72],
      [24, 98, 70, 75],
      [101, 101, 71, 72],
      [181, 103, 69, 70],
      [268, 90, 73, 84],
    ],
  },
  stack: {
    bg: stackBg,
    portrait: stackPortrait,
    sheet: stackSheet,
    crops: [
      [23, 23, 77, 57],
      [115, 22, 77, 58],
      [205, 23, 77, 57],
      [296, 23, 77, 57],
      [386, 23, 77, 57],
      [29, 102, 83, 61],
      [136, 102, 78, 61],
      [238, 102, 77, 61],
      [340, 102, 79, 61],
    ],
  },
};
