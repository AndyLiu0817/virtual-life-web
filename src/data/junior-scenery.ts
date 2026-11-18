import type { Orientation } from "./board-layout";

export interface SceneryObject {
  name: string;
  source: Orientation;
  outline: string;
  anchor: readonly [x: number, y: number];
  // An optional destination for a reused cutout, measured from its source anchor.
  placement?: readonly [x: number, y: number, scale: number];
}

// Outlines and contact points are measured in the source illustration's viewBox.
const annex = {
  source: "landscape",
  outline:
    "21.5,150 25,146 88,131 92,132 122,154 124,158 127,210 129,217 126,222 74,234 63,235 54,231 48,227 41,220 39,214 43,210 41,203 38,199 33,197 27,199 24,196 23,178",
  anchor: [73, 224],
} as const;

export const juniorScenery: Record<Orientation, readonly SceneryObject[]> = {
  landscape: [
    { ...annex, name: "西側教室" },
    {
      name: "教學大樓",
      source: "landscape",
      outline:
        "103,125 145,102 145,85 207,55 228,55 265,75 304,66 345,86 346,131 322,144 308,153 264,170 269,191 246,205 208,211 191,184 153,197 122,184 110,142",
      anchor: [234, 192],
    },
    {
      name: "研究大樓",
      source: "landscape",
      outline:
        "368,68 387,57 450,47 463,53 476,74 476,111 468,134 453,151 420,159 401,143 377,129",
      anchor: [431, 148],
    },
    {
      name: "風力裝置",
      source: "landscape",
      outline:
        "475,78 498,61 497,43 502,33 508,39 510,66 530,78 535,86 530,91 511,80 513,121 509,129 497,128 495,121 501,79 478,88",
      anchor: [505, 128],
    },
    {
      name: "圖書館",
      source: "landscape",
      outline:
        "573,99 618,77 637,77 677,96 678,118 717,104 768,127 765,164 745,197 706,211 668,202 647,190 630,185 586,166 574,137",
      anchor: [681, 199],
    },
    {
      name: "庭園大樹",
      source: "landscape",
      outline:
        "178,272 183,257 194,249 207,251 219,259 226,274 224,285 211,290 208,303 217,310 188,312 198,299 197,292 182,287",
      anchor: [201, 309],
    },
    {
      name: "池畔木橋",
      source: "landscape",
      outline:
        "520,244 528,233 541,228 558,229 576,237 592,249 604,266 595,273 580,264 567,253 550,247 534,251",
      anchor: [592, 268],
    },
    {
      name: "東側大樹",
      source: "landscape",
      outline:
        "733,274 737,253 747,241 762,232 780,231 780,335 766,336 746,329 767,315 767,298 748,296 737,288",
      anchor: [773, 333],
    },
    { ...annex, name: "庭園小教室", placement: [236, 265, 0.78] },
  ],
  portrait: [
    {
      name: "教學大樓",
      source: "portrait",
      outline:
        "27,111 38,97 155,83 169,85 172,75 190,68 369,73 391,81 397,93 400,162 393,185 374,198 339,199 276,192 249,188 242,179 182,178 172,193 107,205 59,205 37,190 31,162",
      anchor: [216, 197],
    },
    {
      name: "池畔木橋",
      source: "portrait",
      outline:
        "136,351 144,343 156,339 157,335 163,335 165,339 191,338 206,343 211,340 215,346 215,371 209,373 198,369 181,364 161,368 140,375 135,370",
      anchor: [173, 369],
    },
    {
      name: "西側大樹",
      source: "portrait",
      outline:
        "19,618 35,610 44,615 55,624 56,639 51,655 39,664 38,677 25,683 23,668 11,664 4,654 4,635",
      anchor: [31, 677],
    },
    {
      name: "東側大樹",
      source: "portrait",
      outline:
        "374,641 384,627 404,620 420,624 429,634 433,648 428,664 418,678 404,681 401,692 386,691 389,679 378,674 371,658",
      anchor: [399, 688],
    },
    {
      name: "校門",
      source: "portrait",
      outline:
        "157,690 164,676 173,671 184,676 184,684 204,675 229,672 250,677 263,683 266,675 275,671 284,679 290,693 287,771 265,774 257,761 189,761 181,775 160,771",
      anchor: [223, 767],
    },
    { ...annex, name: "操場小教室", placement: [268, 459, 0.78] },
  ],
};
