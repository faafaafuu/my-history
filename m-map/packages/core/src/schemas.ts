import { z } from "zod";
import { AREAS } from "./areas";

/* ── Перечисления ─────────────────────────────────────────────────────────── */

export const NODE_TYPES = ["habit", "plan", "state", "outcome", "area", "event"] as const;
export const NODE_STATUSES = ["idea", "active", "rejected", "done"] as const;
export const EDGE_TYPES = ["causes", "worsens", "improves", "blocks", "requires"] as const;
export const EDGE_ORIGINS = ["user", "ai"] as const;
export const SUGGESTION_STATUSES = ["pending", "accepted", "dismissed"] as const;
export const REMINDER_CHANNELS = ["push", "ics"] as const;
export const HORIZONS = ["days", "months", "years"] as const;

export const NodeType = z.enum(NODE_TYPES);
export const NodeStatus = z.enum(NODE_STATUSES);
export const EdgeType = z.enum(EDGE_TYPES);
export const EdgeOrigin = z.enum(EDGE_ORIGINS);
export const SuggestionStatus = z.enum(SUGGESTION_STATUSES);
export const ReminderChannel = z.enum(REMINDER_CHANNELS);
export const Horizon = z.enum(HORIZONS);
export const AreaSchema = z.enum(AREAS);

export type NodeType = z.infer<typeof NodeType>;
export type NodeStatus = z.infer<typeof NodeStatus>;
export type EdgeType = z.infer<typeof EdgeType>;
export type EdgeOrigin = z.infer<typeof EdgeOrigin>;
export type Horizon = z.infer<typeof Horizon>;

/* ── Общие поля ───────────────────────────────────────────────────────────── */

export const Id = z.uuid();
const Valence = z.number().min(-1).max(1);
const Unit = z.number().min(0).max(1);
const Title = z.string().trim().min(1).max(200);
const Description = z.string().trim().max(4000);
const IsoDate = z.iso.datetime({ offset: true });

/* ── Узел ─────────────────────────────────────────────────────────────────── */

export const NodeSchema = z.object({
  id: Id,
  title: Title,
  description: Description.default(""),
  type: NodeType,
  area: AreaSchema,
  valence: Valence.default(0),
  status: NodeStatus.default("idea"),
  /** Свободная форма: «ежедневно», «2 раза в неделю». Точное расписание — у задач (rrule). */
  frequency: z.string().trim().max(100).nullable().default(null),
  /** Позиция на холсте; null — раскладка решит сама. */
  x: z.number().nullable().default(null),
  y: z.number().nullable().default(null),
  createdAt: IsoDate,
});
export type LifeNode = z.infer<typeof NodeSchema>;

export const NodeCreate = NodeSchema.omit({ id: true, createdAt: true }).extend({ id: Id.optional() });
export const NodeUpdate = NodeCreate.omit({ id: true }).partial();
export type NodeCreate = z.input<typeof NodeCreate>;
export type NodeUpdate = z.input<typeof NodeUpdate>;

/* ── Связь ────────────────────────────────────────────────────────────────── */

export const EdgeSchema = z.object({
  id: Id,
  from: Id,
  to: Id,
  type: EdgeType,
  weight: Unit.default(0.5),
  lagDays: z.number().int().min(0).max(36500).default(0),
  confidence: Unit.default(1),
  origin: EdgeOrigin.default("user"),
  createdAt: IsoDate,
});
export type LifeEdge = z.infer<typeof EdgeSchema>;

const noSelfLoop = <T extends { from?: string; to?: string }>(edge: T) => edge.from === undefined || edge.from !== edge.to;

export const EdgeCreate = EdgeSchema.omit({ id: true, createdAt: true })
  .extend({ id: Id.optional() })
  .refine(noSelfLoop, { message: "Связь узла с самим собой", path: ["to"] });
export const EdgeUpdate = EdgeSchema.pick({ type: true, weight: true, lagDays: true, confidence: true }).partial();
export type EdgeCreate = z.input<typeof EdgeCreate>;

/* ── Ответы LLM ───────────────────────────────────────────────────────────── */

