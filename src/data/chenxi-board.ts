import type { BoardLayout, Cell, MapPoint, Orientation } from "./board-layout";
import type { BoardPresentation } from "./school-board";
import { juniorBrick, loopThrough } from "./school-road-layouts";
import type { chenxiTileLabels } from "./junior";

const routes = {
  landscape: [
    [0, 0],
    [2, 0],
    [2, 4],
    [4, 4],
    [4, 0],
    [8, 0],
    [8, 8],
    [7, 8],
    [7, 4],
    [5, 4],
    [5, 8],
    [0, 8],
  ],
  portrait: [
    [0, 0],
    [4, 0],
    [4, 4],
    [8, 4],
    [8, 8],
    [11, 8],
    [11, 10],
    [10, 10],
    [10, 11],
    [7, 11],
    [7, 7],
    [3, 7],
    [3, 3],
    [-2, 3],
    [-2, 1],
    [0, 1],
  ],
} as const;

// The labels are the only flat foreground objects in the temporary maps.
const labelBounds = {
  landscape: [
    [639, 75],
    [1068, 240],
    [813, 621],
    [852, 372],
    [147, 264],
  ],
  portrait: [
    [627, 171],
    [450, 741],
    [366, 1047],
    [393, 684],
    [135, 348],
  ],
} as const;

function layout(orientation: Orientation): BoardLayout {
  const portrait = orientation === "portrait";
  const width = portrait ? 720 : 1280;
  const height = portrait ? 1280 : 720;
  const origin: MapPoint = portrait ? [390, 110] : [640, 130];
  const { halfWidth, halfHeight } = juniorBrick(orientation, width);
  const vertices: readonly Cell[] = routes[orientation];
  const outline = (offset: number) =>
    vertices.map(([column, row], index): MapPoint => {
      const [ax, ay] = vertices.at(index - 1)!;
      const [bx, by] = vertices[(index + 1) % vertices.length];
      const c = column + offset * (Math.sign(row - ay) + Math.sign(by - row));
      const r =
        row - offset * (Math.sign(column - ax) + Math.sign(bx - column));
      return [
        origin[0] + (c - r) * halfWidth,
        origin[1] + (c + r) * halfHeight,
      ];
    });
  return {
    width,
    height,
    origin,
    halfWidth,
    halfHeight,
    pawnHeight: portrait ? 83 : 90,
    cells: loopThrough(vertices),
    road: {
      outlines: [outline(0.62), outline(-0.38)],
      obstacles: labelBounds[orientation].map(([x, y], index) => {
        const half = index === 1 || index === 2 ? 59 : 70;
        return [
          [x - half, y - 20],
          [x + half, y - 20],
          [x + half, y + 20],
          [x - half, y + 20],
        ];
      }),
    },
  };
}

export const districts = [
  { name: "晨光西町", price: 20000, tiles: [1, 4, 7] },
  { name: "書香街", price: 24000, tiles: [11, 14, 17] },
  { name: "老港埕", price: 36000, tiles: [19, 22, 25] },
  { name: "星光夜市", price: 40000, tiles: [28, 31, 34] },
  { name: "天星商圈", price: 60000, tiles: [38, 41, 44] },
] as const;
export const districtTileIds: readonly number[] = districts.flatMap(
  ({ tiles }) => [...tiles],
);
export function districtAt(tile: number) {
  return districts.find(({ tiles }) =>
    (tiles as readonly number[]).includes(tile),
  );
}
export function districtLabel(tile: number) {
  const district = districtAt(tile)!;
  return (
    district.name +
    ["一", "二", "三"][(district.tiles as readonly number[]).indexOf(tile)]
  );
}
export const metroStations = { 9: "西町站", 37: "天星站" } as const;

const kinds = [
  "start",
  "district",
  "job",
  "event",
  "district",
  "love",
  "card",
  "district",
  "lot",
  "metro",
  "story",
  "district",
  "job",
  "game",
  "district",
  "shop",
  "battle",
  "district",
  "event",
  "district",
  "battle",
  "card",
  "district",
  "story",
  "lot",
  "district",
  "battle",
  "game",
  "district",
  "job",
  "love",
  "district",
  "event",
  "battle",
  "district",
  "shop",
  "card",
  "metro",
  "district",
  "job",
  "story",
  "district",
  "lot",
  "battle",
  "district",
  "game",
  "event",
  "battle",
] as const satisfies readonly (keyof typeof chenxiTileLabels)[];

export const chenxiBoard = {
  stage: "chenxi",
  label: "晨曦市",
  turns: 60,
  start: 0,
  tiles: kinds.map((kind, index) => ({
    kind,
    next: [(index + 1) % kinds.length],
  })),
  // Replace these with map_chenxi_noroad_{orientation}_final.jpg and
  // map_chenxi_{orientation}_final.jpg when the final road vectors are ready.
  maps: {
    landscape: new URL(
      "../../art/map_chenxi_placeholder_noroad_landscape.jpg",
      import.meta.url,
    ).href,
    portrait: new URL(
      "../../art/map_chenxi_placeholder_noroad_portrait.jpg",
      import.meta.url,
    ).href,
  },
  roadMaps: {
    landscape: new URL(
      "../../art/map_chenxi_placeholder_landscape.jpg",
      import.meta.url,
    ).href,
    portrait: new URL(
      "../../art/map_chenxi_placeholder_portrait.jpg",
      import.meta.url,
    ).href,
  },
  layouts: { landscape: layout("landscape"), portrait: layout("portrait") },
  scenery: { landscape: [], portrait: [] },
  pawnFolder: "university/",
  walkFolder: "university/walk/",
} satisfies BoardPresentation;
