import type { MemoryBlock, KnowledgeData } from "./types";

export type GraphNode = {
  id: string;
  label: string;
  type: "memory" | "fact";
  category?: string; // for facts: purpose, tech_stack, decisions, etc. for memories: ai_model
  size: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
};

export type GraphLink = {
  source: string;
  target: string;
};

export type GraphData = {
  nodes: GraphNode[];
  links: GraphLink[];
};

const FACT_CATEGORIES: { key: keyof KnowledgeData; label: string }[] = [
  { key: "purpose", label: "Purpose" },
  { key: "tech_stack", label: "Tech" },
  { key: "decisions", label: "Decision" },
  { key: "completed", label: "Completed" },
  { key: "pending", label: "Pending" },
  { key: "blockers", label: "Blocker" },
  { key: "ideas", label: "Idea" },
  { key: "architecture", label: "Architecture" },
];

// Crude but effective: a fact "belongs" to a memory if the memory's own
// extracted_data contains a closely matching string, or the fact text
// shares enough significant words with the memory's title/summary/extracted data.
function factBelongsToMemory(factText: string, memory: MemoryBlock): boolean {
  const haystack = JSON.stringify(memory.extracted_data).toLowerCase();
  const factLower = factText.toLowerCase();

  if (haystack.includes(factLower.slice(0, 40))) return true;

  const significantWords = factLower
    .split(/\s+/)
    .filter((w) => w.length > 4)
    .slice(0, 6);
  if (significantWords.length === 0) return false;

  const matchCount = significantWords.filter((w) => haystack.includes(w)).length;
  return matchCount >= Math.min(2, significantWords.length);
}

export function buildGraph(
  memories: MemoryBlock[],
  knowledge: KnowledgeData | null,
  width: number,
  height: number
): GraphData {
  const nodes: GraphNode[] = [];
  const links: GraphLink[] = [];
  const centerX = width / 2;
  const centerY = height / 2;

  memories.forEach((memory, i) => {
    const angle = (i / Math.max(memories.length, 1)) * Math.PI * 2;
    const radius = Math.min(width, height) * 0.25;
    nodes.push({
      id: `memory:${memory.id}`,
      label: memory.title,
      type: "memory",
      category: memory.ai_model,
      size: 14,
      x: centerX + Math.cos(angle) * radius + (Math.random() - 0.5) * 40,
      y: centerY + Math.sin(angle) * radius + (Math.random() - 0.5) * 40,
      vx: 0,
      vy: 0,
    });
  });

  if (knowledge) {
    let factIndex = 0;
    const allFacts: { id: string; text: string; category: string }[] = [];

    FACT_CATEGORIES.forEach(({ key, label }) => {
      const items = knowledge[key] || [];
      items.forEach((text, i) => {
        allFacts.push({ id: `fact:${key}:${i}`, text, category: label });
      });
    });

    allFacts.forEach((fact) => {
      const angle = (factIndex / Math.max(allFacts.length, 1)) * Math.PI * 2 + Math.PI / allFacts.length;
      const radius = Math.min(width, height) * 0.42;
      nodes.push({
        id: fact.id,
        label: fact.text,
        type: "fact",
        category: fact.category,
        size: 6,
        x: centerX + Math.cos(angle) * radius + (Math.random() - 0.5) * 30,
        y: centerY + Math.sin(angle) * radius + (Math.random() - 0.5) * 30,
        vx: 0,
        vy: 0,
      });
      factIndex++;

      // Link this fact to every memory that plausibly contributed it
      memories.forEach((memory) => {
        if (factBelongsToMemory(fact.text, memory)) {
          links.push({ source: `memory:${memory.id}`, target: fact.id });
        }
      });
    });
  }

  // Ensure every fact has at least one connection (to the nearest memory by
  // creation order) so isolated nodes don't drift away with no anchor at all
  const connectedFactIds = new Set(links.map((l) => l.target));
  nodes
    .filter((n) => n.type === "fact" && !connectedFactIds.has(n.id))
    .forEach((factNode, i) => {
      const fallbackMemory = memories[i % Math.max(memories.length, 1)];
      if (fallbackMemory) {
        links.push({ source: `memory:${fallbackMemory.id}`, target: factNode.id });
      }
    });

  return { nodes, links };
}