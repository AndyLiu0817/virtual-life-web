import { measureTrack } from "./board-track";
import type { BoardLayout } from "./data/board-layout";
import { tileLabels, type TileKind } from "./data/junior";

const sprites = import.meta.glob<string>(
  "./board-art/{*-print,boy-*,girl-*}.webp",
  {
    eager: true,
    query: "?url",
    import: "default",
  },
);
const sprite = (name: string) => sprites[`./board-art/${name}.webp`];

type Pose = "stand" | "left" | "right" | "win";
const paint: Record<TileKind, string> = {
  start: "#e9b750",
  event: "#61b5c2",
  game: "#79c1a3",
  club: "#79a7c5",
  quiz: "#e5be66",
  contest: "#e69460",
  fork: "#e9dfc5",
};

export function boardView(
  svg: SVGSVGElement,
  layout: BoardLayout,
  tiles: readonly { kind: TileKind }[],
  gender: "boy" | "girl",
  debug: boolean,
  follow: (point: { x: number; y: number }) => void,
) {
  const { centers, pavers, edges } = measureTrack(layout);
  const pawnWidth = (layout.pawnHeight * 116) / 197;
  const pawnLabel = gender === "boy" ? "男主角棋子" : "女主角棋子";
  svg.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`);
  svg.innerHTML = `
    <defs>
      <linearGradient id="paver-light" x2="0%" y2="100%">
        <stop stop-color="white" stop-opacity=".34"/>
        <stop offset="1" stop-color="white" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <g class="board-depth">
    ${[...centers]
      .sort(([, a], [, b]) => a.y - b.y)
      .map(([id]) => {
        const { kind } = tiles[id];
        const { face, print, iconSize } = pavers.get(id)!;
        return `<g class="board-tile" data-kind="${kind}" data-tile="${id}" role="img" aria-label="${tileLabels[kind]}">
        <path class="paver-shadow" d="${face}" transform="translate(0 4)"/>
        <path class="paver-side" d="${face}" fill="${paint[kind]}" transform="translate(0 2.6)"/>
        <path class="paver-top" d="${face}" fill="${paint[kind]}"/>
        <path d="${face}" fill="url(#paver-light)"/>
        <image href="${sprite(`${kind}-print`)}" x="${-iconSize / 2}" y="${-iconSize / 2}" width="${iconSize}" height="${iconSize}" transform="${print}"/>
      </g>`;
      })
      .join("")}
    <g class="board-pawn" role="img">
      <ellipse class="pawn-shadow" rx="${pawnWidth * 0.37}" ry="${pawnWidth * 0.12}"/>
      ${(["stand", "left", "right", "win"] as const)
        .map((pose) => {
          const height =
            pose === "win" && gender === "boy"
              ? (layout.pawnHeight * 167) / 197
              : layout.pawnHeight;
          const sole = gender === "girl" ? 188 : pose === "win" ? 167 : 192;
          const y = -(layout.pawnHeight * sole) / 197;
          return `<image data-pose="${pose}" href="${sprite(`${gender}-${pose}`)}" x="${-pawnWidth / 2}" y="${y}" width="${pawnWidth}" height="${height}" visibility="hidden"/>`;
        })
        .join("")}
    </g></g>
    ${
      debug
        ? `<g class="path-debug" aria-hidden="true">
      ${layout.tracks.map(({ path }) => `<path d="${path}"/>`).join("")}
      ${[...centers].map(([id, { x, y }]) => `<circle cx="${x}" cy="${y}" r="2.5"/><text x="${x}" y="${y - 5}">${id}</text>`).join("")}
    </g>`
        : ""
    }
  `;
  const pawn = svg.querySelector<SVGGElement>(".board-pawn")!;
  const shadow = pawn.querySelector("ellipse")!;
  const depth = pawn.parentElement!;
  const tileNodes = [...depth.querySelectorAll<SVGGElement>(".board-tile")];
  const tileDepths = tileNodes.map(
    (tile) => centers.get(Number(tile.dataset.tile))!.y,
  );
  let occluder: SVGGElement | null | undefined;
  const poses = Object.fromEntries(
    [...pawn.querySelectorAll("image")].map((image) => [
      image.dataset.pose,
      image,
    ]),
  );
  let visible: SVGImageElement | undefined;
  function draw(
    { x, y }: { x: number; y: number },
    pose: Pose,
    facing: number,
    lift = 0,
    squash = 0,
  ) {
    const image = poses[pose];
    if (visible !== image) {
      visible?.setAttribute("visibility", "hidden");
      image.setAttribute("visibility", "visible");
      visible = image;
    }
    pawn.setAttribute("transform", `translate(${x} ${y})`);
    const ahead =
      tileNodes[tileDepths.findIndex((tileY) => tileY > y + 0.5)] ?? null;
    if (ahead !== occluder) {
      depth.insertBefore(pawn, ahead);
      occluder = ahead;
    }
    follow({ x: x / layout.width, y: y / layout.height });
    image.setAttribute(
      "transform",
      `translate(0 ${-lift}) scale(${facing * (1 + squash * 0.5)} ${1 - squash})`,
    );
    shadow.setAttribute("opacity", String(0.65 - lift / layout.pawnHeight));
    shadow.setAttribute(
      "transform",
      `scale(${1 - lift / (layout.pawnHeight * 2)})`,
    );
  }

  function place(id: number, pose: "stand" | "win", facing: number) {
    draw(centers.get(id)!, pose, facing);
    if (pawn.dataset.tile !== String(id)) pawn.dataset.tile = String(id);
    pawn.setAttribute(
      "aria-label",
      `${pawnLabel}，位於第 ${id + 1} 格${tileLabels[tiles[id].kind]}`,
    );
  }

  return {
    place,
    step(
      from: number,
      to: number,
      progress: number,
      facing: number,
      stride: boolean,
    ) {
      const lane = edges.get(`${from}:${to}`)!;
      const phase = Math.min(1, progress / 0.78);
      const travel = phase * phase * (3 - 2 * phase);
      const point = lane(travel);
      const dx =
        lane(Math.min(1, travel + 0.04)).x - lane(Math.max(0, travel - 0.04)).x;
      const direction = Math.abs(dx) < 0.12 ? facing : dx < 0 ? 1 : -1;
      const lift = 4 * travel * (1 - travel) * layout.pawnHeight * 0.21;
      const landing = Math.max(0, (progress - 0.78) / 0.22);
      draw(
        point,
        stride ? "left" : "right",
        direction,
        lift,
        Math.sin(Math.PI * landing) * 0.17,
      );
      return direction;
    },
  };
}
