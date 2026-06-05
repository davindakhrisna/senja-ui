import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { db } from "../db/index";
import { conversations, messages } from "../db/schema";

export const getConversationsFn = createServerFn({ method: "GET" }).handler(async () => {
  return await db.query.conversations.findMany({
    orderBy: [desc(conversations.updatedAt)],
  });
});

const getMessagesSchema = z.object({ conversationId: z.string() });

export const getMessagesFn = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => getMessagesSchema.parse(input))
  .handler(async ({ data }) => {
    return await db.query.messages.findMany({
      where: eq(messages.conversationId, data.conversationId),
      orderBy: messages.createdAt,
    });
  });

const createConversationSchema = z.object({
  id: z.string(),
  title: z.string(),
});

export const createConversationFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => createConversationSchema.parse(input))
  .handler(async ({ data }) => {
    await db.insert(conversations).values({
      id: data.id,
      title: data.title,
    });
    return { ok: true };
  });

const addMessageSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  role: z.string(),
  content: z.string(),
});

export const addMessageFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => addMessageSchema.parse(input))
  .handler(async ({ data }) => {
    await db.insert(messages).values({
      id: data.id,
      conversationId: data.conversationId,
      role: data.role,
      content: data.content,
    });
    await db
      .update(conversations)
      .set({ updatedAt: new Date() })
      .where(eq(conversations.id, data.conversationId));
    return { ok: true };
  });

const deleteConversationSchema = z.object({ id: z.string() });

export const deleteConversationFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => deleteConversationSchema.parse(input))
  .handler(async ({ data }) => {
    await db.delete(conversations).where(eq(conversations.id, data.id));
    return { ok: true };
  });

const updateConversationTitleSchema = z.object({
  id: z.string(),
  title: z.string(),
});

export const updateConversationTitleFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => updateConversationTitleSchema.parse(input))
  .handler(async ({ data }) => {
    await db
      .update(conversations)
      .set({ title: data.title, updatedAt: new Date() })
      .where(eq(conversations.id, data.id));
    return { ok: true };
  });

const deleteMessageSchema = z.object({ id: z.string() });

export const deleteMessageFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => deleteMessageSchema.parse(input))
  .handler(async ({ data }) => {
    await db.delete(messages).where(eq(messages.id, data.id));
    return { ok: true };
  });
