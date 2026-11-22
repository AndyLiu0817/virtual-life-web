import data from "../data/main-story.json" with { type: "json" };
import type { BoardStage } from "../data/school-board";
import type { Save } from "./saves";

export const storyStageNames = {
  junior: "國中",
  high: "高中",
  university: "大學",
} as const;
export type StoryStage = keyof typeof storyStageNames;
export const storyStages = Object.keys(storyStageNames) as StoryStage[];
export const story = data.fragments as ((typeof data.fragments)[number] & {
  stage: StoryStage;
})[];
export const stampYear = data.stampYear;
export const stageStory = (stage: StoryStage) =>
  story.filter((fragment) => fragment.stage === stage);
export const juniorOpening = stageStory("junior")[0];
export const storyProgress = (ids: readonly string[], stage?: StoryStage) => {
  const fragments = stage ? stageStory(stage) : story;
  return {
    count: fragments.filter(({ id }) => ids.includes(id)).length,
    total: fragments.length,
  };
};
const isBoardStage = (stage: Save["stage"]): stage is BoardStage =>
  stage === "junior" || stage === "high" || stage === "university";

export function collectStory(save: Save, stage: BoardStage, tile: number) {
  const used = save.storyTilesUsed.some(
    (entry) => entry.stage === stage && entry.tile === tile,
  );
  const fragment = used
    ? undefined
    : stageStory(stage).find(({ id }) => !save.storyFragments.includes(id));
  return {
    fragment,
    save: {
      ...save,
      experience: save.experience + 3,
      storyFragments: fragment
        ? [...save.storyFragments, fragment.id]
        : save.storyFragments,
      storyTilesUsed: fragment
        ? [...save.storyTilesUsed, { stage, tile }]
        : save.storyTilesUsed,
    },
  };
}

export function snapshotStage(save: Save) {
  const { stage, stageSnapshots, chenxiStart, ...snapshot } = save;
  if (!isBoardStage(stage) || save.turn !== 0) return save;
  return {
    ...save,
    chenxiStart,
    stageSnapshots: { ...stageSnapshots, [stage]: { ...snapshot, stage } },
  };
}

export function restartStage(save: Save, stage: BoardStage): Save | undefined {
  const snapshot = save.stageSnapshots[stage];
  if (!snapshot) return;
  const currentIds = stageStory(stage).map(({ id }) => id);
  return {
    ...snapshot,
    storyFragments: snapshot.storyFragments.filter(
      (id) =>
        !currentIds.includes(id) ||
        (stage === "junior" && id === juniorOpening.id),
    ),
    storyTilesUsed: snapshot.storyTilesUsed.filter(
      (entry) => entry.stage !== stage,
    ),
    exams: save.exams,
    stageSnapshots: save.stageSnapshots,
    chenxiStart: null,
  };
}

export function storyEnding(save: Save) {
  switch (save.ending) {
    case "universityGraduate":
      return save.stage === "graduated" &&
        story.every(({ id }) => save.storyFragments.includes(id))
        ? "true"
        : "bittersweet";
    case "universityExamFail":
      return "阿公還在等郵差，你也還在等一個答案。";
  }
}

export const galleryKey = "vlw-story-gallery";
export function galleryRecord(
  storage: () => Pick<Storage, "getItem" | "setItem">,
  fallback: string[] = [],
  add = false,
  ending = false,
) {
  try {
    const store = storage();
    const saved = JSON.parse(store.getItem(galleryKey) ?? "{}");
    const seen = new Set<string>(Array.isArray(saved?.seen) ? saved.seen : []);
    if (add) fallback.forEach((id) => seen.add(id));
    const record = {
      seen: story.filter(({ id }) => seen.has(id)).map(({ id }) => id),
      trueEndingSeen: ending || saved?.trueEndingSeen === true,
    };
    if (add || ending) store.setItem(galleryKey, JSON.stringify(record));
    return { ...record, unavailable: false };
  } catch {
    return { seen: fallback, trueEndingSeen: ending, unavailable: true };
  }
}
