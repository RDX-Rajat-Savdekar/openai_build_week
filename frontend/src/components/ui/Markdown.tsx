import type { ReactNode } from "react";

function renderInline(text: string, keyBase: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|_[^_]+_)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let i = 0;
  while ((match = re.exec(text))) {
    if (match.index > last) parts.push(text.slice(last, match.index));
    const token = match[0];
    const key = `${keyBase}-${i++}`;
    if (token.startsWith("**")) {
      parts.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("`")) {
      parts.push(
        <code key={key} className="rounded bg-code-bg px-1 py-0.5 font-mono text-[0.85em]">
          {token.slice(1, -1)}
        </code>,
      );
    } else {
      parts.push(<em key={key}>{token.slice(1, -1)}</em>);
    }
    last = re.lastIndex;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function Markdown({ text, className = "" }: { text: string; className?: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i] ?? "";

    if (line.startsWith("```")) {
      const lang = line.slice(3).trim();
      const buf: string[] = [];
      i++;
      while (i < lines.length && !(lines[i] ?? "").startsWith("```")) {
        buf.push(lines[i] ?? "");
        i++;
      }
      i++;
      blocks.push(
        <pre key={key++} className="my-3 overflow-auto rounded-lg bg-code-bg p-3 font-mono text-xs">
          <code>{buf.join("\n")}</code>
        </pre>,
      );
      if (lang) void lang;
      continue;
    }

    if (line.startsWith("# ")) {
      blocks.push(
        <h1 key={key++} className="mt-2 mb-2 text-xl font-bold">
          {renderInline(line.slice(2), `h1-${key}`)}
        </h1>,
      );
      i++;
      continue;
    }

    if (line.startsWith("## ")) {
      blocks.push(
        <h2 key={key++} className="mt-5 mb-2 text-base font-bold text-accent">
          {renderInline(line.slice(3), `h2-${key}`)}
        </h2>,
      );
      i++;
      continue;
    }

    if (line.trim() === "---") {
      blocks.push(<hr key={key++} className="my-4 border-border" />);
      i++;
      continue;
    }

    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && (lines[i] ?? "").startsWith("- ")) {
        items.push((lines[i] ?? "").slice(2));
        i++;
      }
      blocks.push(
        <ul key={key++} className="my-2 list-disc space-y-1 pl-5 text-sm">
          {items.map((it, idx) => (
            <li key={idx}>{renderInline(it, `li-${key}-${idx}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    if (line.startsWith("_") && line.endsWith("_") && line.length > 1) {
      blocks.push(
        <p key={key++} className="mt-4 text-xs text-muted">
          {renderInline(line, `it-${key}`)}
        </p>,
      );
      i++;
      continue;
    }

    if (line.trim() === "") {
      i++;
      continue;
    }

    const paraLines: string[] = [line];
    i++;
    while (
      i < lines.length &&
      (lines[i] ?? "").trim() !== "" &&
      !(lines[i] ?? "").startsWith("#") &&
      !(lines[i] ?? "").startsWith("```") &&
      !(lines[i] ?? "").startsWith("- ") &&
      (lines[i] ?? "").trim() !== "---"
    ) {
      paraLines.push(lines[i] ?? "");
      i++;
    }
    blocks.push(
      <p key={key++} className="mb-2 text-sm leading-relaxed text-text-2">
        {paraLines.map((pl, idx) => (
          <span key={idx}>
            {renderInline(pl.replace(/ {2,}$/, ""), `p-${key}-${idx}`)}
            {idx < paraLines.length - 1 && <br />}
          </span>
        ))}
      </p>,
    );
  }

  return <div className={className}>{blocks}</div>;
}
