import { useEffect, useMemo, useRef, useState } from "react";
import type { NoteSummary } from "@workhorse-station/shared";
import { getNotes } from "../api";
import { isDefaultListQuery } from "../lib/list-query";
import { useListQueryState } from "./use-list-query-state";

type UseProjectNotesListOptions = {
  projectId: string | null;
  formatError: (error: unknown, fallback: string) => string;
};

export function useProjectNotesList({ projectId, formatError }: UseProjectNotesListOptions) {
  const [items, setItems] = useState<NoteSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const queryState = useListQueryState();
  const effectiveQueryRef = useRef(queryState.effectiveQuery);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    effectiveQueryRef.current = queryState.effectiveQuery;
  }, [queryState.effectiveQuery]);

  useEffect(() => {
    if (!isDefaultListQuery(queryState.query)) {
      queryState.reset();
    }
  }, [projectId]);

  async function refresh(preferredId?: string | null) {
    if (!projectId) {
      setItems([]);
      setTotal(0);
      setSelectedId(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);

    try {
      const data = await getNotes(projectId, effectiveQueryRef.current);
      const nextItem =
        (preferredId ? data.notes.find((note) => note.id === preferredId) : null) ??
        data.notes.find((note) => note.id === selectedIdRef.current) ??
        data.notes[0] ??
        null;

      setItems(data.notes);
      setTotal(data.total);
      setSelectedId(nextItem?.id ?? null);
      setError(null);
    } catch (error) {
      setError(formatError(error, "项目笔记加载失败"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!projectId) {
      setItems([]);
      setTotal(0);
      setSelectedId(null);
      setLoading(false);
      setError(null);
      return;
    }

    void refresh();
  }, [projectId, queryState.effectiveQuery]);

  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    for (const note of items) {
      for (const tag of note.tags) {
        tagSet.add(tag);
      }
    }
    return Array.from(tagSet).sort();
  }, [items]);

  return {
    items,
    total,
    loading,
    error,
    setError,
    selectedId,
    setSelectedId,
    availableTags,
    refresh,
    ...queryState
  };
}
