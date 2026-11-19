import "./board-dice-flight.css";

const rollMs = 1000;
const holdMs = 500;
const pips = [
  [5],
  [1, 9],
  [1, 5, 9],
  [1, 3, 7, 9],
  [1, 3, 5, 7, 9],
  [1, 3, 4, 6, 7, 9],
];
const faceTurns = [
  "rotateY(0deg)",
  "rotateY(90deg)",
  "rotateX(90deg)",
  "rotateX(-90deg)",
  "rotateY(-90deg)",
  "rotateY(180deg)",
];
const faces = pips
  .map(
    (positions, index) => `
  <span class="flight-face" style="--face-turn: ${faceTurns[index]}">
    ${positions.map((position) => `<i style="grid-area:${Math.ceil(position / 3)}/${((position - 1) % 3) + 1}"></i>`).join("")}
  </span>`,
  )
  .join("");

const wait = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

export async function playDiceFlight(
  stage: HTMLElement,
  board: HTMLElement,
  button: HTMLButtonElement,
  values: readonly number[],
) {
  const origin = button.getBoundingClientRect();
  const map = board.getBoundingClientRect();
  const x = origin.x + origin.width / 2;
  const y = origin.y + origin.height / 2;
  const flight = document.createElement("div");
  flight.className = "board-dice-flight";
  flight.dataset.phase = "rolling";
  flight.setAttribute("aria-hidden", "true");
  flight.style.setProperty("--roll-ms", `${rollMs}ms`);

  flight.innerHTML = values
    .map((value, index) => {
      const spread = (index - (values.length - 1) / 2) * 68;
      const left = map.x + map.width * 0.5 + spread;
      const top = map.y + map.height * 0.53 + Math.abs(spread) * 0.2;
      const front = faceTurns[value - 1].replace(
        /(-?\d+)deg/,
        (_, degrees) => `${-Number(degrees)}deg`,
      );
      return `<div class="flight-die" data-face="${value}" style="left:${left}px;top:${top}px;--from-x:${x - left}px;--from-y:${y - top}px;--front:${front}">
      <span class="flight-shadow"></span>
      <div class="flight-path"><div class="flight-tumble"><div class="flight-cube">${faces}</div></div></div>
    </div>`;
    })
    .join("");

  stage.append(flight);
  try {
    await wait(rollMs);
    flight.dataset.phase = "settled";
    await wait(holdMs);
  } finally {
    flight.remove();
  }
}
