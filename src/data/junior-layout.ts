import type { BoardLayout, Orientation } from "./board-layout";

// Coordinates are in the illustration's viewBox. The glowing edges enclose
// the centerline. The shortcut joins the same two anchors as the outer loop.
export const juniorLayouts: Record<Orientation, BoardLayout> = {
  landscape: {
    width: 780,
    height: 439,
    pawnHeight: 52,
    tracks: [
      {
        tiles: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
        path: "M 399 267 C 434 249 412 219 441 193 C 469 168 507 155 555 175 C 597 192 640 206 675 235 C 717 272 700 326 672 355 C 632 405 557 408 501 383 C 455 364 432 336 398 333",
        width: 47,
      },
      {
        tiles: [14, 15, 16, 0, 1, 2, 3, 4],
        path: "M 398 333 C 350 328 303 366 254 376 C 195 392 126 395 87 363 C 48 330 82 278 124 259 C 169 238 224 220 278 242 C 319 258 362 280 399 267",
        width: 48,
      },
      {
        tiles: [4, 17, 14],
        path: "M 399 267 C 402 285 396 315 398 333",
        width: 25,
        maxPaverLength: 22,
      },
    ],
  },
  portrait: {
    width: 439,
    height: 780,
    pawnHeight: 49,
    tracks: [
      {
        tiles: [4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
        path: "M 78 431 C 84 376 78 321 97 278 C 114 244 155 230 204 230 L 264 231 C 315 231 352 255 360 294 C 366 324 369 385 374 431",
        width: 38,
      },
      {
        tiles: [14, 15, 16, 0, 1, 2, 3, 4],
        path: "M 374 431 C 378 467 385 514 384 550 C 382 604 341 632 290 635 C 248 637 190 637 147 633 C 96 627 67 588 68 541 C 69 508 72 468 78 431",
        width: 49,
        offsets: { 0: 0.52 },
      },
      {
        tiles: [4, 17, 14],
        path: "M 78 431 C 170 430 280 430 374 431",
        width: 33,
        maxPaverLength: 43,
      },
    ],
  },
};
