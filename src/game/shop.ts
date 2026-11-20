import { changeValue, type ValueChange } from "./deities";
import type { Save } from "./saves";

interface ShopItem {
  id: string;
  name: string;
  price: number;
  limit: number;
  effects: ValueChange[];
  result?: string;
}

const allStats = (amount: number): ValueChange[] =>
  (["intellect", "morality", "charm", "fitness"] as const).map((target) => ({
    target,
    amount,
  }));

const inventory: Record<"high" | "university", ShopItem[]> = {
  high: [
    {
      id: "high-shop-notes",
      name: "參考書套組",
      price: 800,
      limit: 2,
      effects: [{ target: "intellect", amount: 10 }],
    },
    {
      id: "high-shop-drink",
      name: "運動飲料",
      price: 500,
      limit: 2,
      effects: [{ target: "fitness", amount: 8 }],
    },
    {
      id: "high-shop-balm",
      name: "防曬潤唇組",
      price: 700,
      limit: 2,
      effects: [{ target: "charm", amount: 8 }],
    },
    {
      id: "high-shop-bento",
      name: "愛心便當",
      price: 600,
      limit: 2,
      effects: [{ target: "morality", amount: 8 }],
      result: "你買了愛心便當，分給同學一起吃。",
    },
    {
      id: "high-shop-cram",
      name: "模考衝刺包",
      price: 1500,
      limit: 1,
      effects: [
        { target: "intellect", amount: 16 },
        { target: "fitness", amount: -4 },
      ],
    },
    {
      id: "high-shop-tee",
      name: "社團聯名T恤",
      price: 1200,
      limit: 1,
      effects: [{ target: "charm", amount: 12 }],
    },
    {
      id: "high-shop-vitamin",
      name: "綜合維他命",
      price: 1000,
      limit: 1,
      effects: [{ target: "fitness", amount: 12 }],
    },
    {
      id: "high-shop-lucky",
      name: "校慶福袋",
      price: 2000,
      limit: 1,
      effects: allStats(4),
    },
  ],
  university: [
    {
      id: "uni-shop-copy",
      name: "講義影印卡",
      price: 1000,
      limit: 2,
      effects: [{ target: "intellect", amount: 12 }],
    },
    {
      id: "uni-shop-cup",
      name: "手搖飲聯名杯",
      price: 800,
      limit: 2,
      effects: [{ target: "charm", amount: 10 }],
    },
    {
      id: "uni-shop-gym",
      name: "健身房週卡",
      price: 900,
      limit: 2,
      effects: [{ target: "fitness", amount: 10 }],
    },
    {
      id: "uni-shop-vest",
      name: "志工活動背心",
      price: 800,
      limit: 2,
      effects: [{ target: "morality", amount: 10 }],
    },
    {
      id: "uni-shop-late",
      name: "深夜圖書館便當",
      price: 1800,
      limit: 1,
      effects: [
        { target: "intellect", amount: 18 },
        { target: "fitness", amount: -6 },
      ],
    },
    {
      id: "uni-shop-style",
      name: "形象整理券",
      price: 1600,
      limit: 1,
      effects: [{ target: "charm", amount: 16 }],
    },
    {
      id: "uni-shop-tutor",
      name: "衝刺輔導課",
      price: 2200,
      limit: 1,
      effects: [{ target: "intellect", amount: 20 }],
    },
    {
      id: "uni-shop-bbq",
      name: "系烤加菜金",
      price: 2500,
      limit: 1,
      effects: allStats(5),
    },
  ],
};

export function shopStock(save: Save) {
  const { stage } = save;
  if (stage !== "high" && stage !== "university") return [];
  return inventory[stage].map((item) => {
    const purchased = save.shopPurchases.find(
      ({ stage: school, itemId }) => school === stage && itemId === item.id,
    );
    const remaining = Math.max(0, item.limit - (purchased?.count ?? 0));
    return {
      ...item,
      remaining,
      available: remaining > 0 && save.cash >= item.price,
    };
  });
}

export function buyShopItem(save: Save, itemId: string) {
  const { stage } = save;
  if (stage !== "high" && stage !== "university") return;
  const item = shopStock(save).find(({ id }) => id === itemId);
  if (!item?.available) return;
  const changes: ValueChange[] = [];
  for (const { target, amount } of item.effects) {
    const applied = changeValue(save, target, amount);
    save = applied.save;
    changes.push(applied.change);
  }
  return {
    item,
    changes,
    save: {
      ...save,
      cash: save.cash - item.price,
      shopPurchases: [
        ...save.shopPurchases.filter(
          (entry) => entry.stage !== stage || entry.itemId !== itemId,
        ),
        { stage, itemId, count: item.limit - item.remaining + 1 },
      ],
    },
  };
}
