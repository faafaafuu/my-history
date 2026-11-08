/**
 * Области жизни. Список закрытый, чтобы фильтры, radar и промпты говорили на
 * одном языке; новую область добавлять сюда (иконка — в apps/web).
 */
export const AREAS = [
  "health",
  "sleep",
  "nutrition",
  "fitness",
  "mood",
  "social",
  "family",
  "work",
  "learning",
  "finance",
  "rest",
  "other",
] as const;

export type Area = (typeof AREAS)[number];

export const AREA_LABELS: Record<Area, string> = {
  health: "Здоровье",
  sleep: "Сон",
  nutrition: "Питание",
  fitness: "Движение",
  mood: "Настроение",
  social: "Социум",
  family: "Семья",
  work: "Работа",
  learning: "Развитие",
  finance: "Финансы",
  rest: "Отдых",
  other: "Другое",
};
