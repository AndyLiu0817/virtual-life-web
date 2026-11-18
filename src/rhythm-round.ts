import type { ContestScore } from "./game/contests";
import { closeMinigame, playMinigameRound } from "./minigame-view";

export { rhythmArt } from "./minigame-art";

export async function playRhythmRound(
  dialog: HTMLDialogElement,
): Promise<ContestScore> {
  const result = await playMinigameRound(dialog, "rhythm", "衝刺擂台");
  await closeMinigame(dialog);
  return { score: result.score };
}
