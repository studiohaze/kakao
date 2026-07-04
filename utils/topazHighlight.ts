const KEYWORDS = new Set([
  "match", "case", "if", "else", "for", "in", "while", "return", "break",
  "continue", "defer", "concurrent", "by"
]);
const STORAGE = new Set(["function", "let", "mut", "const", "type"]);
const MODULES = new Set(["import", "export"]);
const CONSTANTS = new Set(["true", "false", "null"]);
const SUPPORT = new Set(["Ok", "Err", "Some", "None"]);
const PRIMITIVE_TYPES = new Set(["int", "float", "bool", "string"]);
const TEMPLATE_TAGS = ["sql", "sh", "p", "r"];
const OPERATORS = [
  "??=", "..<", "??", "?.", "..", "->", "=>", "|>", "&&", "||", "==",
  "!=", "<=", ">=", "+=", "-=", "**", "*=", "%=", ">>", "+", "-", "*",
  "/", "%", "<", ">", "=", "!", "?", "~"
];
const UPPER_RE = new RegExp("^\\p{Lu}$", "u");
const LETTER_RE = new RegExp("^\\p{L}$", "u");
const NUMBER_RE = new RegExp("^\\p{N}$", "u");

type TokenizeResult = {
  html: string;
  index: number;
};

export function highlightTopaz(source: string): string {
  const text = source == null ? "" : String(source);
  return tokenize(text, 0, text.length, false).html;
}

function tokenize(source: string, start: number, end: number, stopAtBrace: boolean): TokenizeResult {
  let html = "";
  let i = start;
  let braceDepth = 0;

  while (i < end) {
    const ch = source[i];

    if (stopAtBrace && ch === "}") {
      if (braceDepth === 0) return { html, index: i };
      html += escapeHtml(ch);
      braceDepth--;
      i++;
      continue;
    }

    if (source.startsWith("//", i)) {
      const lineEnd = source.indexOf("\n", i + 2);
      const j = lineEnd === -1 || lineEnd > end ? end : lineEnd;
      html += span("tz-comment", source.slice(i, j));
      i = j;
      continue;
    }

    if (source.startsWith("/*", i)) {
      const close = source.indexOf("*/", i + 2);
      const j = close === -1 || close + 2 > end ? end : close + 2;
      html += span("tz-comment", source.slice(i, j));
      i = j;
      continue;
    }

    const tag = matchTemplateTag(source, i, end);
    if (tag) {
      html += span("tz-tag", tag);
      const stringToken = readString(source, i + tag.length, end);
      html += stringToken.html;
      i = stringToken.index;
      continue;
    }

    if (source.startsWith('"""', i) || ch === '"') {
      const stringToken = readString(source, i, end);
      html += stringToken.html;
      i = stringToken.index;
      continue;
    }

    if (isDigit(ch)) {
      const j = readNumber(source, i, end);
      html += span("tz-num", source.slice(i, j));
      i = j;
      continue;
    }

    const identEnd = readIdentifier(source, i, end);
    if (identEnd > i) {
      const ident = source.slice(i, identEnd);
      html += span(classifyIdentifier(ident, source, identEnd), ident);
      i = identEnd;
      continue;
    }

    const op = matchOperator(source, i, end);
    if (op) {
      html += span("tz-op", op);
      i += op.length;
      continue;
    }

    if (stopAtBrace && ch === "{") {
      html += escapeHtml(ch);
      braceDepth++;
      i++;
      continue;
    }

    const j = nextIndex(source, i);
    html += escapeHtml(source.slice(i, Math.min(j, end)));
    i = j;
  }

  return { html, index: i };
}

function readString(source: string, start: number, end: number): TokenizeResult {
  const triple = source.startsWith('"""', start);
  const delimiter = triple ? '"""' : '"';
  let html = span("tz-str", delimiter);
  let i = start + delimiter.length;

  while (i < end) {
    if (triple ? source.startsWith(delimiter, i) : source[i] === delimiter) {
      html += span("tz-str", delimiter);
      return { html, index: i + delimiter.length };
    }

    const escapeLength = readEscape(source, i, end);
    if (escapeLength) {
      html += span("tz-esc", source.slice(i, i + escapeLength));
      i += escapeLength;
      continue;
    }

    if (source[i] === "\\") {
      html += span("tz-str", source[i]);
      i++;
      continue;
    }

    if (source[i] === "{") {
      html += span("tz-interp", "{");
      const inner = tokenize(source, i + 1, end, true);
      html += inner.html;
      i = inner.index;
      if (i < end && source[i] === "}") {
        html += span("tz-interp", "}");
        i++;
      }
      continue;
    }

    const j = readStringText(source, i, end, delimiter, triple);
    html += span("tz-str", source.slice(i, j));
    i = j;
  }

  return { html, index: i };
}

