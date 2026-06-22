import type { ExtractedData } from "../types";

export type ExtractionResult = {
  title: string;
  summary: string;
  extracted: ExtractedData;
  formatted_conversation: string;
};

export type KnowledgeGraphData = {
  purpose: string[];
  tech_stack: string[];
  decisions: string[];
  completed: string[];
  pending: string[];
  blockers: string[];
  ideas: string[];
  architecture: string[];
};

export interface AiProvider {
  name: string;
  extractKnowledge(apiKey: string, rawConversation: string, aiModel: string): Promise<ExtractionResult>;
  generateSwitchContext(
    apiKey: string,
    projectName: string,
    projectDescription: string,
    memoryBlocks: Array<{
      title: string;
      summary: string;
      extracted_data: ExtractedData;
      ai_model: string;
      created_at: string;
    }>
  ): Promise<string>;
  updateKnowledgeGraph(
    apiKey: string,
    existingData: KnowledgeGraphData,
    newMemory: { title: string; summary: string; extracted_data: ExtractedData }
  ): Promise<KnowledgeGraphData>;
  testKey(apiKey: string): Promise<void>; // throws if invalid
}

export const EMPTY_KNOWLEDGE: KnowledgeGraphData = {
  purpose: [],
  tech_stack: [],
  decisions: [],
  completed: [],
  pending: [],
  blockers: [],
  ideas: [],
  architecture: [],
};