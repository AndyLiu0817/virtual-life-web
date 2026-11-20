import { universityScenery } from "./school-scenery";
import { universityRoadLayouts } from "./school-road-layouts";
import type { SchoolBoard } from "./school-board";
import { schoolTiles } from "./school-routes";
const landscape = new URL(
  "../../art/map_uni_noroad_landscape_v2.jpg",
  import.meta.url,
).href;
const portrait = new URL(
  "../../art/map_uni_noroad_portrait_v2.jpg",
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
  tiles: schoolTiles([
    "start",
    "story",
    "love",
    "shop",
    "game",
    "quiz",
    "club",
    "love",
    "event",
    "game",
    "story",
    "contest",
    "love",
    "quiz",
    "shop",
    "game",
    "love",
    "club",
    "story",
    "game",
    "quiz",
    "love",
    "event",
    "club",
    "game",
    "shop",
    "love",
    "quiz",
    "story",
    "contest",
    "love",
    "game",
    "shop",
    "club",
    "quiz",
    "love",
    "game",
    "story",
  ]),
  layouts: universityRoadLayouts,
  scenery: universityScenery,
};