function readStringText(source: string, start: number, end: number, delimiter: string, triple: boolean): number {
  let i = start;
  while (i < end) {
    if (source[i] === "\\" || source[i] === "{") break;
    if (triple ? source.startsWith(delimiter, i) : source[i] === delimiter) break;
    i++;
  }
  return i;
}

function readEscape(source: string, i: number, end: number): number {
  if (source[i] !== "\\" || i + 1 >= end) return 0;
  const next = source[i + 1];
  return next === "n" || next === "t" || next === "r" || next === "\\" ||
    next === '"' || next === "{" || next === "}" ? 2 : 0;
}

function matchTemplateTag(source: string, i: number, end: number): string {
  for (const tag of TEMPLATE_TAGS) {
    const j = i + tag.length;
    if (j < end && source.startsWith(tag, i) &&
        (source.startsWith('"""', j) || source[j] === '"')) {
      return tag;
    }
  }
  return "";
}

function classifyIdentifier(ident: string, source: string, end: number): string {
  if (KEYWORDS.has(ident)) return "tz-keyword";
  if (STORAGE.has(ident)) return "tz-storage";
  if (MODULES.has(ident)) return "tz-module";
  if (CONSTANTS.has(ident)) return "tz-const";
  if (SUPPORT.has(ident)) return "tz-support";
  if (PRIMITIVE_TYPES.has(ident)) return "tz-type";
  if (isUppercaseStart(ident)) return "tz-type";
  let k = end;
  while (source[k] === " " || source[k] === "\t" || source[k] === "\r" || source[k] === "\n") k++;
  if (source[k] === "(") return "tz-func";
  return "tz-ident";
}

function readNumber(source: string, i: number, end: number): number {
  let j = i;
  while (j < end && isDigit(source[j])) j++;
  if (source[j] === "." && j + 1 < end && isDigit(source[j + 1])) {
    j++;
    while (j < end && isDigit(source[j])) j++;
  }
  return j;
}

function readIdentifier(source: string, i: number, end: number): number {
  if (!isIdentifierStart(source, i, end)) return i;
  let j = nextIndex(source, i);
  while (j < end && isIdentifierPart(source, j, end)) j = nextIndex(source, j);
  return j;
}

function isIdentifierStart(source: string, i: number, end: number): boolean {
  if (i >= end) return false;
  const cp = source.codePointAt(i);
  const ch = String.fromCodePoint(cp);
  return ch === "_" || LETTER_RE.test(ch) || isEmojiIdentifierCodePoint(cp);
}

function isIdentifierPart(source: string, i: number, end: number): boolean {
  if (i >= end) return false;
  const cp = source.codePointAt(i);
  const ch = String.fromCodePoint(cp);
  return ch === "_" || LETTER_RE.test(ch) || NUMBER_RE.test(ch) ||
    isEmojiIdentifierCodePoint(cp);
}

function isEmojiIdentifierCodePoint(cp: number): boolean {
  return (cp >= 0x1F300 && cp <= 0x1FAFF) || (cp >= 0x2600 && cp <= 0x27BF);
}

function isUppercaseStart(ident: string): boolean {
  if (!ident) return false;
  const first = String.fromCodePoint(ident.codePointAt(0));
  return UPPER_RE.test(first);
}

function matchOperator(source: string, i: number, end: number): string {
  for (const op of OPERATORS) {
    if (i + op.length <= end && source.startsWith(op, i)) return op;
  }
  return "";
}

function isDigit(ch: string): boolean {
  return ch >= "0" && ch <= "9";
}

function nextIndex(source: string, i: number): number {
  const cp = source.codePointAt(i);
  return cp > 0xFFFF ? i + 2 : i + 1;
}

function span(className: string, text: string): string {
  return text ? `<span class="${className}">${escapeHtml(text)}</span>` : "";
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>]/g, (ch) => {
    if (ch === "&") return "&amp;";
    if (ch === "<") return "&lt;";
    return "&gt;";
  });
}
