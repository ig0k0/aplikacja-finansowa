export type AiMode = "disabled" | "local" | "external";

export type AiRuntimeConfig = {
  mode: AiMode;
  baseUrl: string;
  model: string;
  apiKey: string;
  autoThreshold: number;
  reviewThreshold: number;
};

function parseMode(raw: string | undefined): AiMode {
  const value = (raw ?? "disabled").toLowerCase();
  if (value === "local" || value === "external") {
    return value;
  }
  return "disabled";
}

export function getAiRuntimeConfig(): AiRuntimeConfig {
  const mode = parseMode(process.env.AI_MODE);
  const baseUrl = (process.env.AI_BASE_URL ?? "http://127.0.0.1:11434/v1").replace(/\/$/, "");
  const model = process.env.AI_MODEL ?? "llama3.2";
  const apiKey = process.env.AI_API_KEY ?? "";
  const autoThreshold = Number(process.env.AI_CONFIDENCE_AUTO ?? "0.85");
  const reviewThreshold = Number(process.env.AI_CONFIDENCE_REVIEW ?? "0.6");

  return {
    mode,
    baseUrl,
    model,
    apiKey,
    autoThreshold: Number.isFinite(autoThreshold) ? autoThreshold : 0.85,
    reviewThreshold: Number.isFinite(reviewThreshold) ? reviewThreshold : 0.6,
  };
}

export function isAiEnabled(config: AiRuntimeConfig) {
  return config.mode !== "disabled";
}
