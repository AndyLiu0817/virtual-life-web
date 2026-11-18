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
export type Orientation = "landscape" | "portrait";
type Point = readonly [x: number, y: number];

interface Tile {
  kind: TileKind;
  landscape: Point;
  portrait: Point;
  next: readonly number[];
}

export interface Board {
  turns: number;
  start: number;
  layouts: Record<
    Orientation,
    { width: number; height: number; tileWidth: number }
  >;
  tiles: readonly Tile[];
}

// Coordinates refer to scaled copies of the two illustrations. Tile indices are
// stable save IDs. The first route at each fork follows the outer loop.
export const juniorBoard: Board = {
  turns: 15,
  start: 0,
  layouts: {
    landscape: { width: 780, height: 439, tileWidth: 36 },
    portrait: { width: 439, height: 780, tileWidth: 38 },
  },
  tiles: [
    { kind: "start", landscape: [99, 352], portrait: [225, 638], next: [1] },
    { kind: "event", landscape: [96, 291], portrait: [125, 618], next: [2] },
    { kind: "game", landscape: [185, 241], portrait: [73, 554], next: [3] },
    { kind: "club", landscape: [290, 250], portrait: [76, 488], next: [4] },
    { kind: "fork", landscape: [374, 266], portrait: [82, 431], next: [5, 17] },
    { kind: "quiz", landscape: [424, 221], portrait: [85, 368], next: [6] },
    { kind: "event", landscape: [446, 177], portrait: [93, 299], next: [7] },
    { kind: "game", landscape: [502, 166], portrait: [120, 253], next: [8] },
    { kind: "quiz", landscape: [560, 179], portrait: [174, 232], next: [9] },
    { kind: "event", landscape: [620, 205], portrait: [230, 231], next: [10] },
    {
      kind: "contest",
      landscape: [681, 248],
      portrait: [286, 235],
      next: [11],
    },
    { kind: "game", landscape: [690, 324], portrait: [341, 257], next: [12] },
    { kind: "event", landscape: [623, 383], portrait: [361, 309], next: [13] },
    { kind: "club", landscape: [508, 384], portrait: [367, 369], next: [14] },
    {
      kind: "fork",
      landscape: [402, 328],
      portrait: [373, 431],
      next: [15, 17],
    },
    { kind: "quiz", landscape: [316, 349], portrait: [384, 529], next: [16] },
    { kind: "game", landscape: [218, 380], portrait: [341, 607], next: [0] },
    {
      kind: "event",
      landscape: [398, 296],
      portrait: [225, 431],
      next: [4, 14],
    },
  ],
};
