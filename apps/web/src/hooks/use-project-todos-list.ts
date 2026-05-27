import { useEffect, useMemo, useRef, useState } from "react";
import type { TodoStatus, TodoSummary } from "@workhorse-station/shared";
import { getTodos } from "../api";
import { isDefaultListQuery } from "../lib/list-query";
import { useListQueryState } from "./use-list-query-state";

const defaultTodoStatuses: TodoStatus[] = ["draft", "pending", "in_progress"];

type UseProjectTodosListOptions = {
  projectId: string | null;
  formatError: (error: unknown, fallback: string) => string;
};

export function useProjectTodosList({ projectId, formatError }: UseProjectTodosListOptions) {
  const [items, setItems] = useState<TodoSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const queryState = useListQueryState({ statuses: defaultTodoStatuses });
  const effectiveQueryRef = useRef(queryState.effectiveQuery);

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    effectiveQueryRef.current = queryState.effectiveQuery;
  }, [queryState.effectiveQuery]);

  useEffect(() => {
    if (!isDefaultListQuery(queryState.query)) {
      queryState.reset({ statuses: defaultTodoStatuses });
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
      const data = await getTodos(projectId, effectiveQueryRef.current);
      const nextItem =
        (preferredId ? data.todos.find((todo) => todo.id === preferredId) : null) ??
        data.todos.find((todo) => todo.id === selectedIdRef.current) ??
        data.todos[0] ??
        null;

      setItems(data.todos);
      setTotal(data.total);
      setSelectedId(nextItem?.id ?? null);
      setError(null);
    } catch (error) {
      setError(formatError(error, "项目任务加载失败"));
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
    for (const todo of items) {
      for (const tag of todo.tags) {
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
