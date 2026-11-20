export function roundFeedback(
  field: HTMLElement,
  text: string,
  at: Pick<MouseEvent, "clientX" | "clientY">,
  flash = true,
) {
  const play = field.closest<HTMLElement>(".mg-play")!;
  const bounds = play.getBoundingClientRect();
  const message = document.createElement("span");
  message.className = "mg-mistake-message";
  message.setAttribute("aria-hidden", "true");
  message.textContent = text;
  message.style.left = `${Math.max(44, Math.min(bounds.width - 44, at.clientX - bounds.left))}px`;
  message.style.top = `${Math.max(30, at.clientY - bounds.top)}px`;
  play.append(message);
  window.setTimeout(() => message.remove(), 480);

  if (flash) {
    play.querySelector(".mg-mistake-flash")?.remove();
    const overlay = document.createElement("span");
    overlay.className = "mg-mistake-flash";
    play.append(overlay);
    window.setTimeout(() => overlay.remove(), 200);
  }
}
