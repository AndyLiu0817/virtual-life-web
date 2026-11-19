import { universityRoadLayouts } from "./school-road-layouts";
import type { SchoolBoard } from "./school-board";
import { schoolTiles } from "./school-routes";
const landscape = new URL(
  "../../art/map_uni_noroad_landscape_final.jpg",
  import.meta.url,
).href;
const portrait = new URL(
  "../../art/map_uni_noroad_portrait_final.jpg",
  import.meta.url,
).href;

export const universityBoard: SchoolBoard = {
  stage: "university",
  label: "大學地圖",
  maps: { landscape, portrait },
  roadMaps: {
    landscape: new URL("../../art/map_uni_landscape_final.jpg", import.meta.url)
      .href,
    portrait: new URL("../../art/map_uni_portrait_final.jpg", import.meta.url)
      .href,
  },
  turns: 40,
  start: 0,
  pawnFolder: "university/",
  walkFolder: "university/walk/",
  tiles: schoolTiles(
    [
      "start",
      "event",
      "love",
      "event",
      "game",
      "love",
      "quiz",
      "fork",
      "club",
      "love",
      "event",
      "game",
      "love",
      "contest",
      "event",
      "quiz",
      "love",
      "game",
      "fork",
      "event",
      "club",
      "quiz",
      "game",
      "event",
    ],
    [18, 7, 3],
  ),
  layouts: universityRoadLayouts,
  scenery: {
    landscape: [
      {
        name: "天文台",
        outline:
          "806,362 822,318 844,284 874,264 910,252 942,260 980,288 1004,328 1028,374 1032,426 1024,450 998,474 956,490 908,496 876,490 838,474 812,442",
        anchor: [916, 502],
      },
      {
        name: "西側咖啡座",
        outline:
          "36,266 48,210 84,188 134,176 192,188 208,216 226,222 242,264 230,328 278,330 302,352 300,376 262,406 208,424 138,424 106,404 80,404 66,378 48,336",
        anchor: [204, 404],
      },
      {
        name: "圖書館",
        outline:
          "578,166 618,110 666,98 710,68 764,64 796,88 814,98 874,94 912,112 924,146 924,230 900,250 840,260 786,254 760,278 694,282 642,262 596,240",
        anchor: [762, 278],
      },
      {
        name: "東側校舍",
        outline:
          "970,180 996,154 1034,134 1088,116 1144,142 1154,182 1196,168 1240,184 1274,212 1264,358 1220,388 1152,368 1104,330 1026,310 976,262",
        anchor: [1140, 390],
      },
      {
        name: "西側大樹",
        outline:
          "290,520 302,486 320,476 330,450 360,440 388,450 414,476 410,506 388,520 364,524 358,558 334,556 334,526",
        anchor: [342, 556],
      },
      {
        name: "前景樹叢",
        outline:
          "494,718 502,686 534,658 558,654 580,636 602,638 628,626 654,636 686,654 692,674 716,696 714,718",
        anchor: [602, 714],
      },
    ],
    portrait: [
      {
        name: "中央夜間教學樓",
        outline:
          "60,232 72,194 104,174 166,158 228,162 270,172 306,136 354,114 410,104 468,110 538,128 576,152 620,200 630,248 620,320 570,340 510,344 470,350 428,338 388,360 346,366 306,342 258,350 222,368 148,380 94,364 78,322",
        anchor: [354, 374],
      },
      {
        name: "夜間咖啡座",
        outline:
          "264,626 234,596 234,562 260,512 274,492 276,462 284,452 308,462 428,462 466,450 474,456 476,482 496,530 490,614 462,648 412,670 362,676 302,662",
        anchor: [374, 672],
      },
      {
        name: "天文台",
        outline:
          "292,894 290,858 302,810 322,782 352,768 384,780 406,808 422,848 418,900 396,924 364,948 326,942 302,924",
        anchor: [356, 944],
      },
      {
        name: "大學校門",
        outline:
          "240,1236 242,1154 256,1134 278,1132 298,1142 312,1120 348,1110 378,1114 414,1126 430,1148 452,1136 472,1148 474,1242 442,1250 436,1186 406,1162 358,1150 310,1170 278,1198 276,1248",
        anchor: [354, 1246],
      },
      {
        name: "西側前景大樹",
        outline:
          "0,962 20,946 50,934 74,946 106,958 124,988 118,1022 106,1054 90,1064 86,1108 56,1112 56,1072 28,1062 0,1026",
        anchor: [72, 1114],
      },
    ],
  },
};
