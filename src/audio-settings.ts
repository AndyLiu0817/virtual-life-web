import {
  openAudioDialog,
  readAudioSettings,
  updateAudioSettings,
} from "./audio";
import "./audio-settings.css";

export function openAudioSettings() {
  const dialog = document.createElement("dialog");
  dialog.className = "panel audio-settings";
  dialog.setAttribute("aria-labelledby", "audio-heading");
  dialog.innerHTML = `<form method="dialog">
    <h2 id="audio-heading">音訊設定</h2>
    ${(["bgm", "sfx"] as const)
      .map(
        (channel) => `<fieldset>
      <legend>${channel === "bgm" ? "背景音樂" : "音效"}</legend>
      <label class="audio-volume"><span>音量</span>
        <input name="${channel}Volume" type="range" min="0" max="1" step="0.01">
        <output></output>
      </label>
      <label class="audio-mute"><input name="${channel}Muted" type="checkbox">靜音</label>
    </fieldset>`,
      )
      .join("")}
    <button class="action" autofocus>關閉</button>
  </form>`;
  const settings = readAudioSettings();
  for (const channel of ["bgm", "sfx"] as const) {
    const volumeKey = `${channel}Volume` as const;
    const muteKey = `${channel}Muted` as const;
    const slider = dialog.querySelector<HTMLInputElement>(
      `[name="${volumeKey}"]`,
    )!;
    const mute = dialog.querySelector<HTMLInputElement>(`[name="${muteKey}"]`)!;
    const output = slider.parentElement!.querySelector("output")!;
    const paint = () => {
      output.value = `${Math.round(slider.valueAsNumber * 100)}%`;
    };
    slider.valueAsNumber = settings[volumeKey];
    mute.checked = settings[muteKey];
    paint();
    slider.oninput = () => {
      settings[volumeKey] = slider.valueAsNumber;
      paint();
      updateAudioSettings(settings);
    };
    mute.onchange = () => {
      settings[muteKey] = mute.checked;
      updateAudioSettings(settings);
    };
  }
  document.body.append(dialog);
  openAudioDialog(dialog);
  dialog.addEventListener("close", () => dialog.remove(), { once: true });
}
