import type { ComponentChild, ComponentChildren } from "preact";

/**
 * Renders the constrained Markdown subset generated notes always use
 * (headings, bullet lists, **bold**, plain paragraphs, and Markdown images
 * for resolved [[screenshot:N]] placeholders — see
 * services/ai/screenshotPlaceholders.ts) as real Preact elements, so images
 * actually display and text isn't shown as raw "**bold**"/"# " markup.
 *
 * A small hand-rolled parser rather than a Markdown library: the AI's output
 * shape is fully controlled by our own system prompt (see
 * services/ai/prompts.ts), so this only ever needs to handle a known,
 * narrow subset — consistent with services/ai/notion.ts's approach. Building
 * real elements (not `dangerouslySetInnerHTML`) also means there's no HTML
 * injection surface from AI-generated text.
 */
export function renderNoteMarkdown(markdown: string): ComponentChildren {
  const lines = markdown.split("\n");
  const blocks: ComponentChild[] = [];
  let key = 0;

  let listItems: string[] = [];
  const flushList = () => {
    if (listItems.length === 0) return;
    blocks.push(
      <ul key={key++} className="my-2 list-disc space-y-1 pl-5">
        {listItems.map((item, i) => (
          <li key={i}>{renderInline(item)}</li>
        ))}
      </ul>,
    );
    listItems = [];
  };

  let paragraphLines: string[] = [];
  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    blocks.push(
      <p key={key++} className="my-2">
        {renderInline(paragraphLines.join(" "))}
      </p>,
    );
    paragraphLines = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line === "") {
      flushList();
      flushParagraph();
      continue;
    }

    const image = line.match(/^!\[([^\]]*)\]\((\S+)\)$/);
    if (image) {
      flushList();
      flushParagraph();
      blocks.push(
        <img
          key={key++}
          src={image[2]}
          alt={image[1] || "screenshot"}
          className="my-2 max-h-64 max-w-full rounded-md border border-white/10"
        />,
      );
      continue;
    }

    const h1 = line.match(/^#\s+(.+)$/);
    if (h1) {
      flushList();
      flushParagraph();
      blocks.push(
        <h1 key={key++} className="mb-2 text-base font-bold text-neutral-100">
          {renderInline(h1[1])}
        </h1>,
      );
      continue;
    }

    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      flushList();
      flushParagraph();
      blocks.push(
        <h2 key={key++} className="mb-1.5 mt-3 text-sm font-semibold text-neutral-100 first:mt-0">
          {renderInline(h2[1])}
        </h2>,
      );
      continue;
    }

    const h3 = line.match(/^###\s+(.+)$/);
    if (h3) {
      flushList();
      flushParagraph();
      blocks.push(
        <h3 key={key++} className="mb-1 mt-2 text-xs font-semibold text-neutral-200">
          {renderInline(h3[1])}
        </h3>,
      );
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      listItems.push(bullet[1]);
      continue;
    }

    flushList();
    paragraphLines.push(line);
  }

  flushList();
  flushParagraph();

  return <div>{blocks}</div>;
}

function renderInline(text: string): ComponentChild[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}
