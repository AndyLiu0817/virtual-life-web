import type { Board } from "../data/junior";
import type { Save } from "./saves";

export const diceCount = (save: Save) => (save.retrogradeTurns > 0 ? 1 : 2);
export const rollDice = (count: number, random = Math.random) =>
  Array.from({ length: count }, () => 1 + Math.floor(random() * 6));

export function beforeRoll(save: Save, random = Math.random) {
  if (random() >= 0.05) return { save, notice: "" };
  if (save.retrogradeTurns > 0) {
    return {
      save: { ...save, retrogradeRepeated: true },
      notice: "逆行期間再次抽中。逆行結束後將獲得否極泰來。",
    };
  }
  return {
    save: { ...save, retrogradeTurns: 3 },
    notice: "水星逆行！從這回合起，連續 3 回合只擲 1 顆骰子。",
  };
}

export function finishTurn(save: Save) {
  const retrogradeTurns = Math.max(0, save.retrogradeTurns - 1);
  const turnaroundStarted =
    save.retrogradeTurns === 1 && save.retrogradeRepeated;
  return {
    save: {
      ...save,
      turn: save.turn + 1,
      updatedAt: new Date().toISOString(),
      retrogradeTurns,
      retrogradeRepeated: retrogradeTurns > 0 && save.retrogradeRepeated,
      turnaroundTurns: turnaroundStarted
        ? 3
        : Math.max(0, save.turnaroundTurns - 1),
    },
    turnaroundStarted,
  };
}

export const stageFinished = (board: Board, save: Save) =>
  save.turn >= board.turns;

export function directions(board: Board, save: Save) {
  return board.tiles[save.boardTile].next.filter(
    (id) => id !== save.previousTile,
  );
}

export function walkStep(board: Board, save: Save, steps: number) {
  const tile = save.nextTile ?? directions(board, save)[0];
  const reward = tile === board.start ? (steps === 1 ? 1000 : 200) : 0;
  return {
    save: {
      ...save,
      boardTile: tile,
      previousTile: save.boardTile,
      nextTile: null,
      cash: save.cash + reward,
    },
    steps: steps - 1,
    reward,
  };
}
