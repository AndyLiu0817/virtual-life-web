import { paverClearance } from "./board-clearance";
import { debugGrid, measureTrack, tileArtSize } from "./board-track";
import type { BoardLayout, Orientation } from "./data/board-layout";
import type { SchoolBoard } from "./data/school-board";
import { tileLabels, type TileKind } from "./data/junior";

const sprites = import.meta.glob<string>(
  "./board-art/{*-clay,boy-{stand,win},girl-{stand,win},walk-junior/*,high/*,high/walk/*,university/*,university/walk/*}.webp",
  {
    eager: true,
    query: "?url",
    import: "default",
  },
);
const sprite = (name: string) => sprites[`./board-art/${name}.webp`];

const walkFrames = 8;
const walkSets = ["front", "back"] as const;
type WalkSet = (typeof walkSets)[number];
type Pose = "stand" | "win" | `${WalkSet}-${number}`;
const claySides = {
  start: "#af8727",
  event: "#3293a1",
  story: "#d9893b",
  game: "#55947b",
  club: "#3293a1",
  quiz: "#af8727",
  contest: "#af5e2e",
  love: "#af5857",
  shop: "#7a4e8e",
  fork: "#a59e97",
} satisfies Record<TileKind, string>;

export async function preloadSchool(
  board: SchoolBoard,
  gender: "boy" | "girl",
  progress: (done: number, total: number) => void,
  intro?: string,
) {
  const keys = [
    `${board.pawnFolder}${gender}-stand`,
    `${board.pawnFolder}${gender}-win`,
    ...walkSets.flatMap((set) =>
      Array.from(
        { length: walkFrames },
        (_, i) => `${board.walkFolder}${gender}-${set}-${i + 1}`,
      ),
    ),
  ];
  const urls = [
    ...Object.values(board.maps),
    ...keys.map(sprite),
    ...(intro ? [intro] : []),
  ];
  let done = 0;
  progress(done, urls.length);
  const results = await Promise.allSettled(
    urls.map(async (url) => {
      const image = new Image();
      image.src = url;
      await image.decode();
      progress(++done, urls.length);
    }),
  );
  if (results.some(({ status }) => status === "rejected"))
    throw new Error("部分素材載入失敗。");
}

