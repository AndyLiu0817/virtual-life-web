import { expect, it } from "vitest";
import {
  createSave,
  exportSave,
  importSave,
  saveStorage,
  SAVE_VERSION,
} from "../src/game/saves";

const save = createSave({
  name: "小晴",
  gender: "girl",
  birthday: { month: 2, day: 29 },
  bloodType: "B",
});

it("匯出及匯入會保留版本、角色與所有預留欄位", () => {
  expect(importSave(exportSave(save))).toEqual(save);
  expect(save).toMatchObject({
    version: SAVE_VERSION,
    level: 1,
    experience: 0,
    cards: [],
    stage: "junior",
    turn: 0,
    education: null,
    hiddenJobUnlock: false,
    exams: [],
    clubHistory: [],
    competitions: [],
    partner: null,
    affection: 0,
    spouse: null,
    children: [],
    deity: null,
    retrogradeTurns: 0,
    turnaroundTurns: 0,
  });
});

it("拒絕損壞、不相容及超出數值範圍的存檔", () => {
  expect(() => importSave("{")).toThrow("無法讀取存檔");
  expect(() => importSave(JSON.stringify({ ...save, version: 999 }))).toThrow(
    "不相容",
  );
  expect(() =>
    importSave(
      JSON.stringify({ ...save, stats: { ...save.stats, intellect: 10000 } }),
    ),
  ).toThrow("格式不正確");
  expect(() => importSave(JSON.stringify({ ...save, zodiac: "牡羊" }))).toThrow(
    "格式不正確",
  );
});

it("自動存檔與三個手動格各自儲存並可跨實例讀取", () => {
  const data = new Map<string, string>();
  const storage = {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => data.set(key, value),
  };
  const writer = saveStorage(storage);
  expect(writer.read(0)).toBeNull();
  for (const slot of [0, 1, 2, 3])
    writer.write(slot, { ...save, name: `角色${slot}` });
  const reader = saveStorage(storage);
  expect([0, 1, 2, 3].map((slot) => reader.read(slot)?.name)).toEqual([
    "角色0",
    "角色1",
    "角色2",
    "角色3",
  ]);
  expect(() => writer.write(4, save)).toThrow("找不到存檔格");
});

it("舊存檔可匯入並補上考試欄位", () => {
  const legacy = JSON.parse(exportSave(save));
  delete legacy.seenQuestionIds;
  delete legacy.entranceAttempt;
  delete legacy.examResultPending;
  expect(importSave(JSON.stringify(legacy))).toEqual(save);
});
