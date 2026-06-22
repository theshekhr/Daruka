import type { AiProvider, ExtractionResult, KnowledgeGraphData } from "./types";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

function safeParseJson(text: string) {
  let cleaned = text.replace(/```json|```/g, "").trim();

  // Llama-family models via Groq sometimes emit raw control characters
  // (literal newlines/tabs) inside JSON string values instead of escaping
  // them as \n / \t. JSON.parse is strict about this and throws on them.
  // Walk the string and escape any raw control char that falls *inside*
  // a string literal, leaving structural whitespace (between tokens) alone.
  let result = "";
  let insideString = false;
  let escaped = false;

  for (let i = 0; i < cleaned.length; i++) {
    const char = cleaned[i];

    if (escaped) {
      result += char;
      escaped = false;
      continue;
    }

    if (char === "\\") {
      result += char;
      escaped = true;
      continue;
    }

    if (char === '"') {
      insideString = !insideString;
      result += char;
      continue;
    }

    if (insideString) {
      if (char === "\n") {
        result += "\\n";
        continue;
      }
      if (char === "\r") {
        result += "\\r";
        continue;
      }
      if (char === "\t") {
        result += "\\t";
        continue;
      }
    }

    result += char;
  }

  return JSON.parse(result);
}

async function callGroq(apiKey: string, prompt: string): Promise<string> {
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error?.message || `Groq request failed (${res.status})`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
}

export const groqProvider: AiProvider = {
  name: "Groq",

  async testKey(apiKey: string) {
    await callGroq(apiKey, "Say 'ok' and nothing else.");
  },

  async extractKnowledge(apiKey, rawConversation, aiModel) {
    const prompt = `You are a knowledge extraction AI. Analyze this AI conversation and extract structured information.

Return ONLY valid JSON with this exact structure, no other text, no markdown backticks. CRITICAL: any newlines inside string values must be escaped as \\n, never a literal line break.
{
  "title": "short descriptive title of what was accomplished (max 10 words)",
  "summary": "2-3 sentence summary of the conversation, all on one line with \\n for any breaks",
  "formatted_conversation": "the conversation rewritten as clean turns, separated by \\n, formatted exactly as 'User: ...' and '${aiModel}: ...' alternating. Strip out any page noise, UI labels, timestamps, sidebar content, or unrelated browser extension text. Preserve the actual dialogue's wording faithfully, do not summarize it.",
  "extracted": {
    "decisions": ["list of decisions made"],
    "features": ["list of features discussed or built"],
    "bugs": ["list of bugs discovered"],
    "bugfixes": ["list of bugs fixed"],
    "code_snippets": ["important code patterns mentioned, described briefly, no literal newlines"],
    "todos": ["action items and todos"],
    "ideas": ["ideas discussed"],
    "architecture": ["architecture decisions"],
    "research": ["research findings"],
    "questions": ["open questions"]
  }
}

If a category has nothing relevant, return an empty array for it. Never omit a key. Remember: escape every newline inside string values as \\n.

CONVERSATION:
${rawConversation}`;

    const text = await callGroq(apiKey, prompt);
    const parsed = safeParseJson(text);

    return {
      title: parsed.title || "Untitled session",
      summary: parsed.summary || "",
      formatted_conversation: parsed.formatted_conversation || rawConversation,
      extracted: {
        decisions: parsed.extracted?.decisions || [],
        features: parsed.extracted?.features || [],
        bugs: parsed.extracted?.bugs || [],
        bugfixes: parsed.extracted?.bugfixes || [],
        code_snippets: parsed.extracted?.code_snippets || [],
        todos: parsed.extracted?.todos || [],
        ideas: parsed.extracted?.ideas || [],
        architecture: parsed.extracted?.architecture || [],
        research: parsed.extracted?.research || [],
        questions: parsed.extracted?.questions || [],
      },
    } satisfies ExtractionResult;
  },

  async generateSwitchContext(apiKey, projectName, projectDescription, memoryBlocks) {
    if (memoryBlocks.length === 0) {
      return `PROJECT: ${projectName}\n${
        projectDescription ? `DESCRIPTION: ${projectDescription}\n` : ""
      }\nNo sessions have been saved yet.`;
    }

    const memorySummary = memoryBlocks
      .map(
        (m) => `[${m.ai_model} - ${new Date(m.created_at).toLocaleDateString()}]
Title: ${m.title}
Summary: ${m.summary}
Decisions: ${m.extracted_data.decisions?.join(", ") || "none"}
Features: ${m.extracted_data.features?.join(", ") || "none"}
Bugs: ${m.extracted_data.bugs?.join(", ") || "none"}
Todos: ${m.extracted_data.todos?.join(", ") || "none"}`
      )
      .join("\n\n");

    const prompt = `You are a context compression AI. Generate a clean, AI-optimized context document from this project history.

PROJECT: ${projectName}
DESCRIPTION: ${projectDescription || "No description provided"}

CONVERSATION HISTORY:
${memorySummary}

Generate a context document with: Project overview, Tech stack and constraints, Key decisions made, Completed work, Pending work and next steps, Known issues, Important code patterns.

Be concise but complete. Remove duplicate information.`;

    return callGroq(apiKey, prompt);
  },

  async updateKnowledgeGraph(apiKey, existingData, newMemory) {
    const prompt = `You maintain a project's living knowledge graph. Merge new information into the existing knowledge, removing duplicates and outdated items.

EXISTING KNOWLEDGE:
${JSON.stringify(existingData, null, 2)}

NEW SESSION:
Title: ${newMemory.title}
Summary: ${newMemory.summary}
Decisions: ${newMemory.extracted_data.decisions?.join(", ") || "none"}
Features: ${newMemory.extracted_data.features?.join(", ") || "none"}
Bugs found: ${newMemory.extracted_data.bugs?.join(", ") || "none"}
Bugs fixed: ${newMemory.extracted_data.bugfixes?.join(", ") || "none"}
Todos: ${newMemory.extracted_data.todos?.join(", ") || "none"}
Architecture: ${newMemory.extracted_data.architecture?.join(", ") || "none"}

Return ONLY valid JSON, no markdown backticks. CRITICAL: escape any newlines inside string values as \\n, never a literal line break. Matching this exact structure:
{
  "purpose": ["concise statements of what this project is for"],
  "tech_stack": ["technologies in use"],
  "decisions": ["key decisions made, deduplicated"],
  "completed": ["work that is done"],
  "pending": ["work still to do"],
  "blockers": ["current blockers, remove if resolved"],
  "ideas": ["ideas under consideration"],
  "architecture": ["architecture choices"]
}`;

    const text = await callGroq(apiKey, prompt);
    return safeParseJson(text) as KnowledgeGraphData;
  },
};