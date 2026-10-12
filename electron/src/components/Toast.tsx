import { useEffect, useState } from "react";

interface ToastProps {
  message: string | null;
  variant: "success" | "error";
  durationMs?: number;
  onDismiss: () => void;
}

export function Toast({
  message,
  variant,
  durationMs = 5000,
  onDismiss,
}: ToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!message) {
      setVisible(false);
      return;
    }

    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
      onDismiss();
    }, durationMs);

    return () => clearTimeout(timer);
  }, [message, durationMs, onDismiss]);

  if (!message) return null;

  return (
    <div
      className={`pointer-events-none absolute bottom-10 left-1/2 z-40 -translate-x-1/2 rounded-md border border-border bg-surface-overlay px-4 py-2 text-sm shadow-lg transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <span className={variant === "error" ? "text-red-400" : "text-accent"}>
        {message}
      </span>
    </div>
  );
}
