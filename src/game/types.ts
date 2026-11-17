export type Stat = "intelligence" | "morality" | "charm" | "fitness";
export type Stats = Record<Stat, number>;
export type Stage = "tutorial" | "junior" | "senior" | "university" | "society";
export type Tile =
  | "start"
  | "event"
  | "game"
  | "club"
  | "quiz"
  | "contest"
  | "love"
  | "fork"
  | "job"
  | "salary"
  | "travel"
  | "property"
  | "graduateSchool"
  | "monster"
  | "quest";
export interface Profile {
  name: string;
  gender: "male" | "female";
  month: number;
  day: number;
  blood: "A" | "B" | "O" | "AB";
  zodiac: number;
}
export interface Question {
  id: string;
  category: string;
  hard: boolean;
  prompt: string;
  choices: string[];
  answer: number;
  explanation: string;
}
export interface Child {
  id: string;
  name: string;
  personality: number;
  stats: Stats;
  bornTurn: number;
}
export interface Quiz {
  kind: "quiz" | "junior" | "senior" | "contest";
  ids: string[];
  index: number;
  correct: number;
  startedAt: number;
  elapsedMs: number;
  feedback: string | null;
  selected: number | null;
}
export interface MiniSession {
  id: number;
  round: number;
  wins: number;
  contest: boolean;
}
export interface GameState {
  version: 1;
  profile: Profile;
  stage: Stage;
  turn: number;
  totalTurn: number;
  position: number;
  stats: Stats;
  cash: number;
  level: number;
  xp: number;
  club: number;
  clubHistory: { stage: Stage; club: number }[];
  education: "none" | "junior" | "senior" | "university";
  retrograde: number;
  fortune: number;
  fortuneQueued: boolean;
  god: { id: number; remaining: number } | null;
  partner: number | null;
  love: number;
  marriedAt: number | null;
  pregnancy: { conceivedTurn: number } | null;
  births: number;
  children: Child[];
  cards: { id: string; count: number }[];
  examHistory: {
    kind: string;
    correct: number;
    total: number;
    elapsedMs: number;
  }[];
  contests: {
    stage: Stage;
    turn: number;
    type: number;
    rank: number;
    score: number;
  }[];
  seenQuestions: string[];
  phase:
    | "ready"
    | "moving"
    | "fork"
    | "notice"
    | "club"
    | "quiz"
    | "mini"
    | "contest"
    | "love"
    | "date"
    | "offering"
    | "end";
  remainingSteps: number;
  plannedDestination: number | null;
  dice: number[];
  notice: string;
  quiz: Quiz | null;
  mini: MiniSession | null;
  date: { index: number; correct: number; feedback: string | null } | null;
  log: string[];
  tutorialStep: number;
  turnGod: number | null;
  future: {
    chapter: "student" | "society";
    job: string | null;
    jobHistory: unknown[];
    stocks: Record<string, number>;
    combat: { hp: number; deck: string[] };
    guardianAngels: string[];
    extensions: Record<string, unknown>;
  };
}
