import { ViewDef } from "../types";

interface ViewBarProps {
  views: ViewDef[];
  activeViewIndex: number;
  onSwitchView: (index: number) => void;
}

export function ViewBar({
  views,
  activeViewIndex,
  onSwitchView,
}: ViewBarProps) {
  return (
    <div className="csv-db-viewbar-tabs">
      {views.map((view, i) => (
        <div
          key={i}
          className={`csv-db-viewbar-tab${i === activeViewIndex ? " csv-db-viewbar-tab-active" : ""}`}
          onClick={() => onSwitchView(i)}
        >
          <span className="csv-db-viewbar-name">{view.name}</span>
        </div>
      ))}
    </div>
  );
}
