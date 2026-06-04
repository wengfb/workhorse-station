import { useState, useRef, useEffect, useCallback } from "react";

export type SelectOption = {
  value: string;
  label: string;
};

type SelectProps = {
  options: SelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
};

export function Select({ options, value, onChange, placeholder, className = "" }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedLabel = options.find((opt) => opt.value === value)?.label;
  const displayText = selectedLabel ?? placeholder ?? "";

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (open) {
      const idx = options.findIndex((opt) => opt.value === value);
      setHighlightIndex(idx >= 0 ? idx : 0);
    }
  }, [open, options, value]);

  useEffect(() => {
    if (!open || !listRef.current) return;
    const item = listRef.current.children[highlightIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [highlightIndex, open]);

  const commit = useCallback(
    (optValue: string) => {
      onChange?.(optValue);
      setOpen(false);
    },
    [onChange]
  );

  const handleTriggerKey = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setHighlightIndex((prev) => (prev + 1) % options.length);
        break;
      case "ArrowUp":
        e.preventDefault();
        setHighlightIndex((prev) => (prev - 1 + options.length) % options.length);
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        if (options[highlightIndex]) {
          commit(options[highlightIndex].value);
        }
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        break;
    }
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={handleTriggerKey}
        className={`app-input-shell flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm outline-none transition-colors ${open ? "app-input-shell-strong app-hover-border" : "app-hover-border"} ${displayText ? "app-text" : "app-text-faint"}`}
      >
        <span className="truncate text-left">{displayText}</span>
        <svg
          className={`app-text-faint ml-2 h-4 w-4 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <ul ref={listRef} role="listbox" className="app-panel-strong app-border absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-auto rounded-lg border py-1 shadow-2xl">
          {options.map((opt, index) => {
            const isSelected = opt.value === value;
            const isHighlighted = index === highlightIndex;

            return (
              <li
                key={opt.value}
                role="option"
                aria-selected={isSelected}
                onMouseDown={(e) => {
                  e.preventDefault();
                  commit(opt.value);
                }}
                onMouseEnter={() => setHighlightIndex(index)}
                className={`cursor-pointer px-3 py-2 text-sm transition-colors ${isHighlighted ? "app-accent-strong app-text" : isSelected ? "app-text-soft" : "app-text-faint app-hover-text"}`}
              >
                <span className="flex items-center justify-between">
                  {opt.label}
                  {isSelected && (
                    <svg className="app-text-faint h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
