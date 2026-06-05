import React, { useEffect, useRef } from "react";
import type { ProjectSummary } from "@workhorse-station/shared";

export function ProjectMenu({
  open,
  projects,
  selectedProject,
  loading,
  onOpenChange,
  onEnterCurrent,
  onEnter,
  onCreate
}: {
  open: boolean;
  projects: ProjectSummary[];
  selectedProject: ProjectSummary | null;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onEnterCurrent: () => void;
  onEnter: (project: ProjectSummary) => void;
  onCreate: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onOpenChange(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open, onOpenChange]);

  return (
    <div ref={containerRef} className="relative min-w-44">
      <div className="app-button-secondary app-border flex overflow-hidden rounded-lg border text-sm">
        <button
          onClick={onEnterCurrent}
          className="app-hover-accent-strong min-w-0 flex-1 px-3 py-2 text-left"
        >
          <span className="block truncate">项目：{selectedProject?.name ?? "未选择"}</span>
        </button>
        <button
          type="button"
          aria-label={open ? "收起项目列表" : "展开项目列表"}
          aria-expanded={open}
          onClick={() => onOpenChange(!open)}
          className="app-border app-text-faint app-hover-accent-strong app-hover-text border-l px-3 py-2"
        >
          <span className={`block text-xs transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
        </button>
      </div>
      {open ? (
        <div className="app-panel app-border absolute left-0 top-full z-30 mt-2 w-80 overflow-hidden rounded-xl border shadow-2xl">
          <div className="app-border app-text-faint border-b px-3 py-2 text-xs">项目列表</div>
          <div className="max-h-80 overflow-auto p-2">
            {loading ? <div className="app-text-faint px-3 py-3 text-sm">项目加载中...</div> : null}
            {!loading && projects.length === 0 ? <div className="app-text-faint px-3 py-3 text-sm">还没有项目。</div> : null}
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => onEnter(project)}
                className={`w-full rounded-lg p-2 text-left ${selectedProject?.id === project.id ? "app-accent" : "app-hover-accent"}`}
              >
                <div className="app-text truncate text-sm">{project.name}</div>
                <div className="app-text-faint mt-1 truncate text-xs">{project.path}</div>
              </button>
            ))}
          </div>
          <button onClick={onCreate} className="app-button-secondary app-border block w-full border-t px-3 py-2 text-left text-sm">
            添加项目
          </button>
        </div>
      ) : null}
    </div>
  );
}
