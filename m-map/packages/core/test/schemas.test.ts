import { describe, expect, it } from "vitest";
import { EdgeCreate, ExpandResult, GraphExport, NodeCreate, ReminderSchema, TaskSchema } from "../src";

const A = "11111111-1111-4111-8111-111111111111";
const B = "22222222-2222-4222-8222-222222222222";
const now = "2026-11-08T10:00:00.000Z";

describe("NodeCreate", () => {
  it("заполняет значения по умолчанию", () => {
    const node = NodeCreate.parse({ title: "Алкоголь по пятницам", type: "habit", area: "health" });
    expect(node).toMatchObject({ valence: 0, status: "idea", description: "", frequency: null, x: null });
  });

  it("не пускает валентность вне -1..1 и неизвестную область", () => {
    expect(NodeCreate.safeParse({ title: "x", type: "habit", area: "health", valence: 1.5 }).success).toBe(false);
    expect(NodeCreate.safeParse({ title: "x", type: "habit", area: "космос" }).success).toBe(false);
  });

  it("обрезает пробелы и не пускает пустой заголовок", () => {
    expect(NodeCreate.parse({ title: "  Сон  ", type: "state", area: "sleep" }).title).toBe("Сон");
    expect(NodeCreate.safeParse({ title: "   ", type: "state", area: "sleep" }).success).toBe(false);
  });
});

describe("EdgeCreate", () => {
  it("не пускает петлю", () => {
    expect(EdgeCreate.safeParse({ from: A, to: A, type: "causes" }).success).toBe(false);
  });
  it("вес и уверенность в 0..1", () => {
    expect(EdgeCreate.safeParse({ from: A, to: B, type: "worsens", weight: 2 }).success).toBe(false);
    expect(EdgeCreate.parse({ from: A, to: B, type: "worsens" })).toMatchObject({ weight: 0.5, confidence: 1, origin: "user", lagDays: 0 });
  });
});

describe("TaskSchema.recurrence", () => {
  const base = { id: A, nodeId: null, title: "Зал", createdAt: now };
  it("принимает RRULE", () => {
    expect(TaskSchema.parse({ ...base, recurrence: "FREQ=WEEKLY;BYDAY=TU,FR" }).recurrence).toBe("FREQ=WEEKLY;BYDAY=TU,FR");
  });
  it("отвергает произвольный текст", () => {
    expect(TaskSchema.safeParse({ ...base, recurrence: "два раза в неделю" }).success).toBe(false);
  });
});

describe("ReminderSchema", () => {
  it("требует задачу или узел", () => {
    expect(ReminderSchema.safeParse({ id: A, fireAt: now, channel: "push", createdAt: now }).success).toBe(false);
    expect(ReminderSchema.safeParse({ id: A, taskId: B, fireAt: now, channel: "push", createdAt: now }).success).toBe(true);
  });
});

describe("ExpandResult", () => {
  const candidate = {
    title: "Хуже сон",
    type: "state",
    area: "sleep",
    valence: -0.6,
    probability: 0.7,
    horizon: "days",
    edgeType: "worsens",
    weight: 0.6,
    rationale: "Алкоголь сокращает фазу быстрого сна.",
  };
  it("парсит ответ модели и ставит значения по умолчанию", () => {
    const parsed = ExpandResult.parse({ candidates: [candidate] });
    expect(parsed.candidates[0]).toMatchObject({ mergeWith: null, linksTo: [] });
  });
  it("не больше 8 кандидатов", () => {
    expect(ExpandResult.safeParse({ candidates: Array(9).fill(candidate) }).success).toBe(false);
  });
});

describe("GraphExport", () => {
  const node = (id: string) => ({ id, title: id.slice(0, 4), type: "habit", area: "health", createdAt: now });
  const edge = { id: "33333333-3333-4333-8333-333333333333", from: A, to: B, type: "causes", createdAt: now };

  it("принимает целостный граф", () => {
    expect(GraphExport.safeParse({ version: 1, exportedAt: now, nodes: [node(A), node(B)], edges: [edge] }).success).toBe(true);
  });
  it("ловит висячие связи и дубли id", () => {
    expect(GraphExport.safeParse({ version: 1, exportedAt: now, nodes: [node(A)], edges: [edge] }).success).toBe(false);
    expect(GraphExport.safeParse({ version: 1, exportedAt: now, nodes: [node(A), node(A)], edges: [] }).success).toBe(false);
  });
  it("отвергает чужую версию", () => {
    expect(GraphExport.safeParse({ version: 2, exportedAt: now, nodes: [], edges: [] }).success).toBe(false);
  });
});
