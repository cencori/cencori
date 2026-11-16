import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Plain chats: talking with Tensor outside any project (database/brimble/2100_tensor_chats.sql).
 *
 * A project's chat runs in its sandbox and keeps its conversation there. A plain chat has no
 * sandbox, so its messages are kept here, and each answer is one model call through Cencori,
 * billed by what it costs against the plan's monthly ceiling, not as a task.
 */

export type PlainChatRow = {
  id: string;
  user_id: string;
  title: string | null;
  project_task_id: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PlainChatMessageRow = {
  id: string;
  chat_id: string;
  role: "user" | "assistant";
  content: string;
  status: "complete" | "stopped" | "failed";
  model: string | null;
  created_at: string;
};

/** How many chats a list returns; the sidebar shows the most recent. */
export const PLAIN_CHAT_LIST_LIMIT = 200;
/** A message the user sends, at most. */
export const PLAIN_CHAT_MESSAGE_MAX = 32_000;
/** How much of the conversation goes back to the model with each message, newest first. */
const CONTEXT_MESSAGES = 40;
const CONTEXT_CHARACTERS = 120_000;

const CHAT_COLUMNS = "id, user_id, title, project_task_id, archived_at, created_at, updated_at";
const MESSAGE_COLUMNS = "id, chat_id, role, content, status, model, created_at";

export function plainChatJson(row: PlainChatRow) {
  return {
    id: row.id,
    title: row.title,
    projectTaskId: row.project_task_id,
    archivedAt: row.archived_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function plainMessageJson(row: PlainChatMessageRow) {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function listPlainChats(admin: SupabaseClient, userId: string): Promise<PlainChatRow[]> {
  const { data, error } = await admin
    .from("tensor_chats")
    .select(CHAT_COLUMNS)
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(PLAIN_CHAT_LIST_LIMIT);
  if (error) throw error;
  return (data ?? []) as PlainChatRow[];
}

export async function readPlainChat(
  admin: SupabaseClient,
  userId: string,
  chatId: string,
): Promise<PlainChatRow | null> {
  if (!isUuid(chatId)) return null;
  const { data, error } = await admin
    .from("tensor_chats")
    .select(CHAT_COLUMNS)
    .eq("id", chatId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as PlainChatRow | null) ?? null;
}

export async function createPlainChat(
  admin: SupabaseClient,
  userId: string,
  title: string | null,
): Promise<PlainChatRow> {
  const { data, error } = await admin
    .from("tensor_chats")
    .insert({ user_id: userId, title })
    .select(CHAT_COLUMNS)
    .single();
  if (error) throw error;
  return data as PlainChatRow;
}

export async function updatePlainChat(
  admin: SupabaseClient,
  chatId: string,
  change: { title?: string; archived?: boolean; touch?: boolean },
): Promise<void> {
  const fields: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (change.title !== undefined) fields.title = change.title;
  if (change.archived !== undefined) fields.archived_at = change.archived ? new Date().toISOString() : null;
  const { error } = await admin.from("tensor_chats").update(fields).eq("id", chatId);
  if (error) throw error;
}

export async function deletePlainChat(admin: SupabaseClient, chatId: string): Promise<void> {
  const { error } = await admin.from("tensor_chats").delete().eq("id", chatId);
  if (error) throw error;
}

export async function readPlainMessages(
  admin: SupabaseClient,
  chatId: string,
): Promise<PlainChatMessageRow[]> {
  const { data, error } = await admin
    .from("tensor_chat_messages")
    .select(MESSAGE_COLUMNS)
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true })
    .limit(1000);
  if (error) throw error;
  return (data ?? []) as PlainChatMessageRow[];
}

export async function addPlainMessage(
  admin: SupabaseClient,
  message: {
    chatId: string;
    userId: string;
    role: "user" | "assistant";
    content: string;
    status?: "complete" | "stopped" | "failed";
    model?: string | null;
  },
): Promise<PlainChatMessageRow> {
  const { data, error } = await admin
    .from("tensor_chat_messages")
    .insert({
      chat_id: message.chatId,
      user_id: message.userId,
      role: message.role,
      content: message.content,
      status: message.status ?? "complete",
      model: message.model ?? null,
    })
    .select(MESSAGE_COLUMNS)
    .single();
  if (error) throw error;
  return data as PlainChatMessageRow;
}

/** A chat's name from its first message: its first line, cut to a sidebar's width. */
export function titleFromMessage(text: string): string {
  const line = text.trim().split("\n")[0]?.replace(/\s+/g, " ").trim() ?? "";
  if (line.length <= 60) return line || "New chat";
  return `${line.slice(0, 57).trimEnd()}…`;
}

export type ProjectSummary = { name: string; published: boolean };

/**
 * What Tensor is told about itself in a plain chat. It is a conversation, not a build: there is no
 * computer here to run anything on, so building happens in a project, and it says so when the talk
 * turns that way.
 */
export function plainChatInstructions(projects: ProjectSummary[], today: Date): string {
  const list = projects.length
    ? projects.map((project) => `- ${project.name}${project.published ? " (published)" : ""}`).join("\n")
    : "None yet.";
  return [
    "You are Tensor, made by Cencori. You build software for people, and you are also good company for thinking: answering questions, explaining, writing, planning, and brainstorming ideas.",
    "",
    "This is a plain chat, outside any project. Here you can talk, think and write, but you cannot run code, edit files, or build, preview or publish anything: that happens inside a project, where Tensor has a computer of its own for it.",
    "",
    "When a conversation turns into something to build (an app, a site, a tool), say so once, briefly, and offer to start it: the person creates a project from the sidebar (the + beside Projects) and builds inside it. Do not push; only offer when it is clearly where the talk is going, and not again if they decline.",
    "",
    "Their projects:",
    list,
    "",
    "Write in plain, warm, direct language. Use Markdown where it helps (lists, headings for long answers, code blocks with a language). Keep answers as short as the question allows.",
    `Today is ${today.toISOString().slice(0, 10)}.`,
  ].join("\n");
}

/** The conversation to send, newest messages kept first when it is long. */
export function contextMessages(
  messages: Pick<PlainChatMessageRow, "role" | "content" | "status">[],
): { role: "user" | "assistant"; content: string }[] {
  const kept: { role: "user" | "assistant"; content: string }[] = [];
  let characters = 0;
  for (let index = messages.length - 1; index >= 0 && kept.length < CONTEXT_MESSAGES; index -= 1) {
    const message = messages[index];
    if (!message.content) continue;
    characters += message.content.length;
    if (characters > CONTEXT_CHARACTERS && kept.length > 0) break;
    kept.unshift({ role: message.role, content: message.content });
  }
  // A conversation sent to a model starts with the person, not with an answer.
  while (kept[0]?.role === "assistant") kept.shift();
  return kept;
}

export function isUuid(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}
