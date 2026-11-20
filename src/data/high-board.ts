import { highScenery } from "./school-scenery";
import { highRoadLayouts } from "./school-road-layouts";
import type { SchoolBoard } from "./school-board";
import { schoolTiles } from "./school-routes";
const landscape = new URL(
  "../../art/map_high_noroad_landscape_v2.jpg",
  import.meta.url,
).href;
const portrait = new URL(
  "../../art/map_high_noroad_portrait_v2.jpg",
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
  tiles: schoolTiles([
    "start",
    "event",
    "shop",
    "event",
    "game",
    "club",
    "quiz",
    "event",
    "game",
    "contest",
    "event",
    "club",
    "game",
    "quiz",
    "event",
    "game",
    "event",
    "club",
    "quiz",
    "shop",
    "game",
    "club",
    "event",
    "game",
    "quiz",
    "event",
    "game",
    "club",
    "event",
    "contest",
    "game",
    "event",
    "quiz",
    "club",
    "game",
    "event",
  ]),
  layouts: highRoadLayouts,
  scenery: highScenery,
};
