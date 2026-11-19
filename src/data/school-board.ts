import type { Orientation } from "./board-layout";
import { juniorMaps } from "./junior-maps";
import { juniorBoard, type Board } from "./junior";
import { juniorScenery, type SceneryObject } from "./junior-scenery";
import { highBoard } from "./high-board";
import { universityBoard } from "./university-board";

export type BoardStage = "junior" | "high" | "university";

export interface SchoolBoard extends Board {
  stage: BoardStage;
  label: string;
  maps: Record<Orientation, string>;
  roadMaps?: Record<Orientation, string>;
  scenery: Record<Orientation, readonly SceneryObject[]>;
  pawnFolder: string;
  walkFolder: string;
}

export const schoolBoards: Record<BoardStage, SchoolBoard> = {
  junior: {
    ...juniorBoard,
    stage: "junior",
    label: "國中地圖",
    maps: juniorMaps,
    scenery: juniorScenery,
    pawnFolder: "",
    walkFolder: "walk-junior/",
  },
  high: highBoard,
  university: universityBoard,
};

export function isBoardStage(stage: string): stage is BoardStage {
  return Object.hasOwn(schoolBoards, stage);
}
