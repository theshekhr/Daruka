import type { AiProvider, ExtractionResult, KnowledgeGraphData } from "./types";

// --- Heuristic helpers -----------------------------------------------------

const DECISION_MARKERS = /\b(decided|we'll use|going with|let's use|chose|opted for|will go with)\b/i;
const BUG_MARKERS = /\b(bug|error|exception|crash|broken|doesn't work|isn't working|fails?|failing)\b/i;
const FIX_MARKERS = /\b(fixed|resolved|solved|that worked|works now|fixed it)\b/i;
const TODO_MARKERS = /\b(todo|to-do|need to|should add|next step|action item|will need to)\b/i;
const FEATURE_MARKERS = /\b(add(ed|ing)?|build(ing)?|implement(ed|ing)?|create(d|ing)?)\s+(a|the|an)?\s*\w+/i;
const QUESTION_MARKERS = /\?\s*$/;
const CODE_BLOCK = /```[\s\S]*?```|`[^`\n]+`/g;

function splitIntoTurns(text: string): { speaker: string; content: string }[] {
  const lines = text.split("\n").filter((l) => l.trim());
  const turns: { speaker: string; content: string }[] = [];

  for (const line of lines) {
    const match = line.match(/^(User|Claude|ChatGPT|Gemini|Grok|DeepSeek|Perplexity|AI):\s*(.*)/i);
    if (match) {
      turns.push({ speaker: match[1], content: match[2] });
    } else if (turns.length > 0) {
      // Continuation of the previous turn (wrapped line)
      turns[turns.length - 1].content += " " + line.trim();
    } else {
      turns.push({ speaker: "Unknown", content: line.trim() });
    }
  }

  return turns;
}

function extractByMarker(sentences: string[], marker: RegExp, maxItems = 8): string[] {
  const matches = sentences.filter((s) => marker.test(s));
  return [...new Set(matches.map((s) => s.trim().slice(0, 200)))].slice(0, maxItems);
}

function splitSentences(text: string): string[] {
  return text
    .replace(CODE_BLOCK, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8);
}

function extractCodeSnippets(text: string): string[] {
  const matches = text.match(CODE_BLOCK) || [];
  return matches.slice(0, 6).map((m) => m.replace(/```\w*\n?/g, "").replace(/`/g, "").trim().slice(0, 150));
}

function generateTitle(turns: { speaker: string; content: string }[]): string {
  const firstUserTurn = turns.find((t) => t.speaker.toLowerCase() === "user");
  if (!firstUserTurn) return "Untitled session";
  const words = firstUserTurn.content.trim().split(/\s+/).slice(0, 10).join(" ");
  return words.length > 60 ? words.slice(0, 60) + "..." : words || "Untitled session";
}

function generateSummary(turns: { speaker: string; content: string }[]): string {
  const userTurns = turns.filter((t) => t.speaker.toLowerCase() === "user").map((t) => t.content);
  const joined = userTurns.join(" ").slice(0, 280);
  return joined ? `Conversation covering: ${joined}${joined.length >= 280 ? "..." : ""}` : "No summary available.";
}

function formatConversation(turns: { speaker: string; content: string }[], aiModel: string): string {
  return turns
    .map((t) => {
      const speaker = t.speaker.toLowerCase() === "ai" || t.speaker.toLowerCase() === "unknown" ? aiModel : t.speaker;
      return `${speaker}: ${t.content.trim()}`;
    })
    .filter((line) => line.split(": ")[1]?.length > 0)
    .join("\n");
}

// --- Provider implementation ------------------------------------------------

export const fallbackProvider: AiProvider = {
  name: "Rule-based (no AI)",

  async testKey() {
    // No key needed, always succeeds
    return;
  },

  async extractKnowledge(_apiKey, rawConversation, aiModel) {
    const turns = splitIntoTurns(rawConversation);
    const sentences = splitSentences(rawConversation);

    const extracted = {
      decisions: extractByMarker(sentences, DECISION_MARKERS),
      features: extractByMarker(sentences, FEATURE_MARKERS),
      bugs: extractByMarker(sentences, BUG_MARKERS),
      bugfixes: extractByMarker(sentences, FIX_MARKERS),
      code_snippets: extractCodeSnippets(rawConversation),
      todos: extractByMarker(sentences, TODO_MARKERS),
      ideas: [] as string[],
      architecture: [] as string[],
      research: [] as string[],
      questions: extractByMarker(sentences.filter((s) => QUESTION_MARKERS.test(s)), /./),
    };

    return {
      title: generateTitle(turns),
      summary: generateSummary(turns),
      formatted_conversation: formatConversation(turns, aiModel) || rawConversation,
      extracted,
    } satisfies ExtractionResult;
  },

  async generateSwitchContext(_apiKey, projectName, projectDescription, memoryBlocks) {
    if (memoryBlocks.length === 0) {
      return `PROJECT: ${projectName}\n${
        projectDescription ? `DESCRIPTION: ${projectDescription}\n` : ""
      }\nNo sessions have been saved yet.`;
    }

    const allDecisions = new Set<string>();
    const allFeatures = new Set<string>();
    const allBugs = new Set<string>();
    const allBugfixes = new Set<string>();
    const allTodos = new Set<string>();
    const allCode = new Set<string>();

    for (const m of memoryBlocks) {
      m.extracted_data.decisions?.forEach((d) => allDecisions.add(d));
      m.extracted_data.features?.forEach((f) => allFeatures.add(f));
      m.extracted_data.bugs?.forEach((b) => allBugs.add(b));
      m.extracted_data.bugfixes?.forEach((b) => allBugfixes.add(b));
      m.extracted_data.todos?.forEach((t) => allTodos.add(t));
      m.extracted_data.code_snippets?.forEach((c) => allCode.add(c));
    }

    const section = (label: string, items: Set<string>) =>
      items.size ? `\n### ${label}\n${[...items].map((i) => `- ${i}`).join("\n")}\n` : "";

    return `## PROJECT OVERVIEW
${projectName}${projectDescription ? ` \u2014 ${projectDescription}` : ""}

Generated from ${memoryBlocks.length} saved session${memoryBlocks.length === 1 ? "" : "s"} using rule-based extraction (no AI compression applied \u2014 this is a direct aggregation of captured facts).
${section("KEY DECISIONS", allDecisions)}${section("FEATURES", allFeatures)}${section("KNOWN BUGS", allBugs)}${section("FIXES APPLIED", allBugfixes)}${section("PENDING TODOS", allTodos)}${section("CODE PATTERNS", allCode)}
### SESSION LOG
${memoryBlocks
  .map((m) => `- [${m.ai_model}, ${new Date(m.created_at).toLocaleDateString()}] ${m.title}`)
  .join("\n")}`;
  },

  async updateKnowledgeGraph(_apiKey, existingData, newMemory) {
    const merge = (existing: string[], incoming: string[] | undefined): string[] => {
      const set = new Set(existing);
      (incoming || []).forEach((i) => set.add(i));
      return [...set].slice(0, 30); // cap to avoid unbounded growth
    };

    const result: KnowledgeGraphData = {
      purpose: existingData.purpose, // rule-based extraction can't infer purpose reliably
      tech_stack: existingData.tech_stack,
      decisions: merge(existingData.decisions, newMemory.extracted_data.decisions),
      completed: merge(existingData.completed, newMemory.extracted_data.bugfixes),
      pending: merge(existingData.pending, newMemory.extracted_data.todos),
      blockers: merge(existingData.blockers, newMemory.extracted_data.bugs),
      ideas: existingData.ideas,
      architecture: existingData.architecture,
    };

    return result;
  },
};