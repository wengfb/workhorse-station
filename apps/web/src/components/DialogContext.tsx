import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

type ConfirmOptions = {
  title?: string;
  danger?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
};

type PromptOptions = {
  title?: string;
  defaultValue?: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

type DialogState =
  | { type: "confirm"; message: string; options: ConfirmOptions; anchorX: number; anchorY: number; resolve: (value: boolean) => void }
  | { type: "prompt"; message: string; options: PromptOptions; resolve: (value: string | null) => void }
  | null;

type DialogContextValue = {
  confirm: (message: string, options?: ConfirmOptions) => Promise<boolean>;
  prompt: (message: string, options?: PromptOptions) => Promise<string | null>;
};

const DialogContext = createContext<DialogContextValue | null>(null);

// Track last mouse position for popover placement
let lastMouseX = 0;
let lastMouseY = 0;
if (typeof document !== "undefined") {
  document.addEventListener("mousedown", (e) => {
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  }, true);
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [dialog, setDialog] = useState<DialogState>(null);
  const [promptValue, setPromptValue] = useState("");
  const [position, setPosition] = useState<{ left: number; top: number }>({ left: 0, top: 0 });
  const popoverRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const confirm = useCallback((message: string, options: ConfirmOptions = {}): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      // Start at approximate position to avoid "flying" from old position
      setPosition({
        left: Math.max(8, lastMouseX - 100),
        top: Math.max(8, lastMouseY - 48),
      });
      setDialog({ type: "confirm", message, options, anchorX: lastMouseX, anchorY: lastMouseY, resolve });
    });
  }, []);

  const promptFn = useCallback((message: string, options: PromptOptions = {}): Promise<string | null> => {
    return new Promise<string | null>((resolve) => {
      setPromptValue(options.defaultValue ?? "");
      setDialog({ type: "prompt", message, options, resolve });
    });
  }, []);

  const dismiss = useCallback((result: boolean | null) => {
    if (!dialog) return;
    if (dialog.type === "confirm") {
      dialog.resolve(result === true);
    } else {
      dialog.resolve(result === true ? promptValue || null : null);
    }
    setDialog(null);
  }, [dialog, promptValue]);

  // Calculate popover position for confirm dialogs: center horizontally
  // on the click, prefer above, flip below when short on space.
  // useLayoutEffect runs synchronously before paint, eliminating the "fly" effect.
  useLayoutEffect(() => {
    if (dialog?.type !== "confirm") return;
    const el = popoverRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const gap = 8;
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;

    // Center horizontally on the click point, clamp to viewport
    let left = dialog.anchorX - rect.width / 2;
    left = Math.max(gap, Math.min(left, viewW - rect.width - gap));

    // Prefer above the click, flip below if it overflows the top
    let top = dialog.anchorY - rect.height - gap;
    if (top < gap) {
      top = dialog.anchorY + gap;
    }
    top = Math.max(gap, Math.min(top, viewH - rect.height - gap));

    setPosition({ left, top });
  }, [dialog]);

  // Auto-focus input for prompt dialogs
  useEffect(() => {
    if (dialog?.type === "prompt") {
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [dialog]);

  // ESC to dismiss
  useEffect(() => {
    if (!dialog) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        dismiss(null);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [dialog, dismiss]);

  if (!dialog) {
    return (
      <DialogContext.Provider value={{ confirm, prompt: promptFn }}>
        {children}
      </DialogContext.Provider>
    );
  }

  const isPrompt = dialog.type === "prompt";
  const options = dialog.options;

  // --- Confirm Popover (near click position) ---
  if (dialog.type === "confirm") {
    const isDanger = (options as ConfirmOptions).danger;
    return (
      <DialogContext.Provider value={{ confirm, prompt: promptFn }}>
        {children}
        {/* Subtle overlay — block background clicks while keeping context visible */}
        <div className="fixed inset-0 z-50 bg-black/20" onClick={() => dismiss(null)} />
        {/* Popover */}
        <div
          ref={popoverRef}
          className="fixed z-50 min-w-[220px] max-w-[320px] rounded-xl border border-white/10 bg-[#1a1d28] p-4 shadow-2xl ring-1 ring-black/20 duration-150 animate-in fade-in zoom-in-95"
          style={{ left: position.left, top: position.top }}
          onClick={(e) => e.stopPropagation()}
        >
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">
            {dialog.message}
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => dismiss(null)}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-400 transition-colors hover:border-white/15 hover:bg-white/5 hover:text-slate-200"
            >
              {options.cancelLabel ?? "取消"}
            </button>
            <button
              type="button"
              onClick={() => dismiss(true)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                isDanger
                  ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                  : "bg-white text-slate-900 hover:bg-slate-200"
              }`}
            >
              {options.confirmLabel ?? "确认"}
            </button>
          </div>
        </div>
      </DialogContext.Provider>
    );
  }

  // --- Prompt Modal (centered, with input) ---
  return (
    <DialogContext.Provider value={{ confirm, prompt: promptFn }}>
      {children}
      {/* Overlay */}
      <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" />
      {/* Centered modal */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={() => dismiss(null)}
      >
        <div
          className="w-full max-w-sm rounded-xl border border-white/10 bg-[#1a1d28] shadow-2xl ring-1 ring-black/20"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-4 pb-0">
            {options.title && (
              <h3 className="text-sm font-medium text-slate-100">{options.title}</h3>
            )}
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
              {dialog.message}
            </p>
          </div>
          <div className="px-4 pt-4">
            <input
              ref={inputRef}
              type="text"
              value={promptValue}
              onChange={(e) => setPromptValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  dismiss(true);
                }
              }}
              className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-white/20 focus:bg-black/40"
              placeholder={dialog.message}
            />
          </div>
          <div className="mt-4 flex justify-end gap-2 border-t border-white/5 p-4">
            <button
              type="button"
              onClick={() => dismiss(null)}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-400 transition-colors hover:border-white/15 hover:bg-white/5 hover:text-slate-200"
            >
              {options.cancelLabel ?? "取消"}
            </button>
            <button
              type="button"
              onClick={() => dismiss(true)}
              className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-200"
            >
              {options.confirmLabel ?? "确认"}
            </button>
          </div>
        </div>
      </div>
    </DialogContext.Provider>
  );
}

export function useConfirmDialog() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error("useConfirmDialog must be used within DialogProvider");
  return ctx;
}
