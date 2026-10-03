import type { KeyboardEvent } from "react";

/** Keyboard handler that triggers `handler` on Enter or Space, for SVG elements acting as buttons. */
export function onActivate(handler: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handler();
    }
  };
}
