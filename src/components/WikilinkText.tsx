import { useMemo } from "react";
import { useApp } from "../AppContext";
import { openNoteValue } from "../note-utils";

interface WikilinkPart {
  type: "text" | "link";
  value: string;
  target?: string;
  label?: string;
}

export function parseWikilinkParts(text: string): WikilinkPart[] {
  const parts: WikilinkPart[] = [];
  const pattern = /\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|([^\]]+))?\]\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: text.slice(lastIndex, match.index) });
    }
    const target = match[1].trim();
    const alias = match[2]?.trim();
    parts.push({ type: "link", value: match[0], target, label: alias || target });
    lastIndex = pattern.lastIndex;
  }
  if (lastIndex < text.length) {
    parts.push({ type: "text", value: text.slice(lastIndex) });
  }
  return parts;
}

/** Renders a text value with [[wikilinks]] as clickable note links. */
export function WikilinkText({ value }: { value: string }) {
  const app = useApp();
  const parts = useMemo(() => parseWikilinkParts(value), [value]);

  if (parts.length === 0) return <>{value}</>;
  if (parts.length === 1 && parts[0].type === "text") return <>{value}</>;

  return (
    <>
      {parts.map((part, i) =>
        part.type === "link" ? (
          <a
            key={i}
            className="csv-db-wikilink"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (part.target) {
                void openNoteValue(app, part.target);
              }
            }}
          >
            {part.label}
          </a>
        ) : (
          <span key={i}>{part.value}</span>
        )
      )}
    </>
  );
}
