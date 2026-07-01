const CODE_FENCE_RE = /```([^\n`]*)\n([\s\S]*?)```/g;
const FILENAME_EXT_RE =
  /\.(tsx?|jsx?|py|json|md|mdx|css|scss|html|yaml|yml|sql|sh|rb|go|rs|java|c|cpp|h|php|vue|svelte|env)$/i;

// Matches a standalone line naming a file, optionally annotated like
// "FilesTab.tsx (full replacement)" or "### components/x.ts (new)".
const FILENAME_HEADER_RE =
  /^[#>*\s]*`?([\w./-]+\.[a-zA-Z0-9]{1,10})`?\s*(\((?:full replacement|complete replacement|new|updated?)\))?\s*$/i;

const CODE_START_RE =
  /^\s*(import\s|export\s|const\s|let\s|var\s|function\s|class\s|def\s|#!|<\?php|SELECT\s|CREATE\s|package\s|using\s|public\s|private\s|protected\s|@\w|<[a-zA-Z]|\{|\}|\/\/|\/\*|#include|"use client")/;

function looksLikeProse(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (/[{}();=<>]/.test(trimmed)) return false;
  const wordCount = trimmed.split(/\s+/).length;
  return wordCount >= 6 && /[.!?]$/.test(trimmed);
}

function cleanFilenameCandidate(raw: string): string | null {
  let s = raw.trim();
  s = s.replace(/^[#>*\s]+/, "").replace(/[*_`]+$/, "").replace(/^[`*_]+/, "");
  s = s.trim();
  if (!s || s.includes(" ")) return null;
  if (!FILENAME_EXT_RE.test(s)) return null;
  return s.replace(/^\.\//, "").replace(/^\/+/, "");
}

function extractFencedBlocks(text: string): { path: string; content: string; start: number; end: number }[] {
  const results: { path: string; content: string; start: number; end: number }[] = [];
  let match: RegExpExecArray | null;
  CODE_FENCE_RE.lastIndex = 0;

  while ((match = CODE_FENCE_RE.exec(text)) !== null) {
    const infoString = match[1]?.trim() || "";
    let code = match[2] ?? "";
    const fenceStart = match.index;
    const fenceEnd = fenceStart + match[0].length;
    let filename: string | null = null;

    if (infoString) {
      const afterColon = infoString.includes(":")
        ? infoString.split(":").slice(1).join(":")
        : infoString;
      filename = cleanFilenameCandidate(afterColon) || cleanFilenameCandidate(infoString);
    }

    if (!filename) {
      const firstLine = code.split("\n")[0] || "";
      const stripped = firstLine.replace(/^(\/\/|#|<!--|\*)\s*/, "").replace(/-->\s*$/, "");
      const candidate = cleanFilenameCandidate(stripped);
      if (candidate) {
        filename = candidate;
        code = code.split("\n").slice(1).join("\n");
      }
    }

    if (!filename) {
      const before = text.slice(Math.max(0, fenceStart - 200), fenceStart);
      const lines = before.split("\n").map((l) => l.trim()).filter(Boolean);
      const prevLine = lines[lines.length - 1];
      if (prevLine) filename = cleanFilenameCandidate(prevLine);
    }

    if (filename && code.trim()) {
      results.push({ path: filename, content: code.trim() + "\n", start: fenceStart, end: fenceEnd });
    }
  }

  return results;
}

// Fallback for conversations pasted as plain text, where markdown fences
// were already stripped by the browser before Daruka ever saw them.
// Looks for a bare filename line followed immediately by code-shaped
// content, and captures until the content clearly turns back into prose.
function extractFencelessBlocks(
  text: string,
  excludeRanges: { start: number; end: number }[]
): { path: string; content: string }[] {
  const results: { path: string; content: string }[] = [];
  const lines = text.split("\n");

  // Precompute character offsets per line so we can check exclusion ranges.
  let offset = 0;
  const lineOffsets = lines.map((l) => {
    const start = offset;
    offset += l.length + 1;
    return start;
  });

  function isExcluded(lineIndex: number): boolean {
    const pos = lineOffsets[lineIndex];
    return excludeRanges.some((r) => pos >= r.start && pos < r.end);
  }

  for (let i = 0; i < lines.length; i++) {
    if (isExcluded(i)) continue;
    const headerMatch = lines[i].match(FILENAME_HEADER_RE);
    if (!headerMatch) continue;
    const filename = cleanFilenameCandidate(headerMatch[1]);
    if (!filename) continue;

    // Find the next non-blank line
    let j = i + 1;
    while (j < lines.length && !lines[j].trim()) j++;
    if (j >= lines.length || isExcluded(j)) continue;
    if (!CODE_START_RE.test(lines[j])) continue; // doesn't look like code, skip

    const collected: string[] = [];
    let blankStreak = 0;
    while (j < lines.length && collected.length < 500) {
      const line = lines[j];
      if (isExcluded(j)) break;
      if (!line.trim()) {
        blankStreak++;
        if (blankStreak > 2) break;
        collected.push(line);
        j++;
        continue;
      }
      blankStreak = 0;
      if (FILENAME_HEADER_RE.test(line)) break; // hit the next file header
      if (looksLikeProse(line)) break;
      collected.push(line);
      j++;
    }

    const content = collected.join("\n").trim();
    if (content) {
      results.push({ path: filename, content: content + "\n" });
    }
  }

  return results;
}

export function parseCodeFilesFromConversation(
  text: string
): { path: string; content: string }[] {
  const fenced = extractFencedBlocks(text);
  const fenceless = extractFencelessBlocks(
    text,
    fenced.map((f) => ({ start: f.start, end: f.end }))
  );

  const merged: { path: string; content: string }[] = [];
  const indexByPath = new Map<string, number>();

  for (const { path, content } of [...fenced, ...fenceless]) {
    if (indexByPath.has(path)) {
      merged[indexByPath.get(path)!] = { path, content };
    } else {
      indexByPath.set(path, merged.length);
      merged.push({ path, content });
    }
  }

  return merged;
}