export function boardView(
  svg: SVGSVGElement,
  layout: BoardLayout,
  orientation: Orientation,
  board: SchoolBoard,
  gender: "boy" | "girl",
  debug: boolean,
  mapArt: string,
  follow: (point: { x: number; y: number }) => void,
) {
  const {
    centers,
    body,
    footprint,
    depth: thickness,
    faceWidth,
    faceHeight,
    tileTop,
  } = measureTrack(layout);
  const pawnWidth = (layout.pawnHeight * 116) / 197;
  const walkHeight = layout.pawnHeight * 1.08;
  const walkWidth = (walkHeight * 104) / 192;
  const pawnLabel = gender === "boy" ? "男主角棋子" : "女主角棋子";
  const { tiles } = board;
  const objects =
    mapArt === board.maps[orientation] ? board.scenery[orientation] : [];
  const scenery = objects.map((object, id) => {
    const [x, y] = object.anchor;
    return { ...object, id, x, y };
  });
  const layers = scenery.map(({ id, name, y }) => ({
    y,
    markup: `<g class="board-scenery" data-scenery="${id}" data-name="${name}" data-depth="${y}" aria-hidden="true">
      <use href="#scene-art" clip-path="url(#scenery-clip-${id})"/>
    </g>`,
  }));
  // Rounded corners are baked into the faces, avoiding a per-image SVG clip.
  for (const [id, center] of centers.entries()) {
    const { kind } = tiles[id];
    layers.push({
      y: center.y,
      markup: `<g class="board-tile" data-depth="${center.y}" data-kind="${kind}" data-tile="${id}" role="img" aria-label="${tileLabels[kind]}">
        <g transform="translate(${center.x} ${center.y})">
          <use href="#clay-footprint" class="paver-shadow" transform="translate(0 ${thickness})"/>
          <use href="#clay-body" fill="${claySides[kind]}"/>
          <use href="#clay-body" fill="url(#clay-side-light)"/>
        </g>
        <image class="paver-top" href="${sprite(`${kind}-clay`)}" x="${-tileArtSize / 2}" y="${-tileArtSize / 2}" width="${tileArtSize}" height="${tileArtSize}" preserveAspectRatio="none" transform="${tileTop(center)}"/>
      </g>`,
    });
  }
  svg.setAttribute("viewBox", `0 0 ${layout.width} ${layout.height}`);
  svg.innerHTML = `
    <defs>
      <path id="clay-body" d="${body}"/>
      <path id="clay-footprint" d="${footprint}"/>
      <linearGradient id="clay-side-light" x2="100%" y2="56%">
        <stop stop-color="#fff2d2" stop-opacity=".12"/>
        <stop offset=".49" stop-color="#fff2d2" stop-opacity=".04"/>
        <stop offset=".52" stop-color="#352122" stop-opacity=".07"/>
        <stop offset="1" stop-color="#352122" stop-opacity=".15"/>
      </linearGradient>
      <image id="scene-art" href="${mapArt}" width="${layout.width}" height="${layout.height}" preserveAspectRatio="none"/>
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
      <filter id="pawn-silhouette-ink" color-interpolation-filters="sRGB" x="-15%" y="-15%" width="130%" height="130%">
        <feGaussianBlur in="SourceAlpha" stdDeviation=".36" result="soft-alpha"/>
        <feFlood flood-color="#d3f4fa" flood-opacity=".46" result="ink"/>
        <feComposite in="ink" in2="soft-alpha" operator="in"/>
      </filter>
      <mask id="pawn-visible" maskUnits="userSpaceOnUse" x="0" y="0" width="${layout.width}" height="${layout.height}">
        <rect width="${layout.width}" height="${layout.height}" fill="white"/>
        ${scenery
          .map(
            ({ id }) =>
              `<use data-pawn-cover="${id}" href="#scenery-outline-${id}" fill="black" visibility="hidden"/>`,
          )
          .join("")}
      </mask>
      <clipPath id="pawn-occlusion" clipPathUnits="userSpaceOnUse">
        ${scenery
          .map(
            ({ id }) =>
              `<use data-mask-depth="${id}" href="#scenery-outline-${id}" visibility="hidden"/>`,
          )
          .join("")}
      </clipPath>
    </defs>
    <g class="board-depth">
    ${layers
      .sort((a, b) => a.y - b.y)
      .map(({ markup }) => markup)
      .join("")}
    </g>
    <g mask="url(#pawn-visible)">
    <g class="board-pawn" role="img">
      <ellipse class="pawn-shadow" rx="${pawnWidth * 0.37}" ry="${pawnWidth * 0.12}" opacity=".65"/>
      ${(["stand", "win"] as const)
        .map((pose) => {
          const height =
            board.stage === "junior" && pose === "win" && gender === "boy"
              ? (layout.pawnHeight * 167) / 197
              : layout.pawnHeight;
          const sole = gender === "girl" ? 188 : pose === "win" ? 167 : 192;
          const y =
            board.stage === "junior"
              ? -(layout.pawnHeight * sole) / 197
              : -height;
          return `<image id="pawn-pose-${pose}" data-pose="${pose}" href="${sprite(`${board.pawnFolder}${gender}-${pose}`)}" x="${-pawnWidth / 2}" y="${y}" width="${pawnWidth}" height="${height}" visibility="hidden"/>`;
        })
        .join("")}
      ${walkSets
        .flatMap((set) =>
          Array.from({ length: walkFrames }, (_, index) => {
            const pose = `${set}-${index + 1}`;
            return `<image id="pawn-pose-${pose}" data-pose="${pose}" href="${sprite(`${board.walkFolder}${gender}-${pose}`)}" x="${-walkWidth / 2}" y="${-walkHeight}" width="${walkWidth}" height="${walkHeight}" visibility="hidden"/>`;
          }),
        )
        .join("")}
    </g></g>
    <g clip-path="url(#pawn-occlusion)" aria-hidden="true">
      <use class="pawn-silhouette" filter="url(#pawn-silhouette-ink)"/>
    </g>
    ${
      debug
        ? `<g class="path-debug" aria-hidden="true">
      ${debugGrid(layout)}
      ${layout.road?.outlines.map((polygon) => `<polygon class="road-outline" points="${polygon.join(" ")}"/>`).join("") ?? ""}
      ${layout.road?.obstacles?.map((polygon) => `<polygon class="scenery-outline" points="${polygon.join(" ")}"/>`).join("") ?? ""}
      ${paverClearance(layout)
        .map(
          ({ id, polygon, onRoad, hitsScenery }) =>
            `<polygon class="paver-clearance" data-clearance-tile="${id}" data-overlap="${hitsScenery}" data-on-road="${onRoad}" points="${polygon.join(" ")}"><title>${id}・${hitsScenery ? "方磚壓到景物" : onRoad ? "中心位於跑道內" : "中心在跑道外"}</title></polygon>`,
        )
        .join("")}
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
  const sceneryCovers = scenery.map(({ id, y }) => ({
    y,
    cover: svg.querySelector<SVGUseElement>(`[data-pawn-cover="${id}"]`)!,
    silhouetteClip: svg.querySelector<SVGUseElement>(
      `[data-mask-depth="${id}"]`,
    )!,
  }));
  const silhouette = svg.querySelector<SVGUseElement>(".pawn-silhouette")!;
  let previousY: number | undefined;
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
  ) {
    const image = poses[pose];
    if (visible !== image) {
      visible?.setAttribute("visibility", "hidden");
      image.setAttribute("visibility", "visible");
      visible = image;
      silhouette.setAttribute("href", `#${image.id}`);
    }
    pawn.setAttribute("transform", `translate(${x} ${y})`);
    // The pawn paints over the board. Only scenery in front can mask it.
    for (const { y: depth, cover, silhouetteClip } of sceneryCovers) {
      const inFront = depth > y + 0.5;
      if (previousY !== undefined && inFront === depth > previousY + 0.5)
        continue;
      const visibility = inFront ? "visible" : "hidden";
      cover.setAttribute("visibility", visibility);
      silhouetteClip.setAttribute("visibility", visibility);
    }
    previousY = y;
    silhouette.setAttribute("transform", `translate(${x} ${y})`);
    follow({ x: x / layout.width, y: y / layout.height });
    const flip = `scale(${facing} 1)`;
    if (image.getAttribute("transform") !== flip)
      image.setAttribute("transform", flip);
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
    routePlacement(from: number, to: number) {
      const start = centers[from];
      const end = centers[to];
      return {
        x: (100 * end.x) / layout.width,
        y: (100 * end.y) / layout.height,
        angle: (Math.atan2(end.y - start.y, end.x - start.x) * 180) / Math.PI,
        faceWidth: (100 * faceWidth) / layout.width,
        lift: (50 * faceHeight) / layout.width,
      };
    },
    step(from: number, to: number, progress: number) {
      const start = centers[from];
      const end = centers[to];
      const dx = end.x - start.x;
      const dy = end.y - start.y;
      const set: WalkSet = dy > 0 ? "front" : "back";
      const mirrored = set === "front" ? dx < 0 : dx > 0;
      const frame = Math.min(walkFrames, Math.floor(progress * walkFrames) + 1);
      draw(
        { x: start.x + dx * progress, y: start.y + dy * progress },
        `${set}-${frame}`,
        mirrored ? -1 : 1,
      );
      // The existing idle and victory art faces left in its source image.
      return dx < 0 ? 1 : -1;
    },
  };
}
