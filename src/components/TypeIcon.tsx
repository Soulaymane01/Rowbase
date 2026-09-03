import { ReactNode } from "react";
import { getTypeIcon } from "../constants";

const dateIconSvg = (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="2" width="10" height="9" rx="1" />
    <line x1="1" y1="5" x2="11" y2="5" />
    <line x1="4" y1="0.5" x2="4" y2="3" />
    <line x1="8" y1="0.5" x2="8" y2="3" />
  </svg>
);

export function getTypeIconElement(type: string): ReactNode {
  switch (type) {
    case "date": return dateIconSvg;
    default: return getTypeIcon(type);
  }
}
