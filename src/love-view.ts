import { openAudioDialog, playEffect } from "./audio";
import confessionBg from "../art/cg_confession_bg_final.jpg";
import { currentPartner } from "./data/love-partners";
import { sceneArt } from "./event-view";
import {
  breakUp,
  canDate,
  confess,
  drawDate,
  loveChoices,
  meetPartner,
  settleDate,
} from "./game/love";
import type { Save } from "./game/saves";
import { loveCutout, portraitUrl, type Expression } from "./love-art";
import "./love-view.css";

const locations = ["cafe", "riverside", "festival", "library"];
function button(label: string, value = "continue") {
  return `<button type="button" value="${value}">${label}</button>`;
}

type Screen = {
  title: string;
  label: string;
  text?: string;
  result?: string;
  art?: string;
  actions: string;
};

export async function playLoveTile(
  dialog: HTMLDialogElement,
  initial: Save,
): Promise<Save> {
  if (initial.stage !== "university") return initial;
  const scene = locations[initial.completedDates % locations.length];
  const partner = currentPartner(initial.partner);

  function screen({ title, label, text, result, art, actions }: Screen) {
    dialog.innerHTML = `<div class="love-card ${art ? "love-scene" : ""}">
      ${art ? `<div class="love-art">${art}</div>` : ""}
      <section class="love-copy">
        <p class="love-label">${label}</p>
        <h2 id="love-title" tabindex="-1">${title}</h2>
        ${text ? `<p class="love-dialogue">${text}</p>` : ""}
        ${result ? `<p class="love-result">${result}</p>` : ""}
        <div class="love-actions">${actions}</div>
      </section>
    </div>`;
    if (!dialog.open) openAudioDialog(dialog, "dialog_open", "story");
    dialog
      .querySelector<HTMLElement>("#love-title")!
      .focus({ preventScroll: true });
    dialog.scrollTop = 0;
    return new Promise<string>((resolve) => {
      dialog.onclick = (event) => {
        const choice = (event.target as HTMLElement).closest("button");
        if (!choice || choice.disabled) return;
        dialog.onclick = null;
        resolve(choice.value);
      };
    });
  }

  function dateArt(expression: Expression) {
    return `${sceneArt(scene)}<img class="love-expression" src="${portraitUrl(partner!.id, expression)}" alt="">`;
  }

  dialog.oncancel = (event) => event.preventDefault();
  try {
    if (!partner) {
      const choice = await screen({
        title: "想認識誰？",
        label: "大學・愛情格",
        text: `魅力 ${initial.stats.charm} ・ 現金 ${initial.cash.toLocaleString("zh-TW")} 元`,
        actions: `<div class="love-candidates">${loveChoices(initial)
          .map(
            (candidate) => `
            <button type="button" value="${candidate.id}" class="love-candidate" ${candidate.locked || !candidate.affordable ? "disabled" : ""}>
              <span class="love-candidate-art">
                <img src="${portraitUrl(candidate.id)}" alt="">
              </span>
              <span class="love-candidate-info">
                <strong>${candidate.name}</strong><span>${candidate.tier} ・ 魅力 ${candidate.charm}</span>
                <small>${candidate.fee.toLocaleString("zh-TW")} 元${candidate.locked ? " ・ 魅力不足" : candidate.affordable ? "" : " ・ 現金不足"}</small>
              </span>
            </button>
          `,
          )
          .join("")}</div>${button("先不要", "skip")}`,
      });
      const updated = meetPartner(initial, choice);
      const met = currentPartner(updated.partner);
      if (!met || updated === initial) return initial;
      await screen({
        title: met.name,
        label: "初次見面",
        text: met.lines.intro,
        result: `認識費 −${met.fee.toLocaleString("zh-TW")} 元`,
        art: `${sceneArt(scene)}<img class="love-expression" src="${portraitUrl(met.id)}" alt="">`,
        actions: button("確定"),
      });
      return updated;
    }

    const choice = await screen({
      title: partner.name,
      label: initial.dating ? "交往中" : "已認識",
      result: `愛情度 ${initial.affection} ／ ${initial.dating ? 99 : 60}`,
      art: dateArt("neutral"),
      actions:
        button("約會", "date") +
        button("分手", "breakup") +
        button("先不要", "skip"),
    });
    if (choice === "skip") return initial;
    if (choice === "breakup") {
      const confirm = await screen({
        title: `要和${partner.name}分手嗎？`,
        label: "分手",
        text: "分手後愛情度會歸零。",
        art: dateArt("sad"),
        actions: button("取消", "skip") + button("確認分手", "breakup"),
      });
      return confirm === "breakup" ? breakUp(initial) : initial;
    }

    // A saved score of 60 can also resume a confession from an imported game.
    if (initial.dating || initial.affection !== 60) {
      if (!canDate(initial)) {
        playEffect("event_bad");
        await screen({
          title: partner.name,
          label: "改天再約",
          text: partner.lines.decline,
          result: `愛情度 ${initial.affection} ・ 魅力門檻 ${partner.charm}`,
          art: dateArt("sad"),
          actions: button("確定"),
        });
        return initial;
      }

      await screen({
        title: `和${partner.name}約會`,
        label: "校園約會",
        text: partner.lines.date,
        art: dateArt("neutral"),
        actions: button("開始聊天"),
      });

      const questions = drawDate(initial);
      let correct = 0;
      for (const [index, question] of questions.entries()) {
        const order = [0, 1, 2];
        for (let last = order.length - 1; last > 0; last--) {
          const other = Math.floor(Math.random() * (last + 1));
          [order[last], order[other]] = [order[other], order[last]];
        }
        const answer = await screen({
          title: question.text,
          label: `第 ${index + 1} 題 ／ 3 ・ ${question.topic}`,
          art: dateArt("neutral"),
          actions: order
            .map((option) => button(question.choices[option], String(option)))
            .join(""),
        });
        const right = answer === "0";
        correct += Number(right);
        playEffect(right ? "answer_right" : "answer_wrong");
        await screen({
          title: right ? "答對了！" : "答錯了",
          label: partner.name,
          text: right ? partner.lines.right : partner.lines.wrong,
          result: right ? undefined : `正確答案是「${question.choices[0]}」。`,
          art: dateArt(right ? "happy" : "annoyed"),
          actions: button(index < 2 ? "下一題" : "查看結果"),
        });
      }
      const { save, gained } = settleDate(
        initial,
        correct,
        questions.map(({ id }) => id),
      );
      initial = save;
      if (gained) playEffect("gain");
      await screen({
        title: "約會結算",
        label: partner.name,
        text: `答對 ${correct} ／ 3 題`,
        result: `愛情度 ＋${gained} ・ 目前 ${initial.affection} ／ ${initial.dating ? 99 : 60}`,
        art: dateArt(correct >= 2 ? "happy" : "shy"),
        actions: button(
          !initial.dating && initial.affection === 60 ? "告白" : "確定",
        ),
      });
    }

    const outcome = confess(initial);
    if (!outcome) return initial;
    playEffect(outcome.success ? "event_good" : "loss");
    await screen({
      title: outcome.success ? "告白成功" : "告白失敗",
      label: `向${partner.name}告白`,
      text: outcome.success ? partner.lines.success : partner.lines.failure,
      result: outcome.success
        ? "正式交往 ・ 愛情度 60 ／ 99"
        : "愛情度 −10 ・ 目前 50 ／ 60",
      art: `<img class="love-confession-bg" src="${confessionBg}" alt="">
        <div class="love-couple">
          <img src="${loveCutout(`hero-${initial.gender}`)}" alt="主角">
          <img src="${loveCutout(partner.id)}" alt="${partner.name}">
        </div>`,
      actions: button("確定"),
    });
    return outcome.save;
  } finally {
    dialog.onclick = null;
    dialog.oncancel = null;
    dialog.close();
  }
}
