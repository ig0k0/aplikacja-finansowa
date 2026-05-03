import { z } from "zod";

export const aiCategorizationResponseSchema = z.object({
  categoryId: z.string().min(1),
  categoryPath: z.array(z.string()).optional(),
  description: z.string().max(500).optional(),
  tags: z.array(z.string().max(40)).max(10).optional(),
  confidence: z.number().min(0).max(1),
  needsManualReview: z.boolean(),
  reasonCode: z.string().max(80).optional(),
});

export type AiCategorizationResponse = z.infer<typeof aiCategorizationResponseSchema>;

export function extractJsonObjectFromModelText(content: string) {
  const trimmed = content.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)```$/i.exec(trimmed);
  const payload = fence ? fence[1]!.trim() : trimmed;
  return JSON.parse(payload) as unknown;
}