/** Кандидат из expand_node. `linksTo` — id существующих узлов: если кандидат дублирует узел, он там. */
export const ExpandCandidate = z.object({
  title: Title,
  type: NodeType,
  area: AreaSchema,
  valence: Valence,
  probability: Unit,
  horizon: Horizon,
  edgeType: EdgeType,
  weight: Unit,
  rationale: z.string().trim().max(600),
  /** Если кандидат — уже существующий узел, его id: создавать не нужно, только ребро. */
  mergeWith: Id.nullable().default(null),
  linksTo: z.array(Id).max(10).default([]),
});
export type ExpandCandidate = z.infer<typeof ExpandCandidate>;
export const ExpandResult = z.object({ candidates: z.array(ExpandCandidate).min(1).max(8) });

export const LinkProposal = z.object({
  from: Id,
  to: Id,
  type: EdgeType,
  weight: Unit,
  confidence: Unit,
  rationale: z.string().trim().max(400),
});
export const LinkResult = z.object({ edges: z.array(LinkProposal).max(20) });

export const ScenarioSummary = z.object({
  points: z.array(z.string().trim().min(1).max(400)).min(1).max(5),
});

/* ── Подсказка ────────────────────────────────────────────────────────────── */

export const SuggestionPayload = z.object({ candidate: ExpandCandidate });
export const SuggestionSchema = z.object({
  id: Id,
  parentNodeId: Id,
  payload: SuggestionPayload,
  status: SuggestionStatus,
  createdAt: IsoDate,
});
export type Suggestion = z.infer<typeof SuggestionSchema>;

/* ── Задачи, напоминания, отметки ─────────────────────────────────────────── */

export const TaskSchema = z.object({
  id: Id,
  nodeId: Id.nullable(),
  title: Title,
  due: IsoDate.nullable().default(null),
  /** RFC 5545 RRULE без префикса, например `FREQ=WEEKLY;BYDAY=TU,FR`. */
  recurrence: z
    .string()
    .trim()
    .max(500)
    .regex(/^FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)(;[A-Z]+=[A-Z0-9,+-]+)*$/, "Ожидается RRULE: FREQ=…")
    .nullable()
    .default(null),
  done: z.boolean().default(false),
  createdAt: IsoDate,
});
export type Task = z.infer<typeof TaskSchema>;
export const TaskCreate = TaskSchema.omit({ id: true, createdAt: true });

export const ReminderSchema = z
  .object({
    id: Id,
    taskId: Id.nullable().default(null),
    nodeId: Id.nullable().default(null),
    fireAt: IsoDate,
    channel: ReminderChannel,
    createdAt: IsoDate,
  })
  .refine((r) => r.taskId !== null || r.nodeId !== null, { message: "Нужен taskId или nodeId" });
export type Reminder = z.infer<typeof ReminderSchema>;

export const CheckInSchema = z.object({
  id: Id,
  date: z.iso.date(),
  mood: z.number().int().min(1).max(10),
  sleep: z.number().min(0).max(24).nullable().default(null),
  energy: z.number().int().min(1).max(10).nullable().default(null),
  note: z.string().trim().max(2000).nullable().default(null),
});
export type CheckIn = z.infer<typeof CheckInSchema>;

/* ── Импорт/экспорт ───────────────────────────────────────────────────────── */

export const GRAPH_EXPORT_VERSION = 1;

export const GraphExport = z
  .object({
    version: z.literal(GRAPH_EXPORT_VERSION),
    exportedAt: IsoDate,
    nodes: z.array(NodeSchema).max(10_000),
    edges: z.array(EdgeSchema).max(50_000),
    tasks: z.array(TaskSchema).default([]),
    checkIns: z.array(CheckInSchema).default([]),
  })
  .superRefine((data, ctx) => {
    const ids = new Set(data.nodes.map((n) => n.id));
    if (ids.size !== data.nodes.length) ctx.addIssue({ code: "custom", message: "Повторяющиеся id узлов", path: ["nodes"] });
    data.edges.forEach((edge, i) => {
      if (!ids.has(edge.from) || !ids.has(edge.to)) {
        ctx.addIssue({ code: "custom", message: "Связь ссылается на несуществующий узел", path: ["edges", i] });
      }
    });
  });
export type GraphExport = z.infer<typeof GraphExport>;
