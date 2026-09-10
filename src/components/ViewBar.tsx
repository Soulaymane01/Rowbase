import { useEffect, useRef, useState } from "react";
import { ViewDef, ViewLayout } from "../types";

function LayoutIcon({ layout }: { layout: ViewLayout }) {
  const common = {
    width: 12,
    height: 12,
    viewBox: "0 0 12 12",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (layout) {
    case "kanban":
      return (
        <svg {...common}>
          <rect x="1.2" y="2" width="2.9" height="8" rx="0.8" />
          <rect x="5.05" y="2" width="2.9" height="5" rx="0.8" />
          <rect x="8.9" y="2" width="2.9" height="6.5" rx="0.8" />
        </svg>
      );
    case "list":
      return (
        <svg {...common}>
          <line x1="1.5" y1="3" x2="10.5" y2="3" />
          <line x1="1.5" y1="6" x2="10.5" y2="6" />
          <line x1="1.5" y1="9" x2="10.5" y2="9" />
        </svg>
      );
    case "gallery":
      return (
        <svg {...common}>
          <rect x="1.5" y="1.5" width="3.8" height="3.8" rx="0.8" />
          <rect x="6.7" y="1.5" width="3.8" height="3.8" rx="0.8" />
          <rect x="1.5" y="6.7" width="3.8" height="3.8" rx="0.8" />
          <rect x="6.7" y="6.7" width="3.8" height="3.8" rx="0.8" />
        </svg>
      );
    case "chart":
      return (
        <svg {...common}>
          <path d="M2.5 10V7" />
          <path d="M6 10V3" />
          <path d="M9.5 10V5" />
          <line x1="1.5" y1="10.7" x2="10.5" y2="10.7" />
        </svg>
      );
    case "stats":
      return (
        <svg {...common}>
          <circle cx="6" cy="6" r="4.4" />
          <path d="M6 6V1.6" />
          <path d="M6 6L9.1 9.1" />
        </svg>
      );
    case "timeline":
      return (
        <svg {...common}>
          <rect x="1.2" y="2.5" width="6" height="2.6" rx="1" />
          <rect x="4.6" y="6.9" width="6.2" height="2.6" rx="1" />
        </svg>
      );
    case "dashboard":
      return (
        <svg {...common}>
          <circle cx="6" cy="6" r="4.4" />
          <circle cx="6" cy="6" r="1.3" fill="currentColor" stroke="none" />
        </svg>
      );
    default:
      return null;
  }
}

interface ViewBarProps {
  views: ViewDef[];
  activeViewIndex: number;
  onSwitchView: (index: number) => void;
  onRenameView: (index: number, name: string) => void;
  onAddView: () => void;
}

export function ViewBar({
  views,
  activeViewIndex,
  onSwitchView,
  onRenameView,
  onAddView,
}: ViewBarProps) {
  const [renamingIndex, setRenamingIndex] = useState<number | null>(null);
  const [draftName, setDraftName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingIndex !== null) inputRef.current?.select();
  }, [renamingIndex]);

  const commitRename = () => {
    if (renamingIndex !== null) {
      const name = draftName.trim();
      if (name && name !== views[renamingIndex]?.name) {
        onRenameView(renamingIndex, name);
      }
    }
    setRenamingIndex(null);
  };

  return (
    <div className="csv-db-viewbar-tabs" role="tablist" aria-label="Views">
      {views.map((view, i) => {
        const layout: ViewLayout = view.layout || "table";
        return (
          <div
            key={i}
            role="tab"
            aria-selected={i === activeViewIndex}
            tabIndex={i === activeViewIndex ? 0 : -1}
            className={`csv-db-viewbar-tab${i === activeViewIndex ? " csv-db-viewbar-tab-active" : ""}`}
            onClick={() => onSwitchView(i)}
            onDoubleClick={() => {
              setRenamingIndex(i);
              setDraftName(view.name);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onSwitchView(i);
              }
            }}
            title={`${view.name} — double-click to rename`}
          >
            {layout !== "table" && (
              <span className="csv-db-viewbar-layout-icon" aria-hidden="true">
                <LayoutIcon layout={layout} />
              </span>
            )}
            {renamingIndex === i ? (
              <input
                ref={inputRef}
                className="csv-db-viewbar-rename-input"
                value={draftName}
                autoFocus
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter") commitRename();
                  else if (e.key === "Escape") setRenamingIndex(null);
                }}
                onBlur={commitRename}
                onChange={(e) => setDraftName(e.target.value)}
                aria-label="Rename view"
              />
            ) : (
              <span className="csv-db-viewbar-name">{view.name}</span>
            )}
          </div>
        );
      })}
      <button
        className="csv-db-viewbar-add-btn"
        onClick={() => onAddView()}
        title="New view"
        aria-label="New view"
      >
        +
      </button>
    </div>
  );
}
