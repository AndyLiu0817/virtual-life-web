import { highRoadLayouts } from "./school-road-layouts";
import type { SchoolBoard } from "./school-board";
import { schoolTiles } from "./school-routes";
const landscape = new URL(
  "../../art/map_high_noroad_landscape_final.jpg",
  import.meta.url,
).href;
const portrait = new URL(
  "../../art/map_high_noroad_portrait_final.jpg",
  import.meta.url,
).href;

export const highBoard: SchoolBoard = {
  stage: "high",
  label: "高中地圖",
  maps: { landscape, portrait },
  roadMaps: {
    landscape: new URL(
      "../../art/map_high_landscape_final.jpg",
      import.meta.url,
    ).href,
    portrait: new URL("../../art/map_high_portrait_final.jpg", import.meta.url)
      .href,
  },
  turns: 25,
  start: 0,
  pawnFolder: "high/",
  walkFolder: "high/walk/",
  tiles: schoolTiles(
    [
      "start",
      "event",
      "event",
      "event",
      "game",
      "club",
      "quiz",
      "event",
      "game",
      "event",
      "contest",
      "club",
      "fork",
      "event",
      "game",
      "quiz",
      "event",
      "game",
      "club",
      "event",
      "quiz",
      "game",
      "event",
      "club",
      "event",
      "contest",
      "game",
      "fork",
      "event",
      "quiz",
      "club",
      "game",
      "event",
    ],
    [27, 12, 3],
  ),
  layouts: highRoadLayouts,
  scenery: {
    landscape: [
      {
        name: "中庭噴水池",
        outline:
          "349,541 355,521 369,508 384,502 385,491 392,483 405,483 411,493 411,501 430,506 448,521 451,540 439,553 421,562 396,566 376,560 359,554",
        anchor: [400, 566],
      },
      {
        name: "西側校舍",
        outline:
          "128,212 164,180 230,158 258,124 388,86 440,104 510,82 560,82 606,114 608,134 648,156 658,252 622,276 538,302 502,294 482,342 444,366 402,374 380,350 340,364 296,354 242,370 222,344 180,348 160,310",
        anchor: [426, 374],
      },
      {
        name: "東側校舍",
        outline:
          "976,162 1026,148 1042,128 1088,116 1132,134 1158,160 1210,174 1248,196 1248,328 1198,356 1142,374 1102,354 1036,336 996,310 984,280 946,254 944,216",
        anchor: [1080, 368],
      },
      {
        name: "噴水池旁大樹",
        outline:
          "264,518 258,492 270,474 284,456 312,446 332,456 354,468 362,492 348,520 326,528 326,556 302,558 296,536 276,534",
        anchor: [310, 556],
      },
      {
        name: "球場櫻花樹",
        outline:
          "944,526 952,500 976,472 1012,470 1040,488 1056,512 1044,534 1018,538 1018,568 1006,580 988,582 986,544 966,540",
        anchor: [996, 580],
      },
      {
        name: "校園西側櫻花樹",
        outline:
          "38,344 42,304 70,284 110,282 148,296 174,324 178,368 164,388 136,394 132,430 108,436 98,398 70,390 44,372",
        anchor: [110, 432],
      },
      {
        name: "中庭大樹",
        outline:
          "546,386 550,352 560,330 582,314 610,316 630,342 636,370 620,392 606,392 608,414 584,420 582,396 564,396",
        anchor: [592, 416],
      },
      {
        name: "前景櫻花",
        outline:
          "1116,642 1122,612 1154,592 1200,580 1228,588 1254,586 1280,600 1280,702 1230,708 1192,702 1154,686",
        anchor: [1194, 688],
      },
    ],
    portrait: [
      {
        name: "高中教學樓",
        outline:
          "62,248 70,184 112,156 242,144 292,150 320,130 492,122 566,122 622,146 638,212 630,320 560,366 462,342 404,356 342,352 312,366 216,366 138,382 88,344",
        anchor: [356, 380],
      },
      {
        name: "西側櫻花樹",
        outline:
          "0,322 24,304 72,302 104,322 122,344 114,386 96,404 78,410 66,468 44,470 34,430 0,422",
        anchor: [58, 470],
      },
      {
        name: "右前景櫻花樹",
        outline:
          "598,1046 598,1010 626,990 658,984 674,972 720,986 720,1110 696,1112 686,1144 656,1150 644,1110 626,1100",
        anchor: [654, 1138],
      },
      {
        name: "高中校門",
        outline:
          "256,1254 256,1160 274,1148 296,1144 314,1158 344,1132 376,1132 412,1146 432,1166 452,1152 470,1156 486,1174 486,1256 450,1256 450,1200 422,1178 372,1162 326,1176 292,1208 294,1256",
        anchor: [360, 1256],
      },
    ],
  },
};
