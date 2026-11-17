import {
  RULES as R,
  STAT_KEYS,
  ZODIACS,
  BLOODS,
  CLUBS,
  GODS,
  PARTNERS,
  MAPS,
  FORK_ROUTES,
  MINI_GAMES,
} from "../data/config";
import { QUESTIONS } from "../data/questions";
import { STORY as S, STAT_NAMES, TEXT } from "../data/text";
import type { GameState, Profile, Stat, Stage, Quiz } from "./types";
export type Random = () => number;
export const pick = <T>(xs: readonly T[], rng: Random = Math.random): T =>
  xs[Math.floor(rng() * xs.length)];
export const integer = (min: number, max: number, rng: Random = Math.random) =>
  min + Math.floor(rng() * (max - min + 1));
export function zodiac(month: number, day: number) {
  const date = month * 100 + day;
  let found = 0;
  for (let i = 1; i < ZODIACS.length; i++)
    if (date >= ZODIACS[i].from) found = i;
  return date >= 1222 ? 0 : found;
}
export function seasonStat(month: number): Stat {
  return month >= 3 && month <= 5
    ? "charm"
    : month >= 6 && month <= 8
      ? "fitness"
      : month >= 9 && month <= 11
        ? "intelligence"
        : "morality";
}
export function initialStats(p: Profile) {
  const stats = Object.fromEntries(
    STAT_KEYS.map((k) => [k, R.baseStat]),
  ) as GameState["stats"];
  const z = ZODIACS[zodiac(p.month, p.day)];
  stats[z.main] += R.zodiacMain;
  stats[z.sub] += R.zodiacSub;
  const blood = BLOODS[p.blood];
  stats[blood[0]] += R.bloodMain;
  stats[blood[1]] += R.bloodSub;
  stats[seasonStat(p.month)] += R.season;
  return stats;
}
export function createGame(profile: Profile): GameState {
  return {
    version: 1,
    profile: { ...profile, zodiac: zodiac(profile.month, profile.day) },
    stage: "tutorial",
    turn: 0,
    totalTurn: 0,
    position: 0,
    stats: initialStats(profile),
    cash: R.cash,
    level: R.level,
    xp: 0,
    club: 0,
    clubHistory: [],
    education: "none",
    retrograde: 0,
    fortune: 0,
    fortuneQueued: false,
    god: null,
    partner: null,
    love: 0,
    marriedAt: null,
    pregnancy: null,
    births: 0,
    children: [],
    cards: [],
    examHistory: [],
    contests: [],
    seenQuestions: [],
    phase: "ready",
    remainingSteps: 0,
    plannedDestination: null,
    dice: [],
    notice: "",
    quiz: null,
    mini: null,
    date: null,
    log: [S.welcome],
    tutorialStep: 0,
    turnGod: null,
    future: {
      chapter: "student",
      job: null,
      jobHistory: [],
      stocks: {},
      combat: { hp: 100, deck: [] },
      guardianAngels: [],
      extensions: {},
    },
  };
}
export function log(g: GameState, s: string) {
  g.log.unshift(s);
  g.log = g.log.slice(0, R.logLimit);
}
function notice(g: GameState, s: string) {
  g.notice = s;
  g.phase = "notice";
  log(g, s);
}
export function change(g: GameState, key: Stat, n: number) {
  g.stats[key] = Math.max(0, g.stats[key] + n);
}
function money(g: GameState, n: number) {
  g.cash = Math.max(0, g.cash + n);
}
export function enterStage(g: GameState, stage: Stage) {
  g.stage = stage;
  g.turn = 0;
  g.position = 0;
  g.phase = "club";
  g.remainingSteps = 0;
  g.plannedDestination = null;
  g.dice = [];
}
export function selectClub(g: GameState, club: number) {
  if (g.phase !== "club" || !CLUBS[club]) return;
  g.club = club;
  g.clubHistory.push({ stage: g.stage, club });
  g.phase = "ready";
  log(g, S.newClub(CLUBS[club].name));
}
export function skipTutorial(g: GameState) {
  if (g.stage === "tutorial") enterStage(g, "junior");
}
export function beginTurn(
  g: GameState,
  rng: Random = Math.random,
  chosenSteps?: number,
) {
  if (g.phase !== "ready") return;
  g.turn++;
  if (g.stage !== "tutorial") g.totalTurn++;
  if (rng() < R.retroChance) {
    if (g.retrograde > 0) {
      g.fortuneQueued = true;
      log(g, S.retroAgain);
    } else {
      g.retrograde = R.retroTurns;
      log(g, S.retro);
    }
  }
  g.turnGod = g.god?.id ?? null;
  if (g.god) {
    const id = g.god.id;
    const name = GODS[id].name;
    if (id === 0 || id === 4) {
      const stat = pick(STAT_KEYS, rng);
      const n = integer(...R.godStat, rng) * (id === 0 ? 1 : -1);
      change(g, stat, n);
      log(g, S.godStat(name, STAT_NAMES[stat], n));
    }
    if (id === 1 || id === 5) {
      const n =
        id === 1 ? integer(...R.godIncome, rng) : -integer(...R.godLoss, rng);
      money(g, n);
      log(g, S.godCash(name, n));
    }
  }
  familyTurn(g, rng);
  const count = g.retrograde > 0 ? 1 : R.diceCount;
  g.dice = Array.from({ length: count }, () => integer(1, R.diceSides, rng));
  let steps = g.dice.reduce((a, b) => a + b, 0);
  if (
    g.god?.id === 2 &&
    chosenSteps !== undefined &&
    Number.isInteger(chosenSteps)
  )
    steps = Math.min(count * R.diceSides, Math.max(count, chosenSteps));
  if (g.god?.id === 6) steps = Math.max(R.minimumMove, steps - 1);
  g.remainingSteps = steps;
  g.phase = "moving";
  move(g, rng);
}
function familyTurn(g: GameState, rng: Random) {
  if (g.marriedAt === null || g.totalTurn <= g.marriedAt || g.partner === null)
    return;
  let born = false;
  if (
    g.pregnancy &&
    g.totalTurn - g.pregnancy.conceivedTurn >= R.pregnancyTurns
  ) {
    const n = rng() < R.twinsChance ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const id = `child-${g.totalTurn}-${i}`;
      g.children.push({
        id,
        name: `${TEXT.child} ${g.children.length + 1}`,
        personality: integer(0, 3, rng),
        stats: Object.fromEntries(
          STAT_KEYS.map((k) => [k, R.childStat]),
        ) as GameState["stats"],
        bornTurn: g.totalTurn,
      });
      g.future.guardianAngels.push(id);
    }
    g.births++;
    g.pregnancy = null;
    born = true;
    log(g, S.born(n));
  }
  if (
    !born &&
    !g.pregnancy &&
    rng() < R.pregnancyChance / R.pregnancyDecay ** g.births
  ) {
    g.pregnancy = { conceivedTurn: g.totalTurn };
    log(g, S.pregnant);
  }
  const salary = PARTNERS[g.partner].salary;
  const cost = (g.children.length + (g.pregnancy ? 1 : 0)) * R.childCost;
  money(g, salary - cost);
  log(g, S.family(salary, cost));
}
export function move(g: GameState, rng: Random = Math.random) {
  const map = MAPS[g.stage];
  while (g.remainingSteps > 0) {
    g.position = g.plannedDestination ?? (g.position + 1) % map.length;
    g.plannedDestination = null;
    g.remainingSteps--;
    if (g.position === 0) {
      const cash = g.remainingSteps === 0 ? R.startLand : R.startPass;
      money(g, cash);
      log(g, S.start(cash));
    }
    if (map[g.position] === "fork") {
      if (g.god?.id === 6) {
        log(g, S.lost);
        takeFork(
          g,
          integer(0, FORK_ROUTES[g.stage].length - 1, rng),
          rng,
          true,
        );
        return;
      }
      g.phase = "fork";
      return;
    }
  }
  land(g, rng);
}
export function takeFork(
  g: GameState,
  index: number,
  rng: Random = Math.random,
  forced = false,
) {
  if ((g.phase !== "fork" && !forced) || !FORK_ROUTES[g.stage][index]) return; // Choosing an edge consumes the next movement step; a landing fork grants no free step.
  if (g.remainingSteps > 0) {
    g.position = FORK_ROUTES[g.stage][index].destination % MAPS[g.stage].length;
    g.remainingSteps--;
    if (g.remainingSteps === 0) {
      land(g, rng);
      return;
    }
  }
  if (g.remainingSteps === 0)
    g.plannedDestination =
      FORK_ROUTES[g.stage][index].destination % MAPS[g.stage].length;
  g.phase = "moving";
  move(g, rng);
}
function land(g: GameState, rng: Random) {
  const tile = MAPS[g.stage][g.position];
  if (tile === "game") {
    g.mini = {
      id: integer(0, MINI_GAMES.length - 1, rng),
      round: 0,
      wins: 0,
      contest: false,
    };
    g.phase = "mini";
    return;
  }
  if (tile === "quiz") {
    startQuiz(g, "quiz", rng);
    return;
  }
  if (tile === "club") {
    const c = CLUBS[g.club];
    change(g, c.main, R.clubMain);
    change(g, c.sub, R.clubSub);
    if (rng() < R.clubCashChance) money(g, R.clubCash);
    notice(g, S.club(c.name, STAT_NAMES[c.main], STAT_NAMES[c.sub]));
    return;
  }
  if (tile === "event") {
    event(g, rng);
    return;
  }
  if (tile === "love" && g.stage === "university") {
    g.phase = "love";
    return;
  }
  if (tile === "contest" && contestAvailable(g)) {
    g.phase = "contest";
    return;
  }
  notice(g, tile === "contest" ? TEXT.noRecords : TEXT.ready);
}
function event(g: GameState, rng: Random) {
  if (g.god && rng() < R.offeringChance) {
    g.phase = "offering";
    return;
  }
  const good = rng() < goodProbability(g);
  if (rng() < R.eventGodChance) {
    const ids = GODS.map((god, i) => (god.good === good ? i : -1)).filter(
      (i) => i >= 0,
    );
    const id = pick(ids, rng);
    g.god = { id, remaining: GODS[id].turns };
    g.turnGod = null;
    notice(g, S.god(GODS[id].name, GODS[id].turns));
    return;
  }
  if (!good && g.god?.id === 3) {
    notice(g, S.shield);
    return;
  }
  const stat = pick(STAT_KEYS, rng);
  change(g, stat, R.eventStat * (good ? 1 : -1));
  money(g, R.eventCash * (good ? 1 : -1));
  g.xp += R.eventXP;
  g.level = R.level + Math.floor(g.xp / R.levelXP);
  let message = `${pick(good ? S.eventGood : S.eventBad, rng)} ${S.eventResult(good, STAT_NAMES[stat], R.eventStat, R.eventCash)}`;
  if (rng() < R.cardChance) {
    const card = g.cards.find((c) => c.id === "morning-kite");
    if (card) card.count++;
    else g.cards.push({ id: "morning-kite", count: 1 });
    message += S.card;
  }
  notice(g, message);
}
export function goodProbability(g: GameState) {
  const w = g.fortune > 0 ? R.fortuneGoodWeight : R.goodWeight;
  return w / (w + R.badWeight);
}
export function continueTurn(g: GameState, rng: Random = Math.random) {
  if (g.phase !== "notice") return;
  finishTurn(g, rng);
}
function finishTurn(g: GameState, rng: Random) {
  // Resolve the scheduled competition before advancing/expiring this same turn.
  const schedule = R.contestTurns[g.stage];
  const played = g.contests.filter((c) => c.stage === g.stage).length;
  if (played < schedule.length && g.turn >= schedule[played]) {
    g.phase = "contest";
    return;
  }
  if (g.retrograde > 0) {
    g.retrograde--;
    if (g.retrograde === 0 && g.fortuneQueued) {
      if (g.fortune > 0) g.fortune--;
      g.fortune = R.fortuneTurns;
      g.fortuneQueued = false;
      log(g, S.fortune);
    } else if (g.fortune > 0) g.fortune--;
  } else if (g.fortune > 0) g.fortune--;
  if (g.god && g.turnGod === g.god.id) {
    g.god.remaining--;
    if (g.god.remaining <= 0) {
      log(g, S.godExpired(GODS[g.god.id].name));
      g.god = null;
    }
  }
  g.turnGod = null;
  if (g.stage === "tutorial") {
    g.tutorialStep++;
    if (g.turn >= R.turns.tutorial) {
      enterStage(g, "junior");
      return;
    }
  }
  if (g.stage === "junior" && g.turn >= R.turns.junior) {
    startQuiz(g, "junior", rng);
    return;
  }
  if (g.stage === "senior" && g.turn >= R.turns.senior) {
    startQuiz(g, "senior", rng);
    return;
  }
  if (g.stage === "university" && g.turn >= R.turns.university) {
    endGame(g, "university");
    return;
  }
  g.phase = "ready";
}
function endGame(g: GameState, education: GameState["education"]) {
  g.education = education;
  g.stage = "society";
  g.phase = "end";
  g.future.chapter = "society";
}
export function drawQuestions(
  g: GameState,
  kind: Quiz["kind"],
  rng: Random = Math.random,
) {
  const n = kind === "quiz" ? R.quizQuestions : R.examQuestions;
  const hardCount = Math.round(n * R.hardRatio[kind]);
  const shuffled = [...QUESTIONS]
    .map((q) => ({ q, sort: rng() }))
    .sort((a, b) => a.sort - b.sort)
    .map((x) => x.q);
  const used = new Set(g.seenQuestions);
  const ordered = [
    ...shuffled.filter((q) => !used.has(q.id)),
    ...shuffled.filter((q) => used.has(q.id)),
  ];
  let selected = [
    ...ordered.filter((q) => q.hard).slice(0, hardCount),
    ...ordered.filter((q) => !q.hard).slice(0, n - hardCount),
  ];
  selected = selected
    .map((q) => ({ q, sort: rng() }))
    .sort((a, b) => a.sort - b.sort)
    .map((x) => x.q);
  g.seenQuestions = [
    ...new Set([...g.seenQuestions, ...selected.map((q) => q.id)]),
  ];
  return selected.map((q) => q.id);
}
export function startQuiz(
  g: GameState,
  kind: Quiz["kind"],
  rng: Random = Math.random,
) {
  g.quiz = {
    kind,
    ids: drawQuestions(g, kind, rng),
    index: 0,
    correct: 0,
    startedAt: Date.now(),
    elapsedMs: 0,
    feedback: null,
    selected: null,
  };
  g.phase = "quiz";
}
export function answerQuiz(g: GameState, index: number, now = Date.now()) {
  const q = g.quiz;
  if (g.phase !== "quiz" || !q || q.feedback !== null) return;
  const question = QUESTIONS.find((x) => x.id === q.ids[q.index])!;
  if (index < 0 || index >= question.choices.length) return;
  const right = index === question.answer;
  q.correct += right ? 1 : 0;
  q.selected = index;
  q.elapsedMs += Math.max(0, now - q.startedAt);
  q.feedback = `${right ? TEXT.correct : TEXT.wrong}：${question.explanation}`;
}
export function nextQuestion(g: GameState, rng: Random = Math.random) {
  const q = g.quiz;
  if (!q || q.feedback === null) return;
  if (q.index < q.ids.length - 1) {
    q.index++;
    q.feedback = null;
    q.selected = null;
    q.startedAt = Date.now();
    return;
  }
  g.examHistory.push({
    kind: q.kind,
    correct: q.correct,
    total: q.ids.length,
    elapsedMs: q.elapsedMs,
  });
  g.quiz = null;
  if (q.kind === "quiz") {
    const reward = R.quizRewards[q.correct];
    change(g, "intelligence", reward.stat);
    money(g, reward.cash);
    notice(g, S.quizResult(q.correct, reward.stat, reward.cash));
    return;
  }
  if (q.kind === "contest") {
    completeContest(g, 0, q.correct, rng, q.elapsedMs);
    return;
  }
  if (q.correct >= R.examPass) {
    log(g, S.pass(q.correct));
    g.education = q.kind === "junior" ? "junior" : "senior";
    enterStage(g, q.kind === "junior" ? "senior" : "university");
  } else {
    log(g, S.fail(q.correct));
    endGame(g, q.kind === "junior" ? "junior" : "senior");
  }
}
export function completeMini(
  g: GameState,
  won: boolean,
  score: number,
  rng: Random = Math.random,
) {
  if (g.phase !== "mini" || !g.mini) return;
  const m = g.mini;
  if (m.contest) {
    g.mini = null;
    completeContest(
      g,
      2,
      score * R.contest.rhythmPoints +
        g.stats.fitness * R.contest.fitnessWeight,
      rng,
    );
    return;
  }
  m.round++;
  if (won) m.wins++;
  if (m.round < R.miniRounds) return;
  const reward = R.miniRewards[m.wins];
  const stat = MINI_GAMES[m.id].stat;
  const factor = g.god?.id === 3 ? R.rewardBoost : 1;
  const n = Math.round(reward.stat * factor),
    c = Math.round(reward.cash * factor);
  change(g, stat, n);
  money(g, c);
  notice(g, S.miniResult(m.wins, STAT_NAMES[stat], n, c));
  g.mini = null;
}
export function contestAvailable(g: GameState) {
  return (
    g.contests.filter((c) => c.stage === g.stage).length <
    R.contestTurns[g.stage].length
  );
}
export function chooseContest(
  g: GameState,
  type: number,
  rng: Random = Math.random,
) {
  if (g.phase !== "contest") return;
  if (type === 0) startQuiz(g, "contest", rng);
  if (type === 2) {
    g.mini = { id: 1, round: 0, wins: 0, contest: true };
    g.phase = "mini";
  }
}
export function styleContest(
  g: GameState,
  choice: number,
  rng: Random = Math.random,
) {
  if (g.phase !== "contest") return;
  completeContest(
    g,
    1,
    g.stats.charm + (choice === 0 ? R.contest.styleBonus : 0),
    rng,
  );
}
function completeContest(
  g: GameState,
  type: number,
  score: number,
  rng: Random,
  elapsedMs = 0,
) {
  const base = R.opponents[g.stage];
  const opponents = Array.from({ length: 3 }, () =>
    type === 0
      ? integer(...R.contest.quizOpponents[g.stage], rng)
      : base +
        integer(-R.contest.opponentSpread, R.contest.opponentSpread, rng),
  ).sort((a, b) => b - a);
  const stat: Stat =
    type === 0 ? "intelligence" : type === 1 ? "charm" : "fitness";
  const rank = opponents.filter((s) => {
    if (s !== score) return s > score;
    if (type === 0) {
      const opponentTime = integer(...R.contest.quizTimeMs, rng);
      if (opponentTime !== elapsedMs) return opponentTime < elapsedMs;
    }
    return g.stats[stat] < base;
  }).length;
  const reward = R.contestRewards[rank];
  const factor = g.god?.id === 3 ? R.rewardBoost : 1;
  const n = Math.round(reward.stat * factor),
    cash = Math.round(reward.cash * factor);
  change(g, stat, n);
  money(g, cash);
  g.contests.push({ stage: g.stage, turn: g.turn, type, rank, score });
  notice(
    g,
    S.contestResult(
      TEXT.ranks[rank],
      score,
      opponents.join("／"),
      STAT_NAMES[stat],
      n,
      cash,
    ),
  );
}
export function meet(g: GameState, id: number) {
  const p = PARTNERS[id];
  if (
    g.phase !== "love" ||
    g.stage !== "university" ||
    g.partner !== null ||
    !p ||
    g.stats.charm < p.threshold ||
    g.cash < p.cost
  )
    return;
  g.partner = id;
  g.love = 0;
  money(g, -p.cost);
  notice(g, S.meet(p.names[g.profile.gender === "male" ? 0 : 1], p.cost));
}
export function startDate(g: GameState) {
  if (g.phase === "love" && g.partner !== null && g.marriedAt === null) {
    g.date = { index: 0, correct: 0, feedback: null };
    g.phase = "date";
  }
}
export function answerDate(g: GameState, index: number) {
  if (g.phase !== "date" || !g.date || g.partner === null) return;
  const d = g.date;
  if (index === PARTNERS[g.partner].likes[d.index]) d.correct++;
  d.index++;
  if (d.index >= R.dateQuestions) {
    const gain = R.dateGains[d.correct];
    g.love = Math.min(R.loveMax, g.love + gain);
    g.date = null;
    notice(g, S.date(d.correct, gain));
  }
}
export function marry(g: GameState) {
  if (
    g.phase !== "love" ||
    g.partner === null ||
    g.love < R.loveMax ||
    g.marriedAt !== null
  )
    return;
  g.marriedAt = g.totalTurn;
  notice(g, S.marry);
}
export function breakup(g: GameState) {
  if (g.phase !== "love" || g.marriedAt !== null) return;
  g.partner = null;
  g.love = 0;
  notice(g, S.breakup);
}
export function nurture(g: GameState, stat: Stat) {
  if (g.phase !== "love" || g.marriedAt === null) return;
  change(g, "charm", R.familyStat);
  for (const c of g.children) c.stats[stat] += R.familyStat;
  notice(g, S.nurture(STAT_NAMES[stat]));
}
export function leaveTile(g: GameState) {
  if (["love", "offering"].includes(g.phase)) {
    g.phase = "notice";
    g.notice = TEXT.ready;
  }
}
export function offer(g: GameState) {
  if (g.phase !== "offering" || !g.god) return;
  const god = GODS[g.god.id];
  if (g.cash < god.cost) return;
  money(g, -god.cost);
  g.god = null;
  notice(g, S.offering(god.name, god.cost));
}

export function quizHint(g: GameState) {
  if (!g.quiz || g.stats.intelligence < R.contest.quizHintThreshold)
    return null;
  const q = QUESTIONS.find((q) => q.id === g.quiz!.ids[g.quiz!.index])!;
  return (q.answer + 1) % q.choices.length;
}
