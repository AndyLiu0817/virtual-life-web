import type { BoardLayout, Orientation } from "./board-layout";
import { juniorLayouts } from "./junior-layout";

export const tileLabels = {
  start: "起點",
  event: "事件",
  game: "遊戲",
  club: "社團",
  quiz: "小考",
  contest: "大賽",
  fork: "岔路",
};

export type TileKind = keyof typeof tileLabels;
interface Tile {
  kind: TileKind;
  next: readonly number[];
}

export interface Board {
  turns: number;
  start: number;
  layouts: Record<Orientation, BoardLayout>;
  tiles: readonly Tile[];
}

// Tile indices are stable save IDs. The first route at each fork follows
// the outer loop.
export const juniorBoard: Board = {
  turns: 15,
  start: 0,
  layouts: juniorLayouts,
  tiles: [
    { kind: "start", next: [1] },
    { kind: "event", next: [2] },
    { kind: "game", next: [3] },
    { kind: "club", next: [4] },
    { kind: "fork", next: [5, 17] },
    { kind: "quiz", next: [6] },
    { kind: "event", next: [7] },
    { kind: "game", next: [8] },
    { kind: "quiz", next: [9] },
    { kind: "event", next: [10] },
    {
      kind: "contest",
      next: [11],
    },
    { kind: "game", next: [12] },
    { kind: "event", next: [13] },
    { kind: "club", next: [14] },
    {
      kind: "fork",
      next: [15, 17],
    },
    { kind: "quiz", next: [16] },
    { kind: "game", next: [0] },
    {
      kind: "event",
      next: [4, 14],
    },
  ],
};
