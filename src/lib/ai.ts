import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { BilingualText } from "@/db/schema";
import { countActivitySince } from "@/lib/activity";
import { env, hasAI } from "@/lib/env";

const CaptionSchema = z.object({
  caption_en: z.string(),
  caption_id: z.string(),
  tags: z.array(z.string()),
});

const PROMPT = [
  "This photo comes from a private family memories album of an Indonesian family.",
  "Write one warm, factual caption of at most 18 words describing what is visible, in English (caption_en) and in natural, casual Bahasa Indonesia (caption_id).",
  "Never guess names, ages or identities of people.",
  "Add up to 10 short lowercase English search tags about the scene, place type, objects, food, activity or occasion.",
].join(" ");

let client: Anthropic | null = null;

export async function captionImage(webpImage: Buffer): Promise<{ caption: BilingualText; tags: string[] } | null> {
  if (!hasAI()) return null;

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  if ((await countActivitySince("ai.caption", startOfDay)) >= env.aiDailyCaptionLimit) return null;

  client ??= new Anthropic({ apiKey: env.anthropicApiKey });
  const response = await client.messages.parse({
    model: "claude-haiku-4-5",
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/webp", data: webpImage.toString("base64") } },
          { type: "text", text: PROMPT },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(CaptionSchema) },
  });

  const parsed = response.parsed_output;
  if (!parsed) return null;
  return {
    caption: { en: parsed.caption_en.trim(), id: parsed.caption_id.trim() },
    tags: [...new Set(parsed.tags.map((t) => t.trim().toLowerCase()).filter(Boolean))].slice(0, 10),
  };
}
