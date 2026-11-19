import whackBg from "../art/mg_whack_bg_final.jpg";
import catchBg from "../art/mg_catch_bg_final.jpg";
import stackBg from "../art/mg_stack_bg_landscape_final.jpg";
import stackPortrait from "../art/mg_stack_bg_portrait_final.jpg";
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

export const secondArt = {
  whack: { bg: whackBg },
  catch: { bg: catchBg },
  stack: { bg: stackBg, portrait: stackPortrait },
};
