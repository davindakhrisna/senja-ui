import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import Groq from "groq-sdk";

const messageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string().min(1).max(20000),
});

const inputSchema = z.object({
  messages: z.array(messageSchema).min(1).max(100),
  model: z.string().min(1).max(100).optional(),
});

export const sendChat = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return { ok: false as const, error: "GROQ_API_KEY is not set" };
    }
    const groq = new Groq({ apiKey });
    try {
      const completion = await groq.chat.completions.create({
        model: data.model ?? "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content:
              "You are a helpful, concise AI assistant. Respond using clean markdown when useful.",
          },
          ...data.messages,
        ],
        temperature: 0.7,
      });
      const content = completion.choices[0]?.message?.content ?? "";
      return { ok: true as const, content };
    } catch (err) {
      console.error("Groq error:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      return { ok: false as const, error: message };
    }
  });

const generateTitleSchema = z.object({
  messages: z.array(messageSchema).min(1).max(5),
});

export const generateTitleFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => generateTitleSchema.parse(input))
  .handler(async ({ data }) => {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return { ok: false as const, title: "New Chat" };

    const groq = new Groq({ apiKey });
    try {
      const completion = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant. Generate a short, concise title (maximum 5 words) for the following conversation. Reply ONLY with the title, without any quotes or punctuation.",
          },
          ...data.messages,
        ],
        temperature: 0.5,
        max_tokens: 15,
      });
      const title = completion.choices[0]?.message?.content?.trim() || "New Chat";
      return { ok: true as const, title };
    } catch (err) {
      console.error("Groq generate title error:", err);
      return { ok: false as const, title: "New Chat" };
    }
  });
