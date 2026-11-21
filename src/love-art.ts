import type { PartnerId } from "./data/love-partners";

const portraits = import.meta.glob<string>("./love-art/*.webp", {
  eager: true,
  import: "default",
  query: "?url",
});

export type Expression = "neutral" | "happy" | "shy" | "annoyed" | "sad";

export const portraitUrl = (
  id: PartnerId,
  expression: Expression = "neutral",
) => portraits[`./love-art/${id}-${expression}.webp`];

export const loveCutout = (id: string) => portraits[`./love-art/${id}.webp`];
