import { Platform } from "obsidian";

const KEYBOARD_SETTLE_MS = 350;
const VIEWPORT_WATCH_MS = 1500;

/**
 * Mobile on-screen keyboards open over the table and can leave the focused
 * cell input hidden. Scroll it into view after focus and again once the
 * keyboard has settled, following the visual viewport while it animates.
 */
export function keepEditorVisible(input: HTMLInputElement | null): void {
  if (!input || !Platform.isMobile) return;

  const reveal = () => {
    if (!input.isConnected) return;
    input.scrollIntoView({ block: "center", inline: "nearest" });
  };

  window.requestAnimationFrame(reveal);
  window.setTimeout(reveal, KEYBOARD_SETTLE_MS);

  const viewport = window.visualViewport;
  if (!viewport) return;
  viewport.addEventListener("resize", reveal);
  window.setTimeout(() => viewport.removeEventListener("resize", reveal), VIEWPORT_WATCH_MS);
}
