import type { LLMProvider } from "./types";
import { BedrockProvider } from "./providers/bedrock";

const providers = new Map<string, LLMProvider>();

function registerProvider(provider: LLMProvider) {
  providers.set(provider.id, provider);
}

registerProvider(new BedrockProvider());

export function getProvider(idOrModel?: string | null): LLMProvider {
  if (idOrModel) {
    if (providers.has(idOrModel)) return providers.get(idOrModel)!;
    for (const p of Array.from(providers.values())) {
      if (p.models.some((m) => m.toLowerCase() === idOrModel.toLowerCase())) {
        return p;
      }
    }
  }

  return providers.get("bedrock")!;
}

export const INTERVIEW_MODEL = "global.anthropic.claude-sonnet-4-6";
export const EVALUATION_MODEL = "global.anthropic.claude-sonnet-4-6";
export const GENERATION_MODEL = "global.anthropic.claude-sonnet-4-6";
