import { assets } from "./assets";
import { clayRadius, debugGrid, measureTrack } from "./board-track";
import type { BoardLayout, Orientation } from "./data/board-layout";
import { juniorScenery } from "./data/junior-scenery";
import { tileLabels, type TileKind } from "./data/junior";

const sprites = import.meta.glob<string>(
  "./board-art/{*-clay,boy-*,girl-*}.webp",
  {
    eager: true,
    query: "?url",
    import: "default",
  },
);
const sprite = (name: string) => sprites[`./board-art/${name}.webp`];

type Pose = "stand" | "left" | "right" | "win";
// Love art is part of the tilesheet, while the junior rules use seven kinds.
const claySides = {
  start: "#bb801d",
  event: "#16869e",
  game: "#398b71",
  club: "#1a829d",
  quiz: "#b7831b",
  contest: "#bd5d32",
  love: "#b34f60",
  fork: "#a99a84",
} satisfies Record<TileKind | "love", string>;

export function boardView(
  svg: SVGSVGElement,
  layout: BoardLayout,
  orientation: Orientation,
  tiles: readonly { kind: TileKind }[],
  gender: "boy" | "girl",
  debug: boolean,
  follow: (point: { x: number; y: number }) => void,
) {
  const { centers, wall, tileTop } = measureTrack(layout);
  const pawnWidth = (layout.pawnHeight * 116) / 197;
  const pawnLabel = gender === "boy" ? "男主角棋子" : "女主角棋子";
  const scenery = juniorScenery[orientation].map((object, id) => {
    const [x, y] = object.anchor;
    return { ...object, id, x, y };
  });
  const layers = scenery.map(({ id, name, y }) => ({
    y,
    markup: `<g class="board-scenery" data-scenery="${id}" data-name="${name}" data-depth="${y}" aria-hidden="true">
      <use href="#scene-art" clip-path="url(#scenery-clip-${id})"/>
    </g>`,
  }));
  for (const [id, center] of centers.entries()) {
    const { kind } = tiles[id];
    layers.push({
      y: center.y,
      markup: `<g class="board-tile" data-depth="${center.y}" data-kind="${kind}" data-tile="${id}" role="img" aria-label="${tileLabels[kind]}">
        <g transform="translate(${center.x} ${center.y})">
          <use href="#clay-wall" class="paver-shadow" transform="translate(0 1.6)"/>
          <use href="#clay-wall" fill="${claySides[kind]}"/>
          <use href="#clay-wall" fill="url(#clay-side-light)"/>
        </g>
        <image class="paver-top" href="${sprite(`${kind}-clay`)}" x="-.5" y="-.5" width="1" height="1" preserveAspectRatio="none" transform="${tileTop(center)}" clip-path="url(#clay-top)"/>
      </g>`,
    });
  }
  svg.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`);
  svg.innerHTML = `
    <defs>
      <path id="clay-wall" d="${wall}"/>
      <clipPath id="clay-top" clipPathUnits="objectBoundingBox">
        <path d="M ${clayRadius} 0 H ${1 - clayRadius} Q 1 0 1 ${clayRadius}
          V ${1 - clayRadius} Q 1 1 ${1 - clayRadius} 1 H ${clayRadius}
          Q 0 1 0 ${1 - clayRadius} V ${clayRadius} Q 0 0 ${clayRadius} 0 Z"/>
      </clipPath>
      <linearGradient id="clay-side-light" x2="100%" y2="56%">
        <stop stop-color="#fff2d2" stop-opacity=".3"/>
        <stop offset=".49" stop-color="#fff2d2" stop-opacity=".04"/>
        <stop offset=".52" stop-color="#352122" stop-opacity=".13"/>
        <stop offset="1" stop-color="#352122" stop-opacity=".26"/>
      </linearGradient>
      <image id="scene-art" href="${assets.junior[orientation]}" width="${layout.width}" height="${layout.height}" preserveAspectRatio="none"/>
      ${scenery
        .map(
          ({
            id,
            outline,
          }) => `<polygon id="scenery-outline-${id}" points="${outline}"/>
        <clipPath id="scenery-clip-${id}"><use href="#scenery-outline-${id}"/></clipPath>`,
        )
        .join("")}
      <mask id="scenery-ground" maskContentUnits="objectBoundingBox" mask-type="luminance">
        <rect width="1" height="1" fill="white"/>
        <g transform="scale(${1 / layout.width} ${1 / layout.height})">
          ${scenery
            .map(
              ({ id }) =>
                `<use href="#scenery-outline-${id}" fill="black" stroke="white" stroke-width="2"/>`,
            )
            .join("")}
        </g>
      </mask>
      <mask id="pawn-occlusion" maskUnits="userSpaceOnUse" x="0" y="0" width="${layout.width}" height="${layout.height}" mask-type="alpha">
        ${scenery
          .map(
            ({ id }) =>
              `<use data-mask-depth="${id}" href="#scenery-outline-${id}" visibility="hidden"/>`,
          )
          .join("")}
      </mask>
    </defs>
    <g class="board-depth">
    ${layers
      .sort((a, b) => a.y - b.y)
      .map(({ markup }) => markup)
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
          return `<image id="pawn-pose-${pose}" data-pose="${pose}" href="${sprite(`${gender}-${pose}`)}" x="${-pawnWidth / 2}" y="${y}" width="${pawnWidth}" height="${height}" visibility="hidden"/>`;
        })
        .join("")}
    </g></g>
    <g mask="url(#pawn-occlusion)" aria-hidden="true">
      <use class="pawn-silhouette"/>
    </g>
    ${
      debug
        ? `<g class="path-debug" aria-hidden="true">
      ${debugGrid(layout)}
      ${centers.map(({ x, y }, id) => `<circle cx="${x}" cy="${y}" r="2.5"/><text x="${x}" y="${y - 5}">${id}</text>`).join("")}
    </g>
    <g class="scenery-debug" aria-hidden="true">
      ${scenery
        .map(
          ({
            name,
            x,
            y,
          }) => `<g class="scenery-anchor" transform="translate(${x} ${y})">
        <circle r="4"/><text y="-8">${name}</text>
      </g>`,
        )
        .join("")}
    </g>`
        : ""
    }
  `;
  const pawn = svg.querySelector<SVGGElement>(".board-pawn")!;
  const shadow = pawn.querySelector("ellipse")!;
  const depth = pawn.parentElement!;
  const depthNodes = [...depth.querySelectorAll<SVGGElement>("[data-depth]")];
  const depths = depthNodes.map((layer) => Number(layer.dataset.depth));
  const maskShapes = [
    ...svg.querySelectorAll<SVGUseElement>("[data-mask-depth]"),
  ];
  const silhouette = svg.querySelector<SVGUseElement>(".pawn-silhouette")!;
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
      silhouette.setAttribute("href", `#${image.id}`);
    }
    pawn.setAttribute("transform", `translate(${x} ${y})`);
    const ahead =
      depthNodes[depths.findIndex((layerY) => layerY > y + 0.5)] ?? null;
    if (ahead !== occluder) {
      depth.insertBefore(pawn, ahead);
      occluder = ahead;
      // The same crop shapes mask the ghost, and only objects in front can
      // reveal it. The normal pawn remains in the sorted scene.
      scenery.forEach((object, index) =>
        maskShapes[index].setAttribute(
          "visibility",
          object.y > y + 0.5 ? "visible" : "hidden",
        ),
      );
    }
    silhouette.setAttribute("transform", `translate(${x} ${y})`);
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
    draw(centers[id], pose, facing);
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
      const start = centers[from];
      const end = centers[to];
      const phase = Math.min(1, progress / 0.78);
      const travel = phase * phase * (3 - 2 * phase);
      const dx = end.x - start.x;
      const point = {
        x: start.x + dx * travel,
        y: start.y + (end.y - start.y) * travel,
      };
      const direction = dx === 0 ? facing : dx < 0 ? 1 : -1;
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
