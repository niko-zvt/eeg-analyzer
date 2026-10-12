import { useEffect, useState } from "react";

const FALLBACK_DARK = "#ffffff";
const FALLBACK_LIGHT = "#000000";

function readSignalColor(): string {
  const explicit = document.documentElement.getAttribute("data-theme");
  if (explicit === "light") return FALLBACK_LIGHT;
  if (explicit === "dark") return FALLBACK_DARK;

  const cssVar = getComputedStyle(document.documentElement)
    .getPropertyValue("--signal-color-main")
    .trim();
  if (cssVar) return cssVar;

  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? FALLBACK_LIGHT
    : FALLBACK_DARK;
}

export function useMainSignalColor(): string {
  const [color, setColor] = useState(readSignalColor);

  useEffect(() => {
    const update = () => setColor(readSignalColor());
    update();

    const mq = window.matchMedia("(prefers-color-scheme: light)");
    mq.addEventListener("change", update);

    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });

    return () => {
      mq.removeEventListener("change", update);
      observer.disconnect();
    };
  }, []);

  return color;
}
