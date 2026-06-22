import { geminiProvider } from "./gemini";
import { groqProvider } from "./groq";
import { fallbackProvider } from "./fallback";
import type { AiProvider, ExtractionResult, KnowledgeGraphData } from "./types";

export type ProviderName = "gemini" | "groq";

export function getProvider(name: ProviderName | string): AiProvider {
  if (name === "groq") return groqProvider;
  return geminiProvider;
}

export type UserProviderConfig = {
  preferredProvider: ProviderName;
  geminiKey: string | null;
  groqKey: string | null;
};

function keyFor(config: UserProviderConfig, provider: ProviderName): string | null {
  return provider === "groq" ? config.groqKey : config.geminiKey;
}

// Tries the user's preferred provider first. If it fails (rate limit, invalid key,
// network error, etc.), tries the other configured provider. If both fail or neither
// is configured, falls back to the rule-based extractor so the save never hard-fails.
export async function extractWithFallback(
  config: UserProviderConfig,
  rawConversation: string,
  aiModel: string
): Promise<{ result: ExtractionResult; providerUsed: string; degraded: boolean }> {
  const order: ProviderName[] = config.preferredProvider === "groq" ? ["groq", "gemini"] : ["gemini", "groq"];

  for (const providerName of order) {
    const key = keyFor(config, providerName);
    if (!key) continue;

    try {
      const provider = getProvider(providerName);
      const result = await provider.extractKnowledge(key, rawConversation, aiModel);
      return { result, providerUsed: provider.name, degraded: false };
    } catch (err) {
      console.error(`[${providerName}] extraction failed, trying next option:`, err instanceof Error ? err.message : err);
      continue;
    }
  }

  // Nothing configured or everything failed — use the rule-based fallback
  const result = await fallbackProvider.extractKnowledge("", rawConversation, aiModel);
  return { result, providerUsed: fallbackProvider.name, degraded: true };
}

export async function generateSwitchContextWithFallback(
  config: UserProviderConfig,
  projectName: string,
  projectDescription: string,
  memoryBlocks: Array<{
    title: string;
    summary: string;
    extracted_data: ExtractionResult["extracted"];
    ai_model: string;
    created_at: string;
  }>
): Promise<{ context: string; providerUsed: string; degraded: boolean }> {
  const order: ProviderName[] = config.preferredProvider === "groq" ? ["groq", "gemini"] : ["gemini", "groq"];

  for (const providerName of order) {
    const key = keyFor(config, providerName);
    if (!key) continue;

    try {
      const provider = getProvider(providerName);
      const context = await provider.generateSwitchContext(key, projectName, projectDescription, memoryBlocks);
      return { context, providerUsed: provider.name, degraded: false };
    } catch (err) {
      console.error(`[${providerName}] switch-context failed, trying next option:`, err instanceof Error ? err.message : err);
      continue;
    }
  }

  const context = await fallbackProvider.generateSwitchContext("", projectName, projectDescription, memoryBlocks);
  return { context, providerUsed: fallbackProvider.name, degraded: true };
}

export async function updateKnowledgeGraphWithFallback(
  config: UserProviderConfig,
  existingData: KnowledgeGraphData,
  newMemory: { title: string; summary: string; extracted_data: ExtractionResult["extracted"] }
): Promise<{ data: KnowledgeGraphData; degraded: boolean }> {
  const order: ProviderName[] = config.preferredProvider === "groq" ? ["groq", "gemini"] : ["gemini", "groq"];

  for (const providerName of order) {
    const key = keyFor(config, providerName);
    if (!key) continue;

    try {
      const provider = getProvider(providerName);
      const data = await provider.updateKnowledgeGraph(key, existingData, newMemory);
      return { data, degraded: false };
    } catch (err) {
      console.error(`[${providerName}] knowledge graph update failed, trying next option:`, err instanceof Error ? err.message : err);
      continue;
    }
  }

  const data = await fallbackProvider.updateKnowledgeGraph("", existingData, newMemory);
  return { data, degraded: true };
}