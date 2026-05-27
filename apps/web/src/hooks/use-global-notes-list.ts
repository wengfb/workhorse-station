import { useEffect, useMemo, useRef, useState } from "react";
import type { NoteSummary } from "@workhorse-station/shared";
import { getGlobalNotes } from "../api";
import { useListQueryState } from "./use-list-query-state";

type UseGlobalNotesListOptions = {
  formatError: (error: unknown, fallback: string) => string;
};

export function useGlobalNotesList({ formatError }: UseGlobalNotesListOptions) {
  const [items, setItems] = useState<NoteSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
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

  async function refresh(preferredId?: string | null) {
    setLoading(true);

    try {
      const data = await getGlobalNotes(effectiveQueryRef.current);
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
      setError(formatError(error, "全局笔记加载失败"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, [queryState.effectiveQuery]);

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
