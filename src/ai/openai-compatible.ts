import type { AiRuntimeConfig } from "@/lib/ai-config";

/** Bez limitu czasu zawieszony model blokowalby zadanie uzytkownika w nieskonczonosc. */
const AI_REQUEST_TIMEOUT_MS = 30_000;

export async function completeChatText(
  config: AiRuntimeConfig,
  system: string,
  userMessage: string,
) {
  const url = `${config.baseUrl}/chat/completions`;
  const headers: Record<string, string> = { "Content-Type": "application/json" };

  if (config.apiKey) {
    headers.Authorization = `Bearer ${config.apiKey}`;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: config.model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: userMessage },
      ],
      temperature: 0.1,
    }),
    signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`AI HTTP ${res.status}: ${detail.slice(0, 240)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };

  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("Pusta odpowiedz modelu.");
  }

  return content;
}
