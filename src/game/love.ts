import { currentPartner, partnerIds, partners } from "../data/love-partners";
import { loveQuestions } from "../data/love-questions";
import type { Save } from "./saves";

export function canDate(save: Readonly<Save>) {
  const partner = currentPartner(save.partner);
  return (
    save.stage === "university" &&
    !!partner &&
    save.stats.charm >= partner.charm
  );
}

export function loveChoices(save: Readonly<Save>) {
  return partnerIds
    .filter((id) => partners[id].gender !== save.gender)
    .map((id) => {
      const partner = partners[id];
      return {
        id,
        ...partner,
        locked: save.stats.charm < partner.charm,
        affordable: save.cash >= partner.fee,
      };
    });
}

export function meetPartner(save: Save, id: string): Save {
  const choice = loveChoices(save).find((choice) => choice.id === id);
  if (
    save.stage !== "university" ||
    currentPartner(save.partner) ||
    !choice ||
    choice.locked ||
    !choice.affordable
  )
    return save;
  return {
    ...save,
    cash: save.cash - choice.fee,
    partner: choice.id,
    dating: false,
    affection: 0,
    metPartners: [...new Set([...save.metPartners, choice.id])],
    lastDateQuestions: [],
  };
}

export function drawDate(save: Readonly<Save>, random = Math.random) {
  const partner = currentPartner(save.partner);
  if (!partner || !canDate(save)) return [];
  const fresh = loveQuestions[partner.id].filter(
    ({ id }) => !save.lastDateQuestions.includes(id),
  );
  const pool = fresh.length >= 3 ? fresh : [...loveQuestions[partner.id]];
  return Array.from(
    { length: 3 },
    () => pool.splice(Math.floor(random() * pool.length), 1)[0],
  );
}

export function settleDate(save: Save, correct: number, questionIds: string[]) {
  if (!canDate(save)) return { save, gained: 0 };
  const affection = Math.min(
    save.dating ? 99 : 60,
    save.affection + ([3, 8, 15, 25][correct] ?? 0),
  );
  return {
    save: {
      ...save,
      affection,
      completedDates: save.completedDates + 1,
      lastDateQuestions: questionIds,
    },
    gained: affection - save.affection,
  };
}

export function confess(save: Save) {
  if (
    save.stage !== "university" ||
    !currentPartner(save.partner) ||
    save.dating ||
    save.affection !== 60
  )
    return null;
  const success = canDate(save);
  return {
    success,
    save: { ...save, dating: success, affection: success ? 60 : 50 },
  };
}

export function breakUp(save: Save): Save {
  if (save.stage !== "university" || !save.partner) return save;
  return {
    ...save,
    partner: null,
    dating: false,
    affection: 0,
    lastDateQuestions: [],
  };
}
