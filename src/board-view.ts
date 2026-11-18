import { assets } from "./assets";
import { measureTrack } from "./board-track";
import type { BoardLayout, Orientation } from "./data/board-layout";
import { juniorScenery } from "./data/junior-scenery";
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
  orientation: Orientation,
  tiles: readonly { kind: TileKind }[],
  gender: "boy" | "girl",
  debug: boolean,
  follow: (point: { x: number; y: number }) => void,
) {
  const { centers, pavers, edges } = measureTrack(layout);
  const pawnWidth = (layout.pawnHeight * 116) / 197;
  const pawnLabel = gender === "boy" ? "男主角棋子" : "女主角棋子";
  const scenery = juniorScenery[orientation].map((object, id) => {
    const [sourceX, sourceY] = object.anchor;
    const [x, y, scale] = object.placement ?? [sourceX, sourceY, 1];
    const transform = `translate(${x} ${y}) scale(${scale}) translate(${-sourceX} ${-sourceY})`;
    return { ...object, id, x, y, transform };
  });
  const layers = scenery.map(
    ({ id, name, y, transform, source, placement }) => ({
      y,
      markup: `<g class="board-scenery" data-scenery="${id}" data-name="${name}" data-depth="${y}" aria-hidden="true">
      ${placement ? `<ellipse class="scenery-shadow" cx="${placement[0]}" cy="${y}" rx="24" ry="7"/>` : ""}
      <g transform="${transform}" clip-path="url(#scenery-clip-${id})">
        <use href="#scene-art-${source}"/>
      </g>
    </g>`,
    }),
  );
  for (const [id, center] of centers) {
    const { kind } = tiles[id];
    const { face, print, iconSize } = pavers.get(id)!;
    layers.push({
      y: center.y,
      markup: `<g class="board-tile" data-depth="${center.y}" data-kind="${kind}" data-tile="${id}" role="img" aria-label="${tileLabels[kind]}">
        <path class="paver-shadow" d="${face}" transform="translate(0 4)"/>
        <path class="paver-side" d="${face}" fill="${paint[kind]}" transform="translate(0 2.6)"/>
        <path class="paver-top" d="${face}" fill="${paint[kind]}"/>
        <path d="${face}" fill="url(#paver-light)"/>
        <image href="${sprite(`${kind}-print`)}" x="${-iconSize / 2}" y="${-iconSize / 2}" width="${iconSize}" height="${iconSize}" transform="${print}"/>
      </g>`,
    });
  }
  svg.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`);
  svg.innerHTML = `
    <defs>
      <linearGradient id="paver-light" x2="0%" y2="100%">
        <stop stop-color="white" stop-opacity=".34"/>
        <stop offset="1" stop-color="white" stop-opacity="0"/>
      </linearGradient>
      <image id="scene-art-landscape" href="${assets.junior.landscape}" width="780" height="439" preserveAspectRatio="none"/>
      <image id="scene-art-portrait" href="${assets.junior.portrait}" width="439" height="780" preserveAspectRatio="none"/>
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
            .filter((object) => !object.placement)
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
            ({ id, transform }) =>
              `<use data-mask-depth="${id}" href="#scenery-outline-${id}" transform="${transform}" visibility="hidden"/>`,
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
      ${layout.tracks.map(({ path }) => `<path d="${path}"/>`).join("")}
      ${[...centers].map(([id, { x, y }]) => `<circle cx="${x}" cy="${y}" r="2.5"/><text x="${x}" y="${y - 5}">${id}</text>`).join("")}
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
