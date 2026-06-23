import { useState, useRef, useEffect, useCallback } from "react";
import { Check, ChevronDown } from "lucide-react";

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
  size?: "default" | "sm";
};

export function Select({ options, value, onChange, placeholder, className = "", size = "default" }: SelectProps) {
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const selectedLabel = options.find((opt) => opt.value === value)?.label;
  const displayText = selectedLabel ?? placeholder ?? "";
  const triggerClassName = size === "sm" ? "rounded-lg px-2.5 py-1.5 text-xs" : "rounded-lg px-3 py-2 text-sm";
  const optionClassName = size === "sm" ? "px-2.5 py-1.5 text-xs" : "px-3 py-2 text-sm";
  const chevronClassName = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  const checkClassName = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";

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
        className={`app-input-shell flex w-full items-center justify-between border outline-none transition-colors ${triggerClassName} ${open ? "app-input-shell-strong app-hover-border" : "app-hover-border"} ${displayText ? "app-text" : "app-text-faint"}`}
      >
        <span className="truncate text-left">{displayText}</span>
        <ChevronDown className={`app-text-faint ml-2 shrink-0 transition-transform duration-200 ${chevronClassName} ${open ? "rotate-180" : ""}`} aria-hidden="true" />
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
                className={`cursor-pointer transition-colors ${optionClassName} ${isHighlighted ? "app-accent-strong app-text" : isSelected ? "app-text-soft" : "app-text-faint app-hover-text"}`}
              >
                <span className="flex items-center justify-between">
                  {opt.label}
                  {isSelected && (
                    <Check className={`app-text-faint ${checkClassName}`} aria-hidden="true" />
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
