import examResult from "../art/cg_exam_result_final.jpg";
import { sceneArt } from "./event-view";
import {
  type Attempt,
  passScore,
  questionsById,
  remainingAssists,
  useAssist,
} from "./game/questions";
import "./exam-view.css";

export function showAssessment(
  container: HTMLElement,
  attempt: Attempt,
  intellect: number,
  onProgress: (() => void) | undefined,
  onComplete: () => void,
) {
  const quiz = attempt.kind === "quiz";
  const title = quiz
    ? "小考"
    : attempt.kind === "highEntrance"
      ? "升高中考試"
      : "大學聯考";
  container.innerHTML = `<section class="assessment" aria-label="${title}">
    <div class="assessment-art" data-tone="scene">${quiz ? sceneArt("classroom", "teacher") : sceneArt("exam", "proctor")}</div>
    <div class="assessment-copy">
      <header><h1 id="assessment-title">${title}</h1><p class="assessment-meta"></p></header>
      <h2 class="assessment-question" tabindex="-1"></h2>
      <div class="assessment-options"></div>
      ${quiz ? "" : `<div class="assessment-help"><p role="status"></p><button class="action" type="button">智力輔助</button></div>`}
      <p class="assessment-save" role="status" hidden></p>
    </div>
  </section>`;
  const meta = container.querySelector<HTMLElement>(".assessment-meta")!;
  const heading = container.querySelector<HTMLElement>(".assessment-question")!;
  const options = container.querySelector<HTMLElement>(".assessment-options")!;
  const help = container.querySelector<HTMLButtonElement>(
    ".assessment-help button",
  );
  const assistStatus =
    container.querySelector<HTMLElement>(".assessment-help p");
  function render() {
    const index = attempt.items.findIndex(({ answer }) => answer === null);
    const item = attempt.items[index];
    const question = questionsById.get(item.id)!;
    meta.textContent = `第 ${index + 1} ／ ${attempt.items.length} 題・${question.category}`;
    heading.textContent = question.prompt;
    options.replaceChildren(
      ...question.options.map(({ text }, optionIndex) => {
        const choice = document.createElement("button");
        choice.type = "button";
        choice.className = "assessment-option";
        choice.disabled = item.removed === optionIndex;
        choice.textContent = `${"ABCD"[optionIndex]}  ${choice.disabled ? "已排除" : text}`;
        choice.onclick = () => {
          item.answer = optionIndex;
          if (index === attempt.items.length - 1) onComplete();
          else {
            render();
            heading.focus();
            onProgress?.();
          }
        };
        return choice;
      }),
    );
    if (help && assistStatus) {
      const remaining = remainingAssists(attempt, intellect);
      help.disabled = !remaining || item.removed !== null;
      assistStatus.textContent = `剩餘 ${remaining} 次${item.removed === null ? "" : "・本題已排除一個選項"}`;
    }
  }
  if (help)
    help.onclick = () => {
      useAssist(attempt, intellect);
      render();
      heading.focus();
      onProgress?.();
    };
  render();
  heading.focus();
}

export function resultScene(title: string, details: string, passed: boolean) {
  return `<main class="stage assessment-result">
    ${passed ? `<img class="event-background" src="${examResult}" alt="">` : sceneArt("gate_dusk")}
    <section class="assessment-card"><h1 tabindex="-1">${title}</h1>${details}<p id="notice" role="status"></p></section>
  </main>`;
}

export const scoreText = (correct: number) =>
  `答對 ${correct} ／ 10 題・錄取門檻 ${passScore} 題`;
