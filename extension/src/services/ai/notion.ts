/**
 * Pragmatic Markdown -> Notion API block converter.
 * Supports: #/##/### headings, -/* bullets, **bold** inline runs, plain paragraphs.
 * Not a full CommonMark parser — good enough for the notes shape produced by prompts.ts.
 */

interface RichText {
  type: "text";
  text: { content: string };
  annotations?: { bold?: boolean };
}

function parseInline(text: string): RichText[] {
  const parts: RichText[] = [];
  const boldRegex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = boldRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", text: { content: text.slice(lastIndex, match.index) } });
    }
    parts.push({
      type: "text",
      text: { content: match[1] },
      annotations: { bold: true },
    });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push({ type: "text", text: { content: text.slice(lastIndex) } });
  }
  return parts.length ? parts : [{ type: "text", text: { content: text } }];
}

export function markdownToNotionBlocks(markdown: string): unknown[] {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks: unknown[] = [];
  let paragraphBuffer: string[] = [];

  const flushParagraph = () => {
    if (paragraphBuffer.length === 0) return;
    const text = paragraphBuffer.join(" ").trim();
    paragraphBuffer = [];
    if (!text) return;
    blocks.push({
      object: "block",
      type: "paragraph",
      paragraph: { rich_text: parseInline(text) },
    });
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line === "") {
      flushParagraph();
      continue;
    }

    const h3 = line.match(/^###\s+(.+)$/);
    const h2 = line.match(/^##\s+(.+)$/);
    const h1 = line.match(/^#\s+(.+)$/);
    const bullet = line.match(/^[-*]\s+(.+)$/);

    if (h1 || h2 || h3) {
      flushParagraph();
      const [, content, type] = h1
        ? [null, h1[1], "heading_1"]
        : h2
          ? [null, h2[1], "heading_2"]
          : [null, h3![1], "heading_3"];
      blocks.push({
        object: "block",
        type,
        [type]: { rich_text: parseInline(content) },
      });
      continue;
    }

    if (bullet) {
      flushParagraph();
      blocks.push({
        object: "block",
        type: "bulleted_list_item",
        bulleted_list_item: { rich_text: parseInline(bullet[1]) },
      });
      continue;
    }

    paragraphBuffer.push(line);
  }

  flushParagraph();
  return blocks;
}
