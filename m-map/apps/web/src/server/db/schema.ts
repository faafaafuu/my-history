// Схема БД. Мультипользовательская с первого дня: у каждой записи user_id, и
// каждый запрос фильтрует по нему (см. src/server/repo). Открыть регистрацию
// потом — только ALLOW_SIGNUP=true, без миграции.

import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import {
  AREAS,
  EDGE_ORIGINS,
  EDGE_TYPES,
  NODE_STATUSES,
  NODE_TYPES,
  REMINDER_CHANNELS,
  SUGGESTION_STATUSES,
} from "@m-map/core";

export const nodeType = pgEnum("node_type", NODE_TYPES);
export const nodeStatus = pgEnum("node_status", NODE_STATUSES);
export const lifeArea = pgEnum("life_area", AREAS);
export const edgeType = pgEnum("edge_type", EDGE_TYPES);
export const edgeOrigin = pgEnum("edge_origin", EDGE_ORIGINS);
export const suggestionStatus = pgEnum("suggestion_status", SUGGESTION_STATUSES);
export const reminderChannel = pgEnum("reminder_channel", REMINDER_CHANNELS);

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const owner = () =>
  uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" });

/* ── Аккаунты ─────────────────────────────────────────────────────────────── */

export const users = pgTable(
  "users",
  {
    id: id(),
    email: text("email").notNull(),
    name: text("name").notNull().default(""),
    /** `scrypt$<salt b64>$<key b64>` — как в asis. */
    pass: text("pass").notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("users_email_lower").on(sql`lower(${t.email})`)],
);

/** Сессии браузера: в БД только sha256 токена, сам токен — в HttpOnly-cookie. */
export const sessions = pgTable(
  "sessions",
  {
    hash: text("hash").primaryKey(),
    userId: owner(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user").on(t.userId)],
);

/** Ключи для приложений (iOS) и подписки на календарь: `mm_…`, в БД — sha256. */
export const apiTokens = pgTable(
  "api_tokens",
  {
    id: id(),
    userId: owner(),
    label: text("label").notNull(),
    hash: text("hash").notNull().unique(),
    createdAt: createdAt(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  },
  (t) => [index("api_tokens_user").on(t.userId)],
);

/* ── Граф ─────────────────────────────────────────────────────────────────── */

export const nodes = pgTable(
  "nodes",
  {
    id: id(),
    userId: owner(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    type: nodeType("type").notNull(),
    area: lifeArea("area").notNull(),
    valence: real("valence").notNull().default(0),
    status: nodeStatus("status").notNull().default("idea"),
    frequency: text("frequency"),
    x: real("x"),
    y: real("y"),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("nodes_user").on(t.userId),
    check("nodes_valence_range", sql`${t.valence} between -1 and 1`),
  ],
);

export const edges = pgTable(
  "edges",
  {
    id: id(),
    userId: owner(),
    fromId: uuid("from_id")
      .notNull()
      .references(() => nodes.id, { onDelete: "cascade" }),
    toId: uuid("to_id")
      .notNull()
      .references(() => nodes.id, { onDelete: "cascade" }),
    type: edgeType("type").notNull(),
    weight: real("weight").notNull().default(0.5),
    lagDays: integer("lag_days").notNull().default(0),
    confidence: real("confidence").notNull().default(1),
    origin: edgeOrigin("origin").notNull().default("user"),
    createdAt: createdAt(),
  },
  (t) => [
    index("edges_user").on(t.userId),
    uniqueIndex("edges_unique").on(t.userId, t.fromId, t.toId, t.type),
    check("edges_no_loop", sql`${t.fromId} <> ${t.toId}`),
    check("edges_weight_range", sql`${t.weight} between 0 and 1`),
    check("edges_confidence_range", sql`${t.confidence} between 0 and 1`),
  ],
);

export const suggestions = pgTable(
  "suggestions",
  {
    id: id(),
    userId: owner(),
    parentNodeId: uuid("parent_node_id")
      .notNull()
      .references(() => nodes.id, { onDelete: "cascade" }),
    payload: jsonb("payload").notNull(),
    status: suggestionStatus("status").notNull().default("pending"),
    createdAt: createdAt(),
  },
  (t) => [index("suggestions_user_parent").on(t.userId, t.parentNodeId)],
);

/* ── Задачи и напоминания ─────────────────────────────────────────────────── */

export const tasks = pgTable(
  "tasks",
  {
    id: id(),
    userId: owner(),
    nodeId: uuid("node_id").references(() => nodes.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    due: timestamp("due", { withTimezone: true }),
    recurrence: text("recurrence"),
    done: boolean("done").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("tasks_user_due").on(t.userId, t.due)],
);

export const reminders = pgTable(
  "reminders",
  {
    id: id(),
    userId: owner(),
    taskId: uuid("task_id").references(() => tasks.id, { onDelete: "cascade" }),
    nodeId: uuid("node_id").references(() => nodes.id, { onDelete: "cascade" }),
    fireAt: timestamp("fire_at", { withTimezone: true }).notNull(),
    channel: reminderChannel("channel").notNull().default("push"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("reminders_due").on(t.fireAt).where(sql`${t.sentAt} is null`),
    index("reminders_user").on(t.userId),
    check("reminders_target", sql`${t.taskId} is not null or ${t.nodeId} is not null`),
  ],
);

export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: id(),
    userId: owner(),
    endpoint: text("endpoint").notNull().unique(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("push_subscriptions_user").on(t.userId)],
);

/* ── Отметки самочувствия (v2-корреляции) ─────────────────────────────────── */

export const checkIns = pgTable(
  "check_ins",
  {
    id: id(),
    userId: owner(),
    date: date("date").notNull(),
    mood: integer("mood").notNull(),
    sleep: real("sleep"),
    energy: integer("energy"),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("check_ins_user_date").on(t.userId, t.date),
    check("check_ins_mood_range", sql`${t.mood} between 1 and 10`),
  ],
);
