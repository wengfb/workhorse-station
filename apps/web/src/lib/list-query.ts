import type { ListQuery, TodoStatus } from "@workhorse-station/shared";

export type ListQueryState = {
  search: string;
  tags: string[];
  statuses: TodoStatus[];
  page: number;
  pageSize: number;
};

export const DEFAULT_LIST_QUERY_STATE: ListQueryState = {
  search: "",
  tags: [],
  statuses: [],
  page: 1,
  pageSize: 12
};

export function buildListQueryParams(query?: ListQuery) {
  const params = new URLSearchParams();

  if (!query) {
    return params;
  }

  if (query.search?.trim()) {
    params.set("search", query.search.trim());
  }

  if (query.tags?.length) {
    params.set("tags", query.tags.join(","));
  }

  if (query.statuses?.length) {
    params.set("statuses", query.statuses.join(","));
  }

  if (query.page) {
    params.set("page", String(query.page));
  }

  if (query.pageSize) {
    params.set("pageSize", String(query.pageSize));
  }

  return params;
}

export function areListQueriesEqual(left: ListQueryState, right: ListQueryState) {
  if (
    left.search !== right.search ||
    left.page !== right.page ||
    left.pageSize !== right.pageSize ||
    left.tags.length !== right.tags.length ||
    left.statuses.length !== right.statuses.length
  ) {
    return false;
  }

  return left.tags.every((tag, index) => tag === right.tags[index]) &&
    left.statuses.every((status, index) => status === right.statuses[index]);
}

export function isDefaultListQuery(query: ListQueryState) {
  return query.search === DEFAULT_LIST_QUERY_STATE.search &&
    query.page === DEFAULT_LIST_QUERY_STATE.page &&
    query.pageSize === DEFAULT_LIST_QUERY_STATE.pageSize &&
    query.tags.length === DEFAULT_LIST_QUERY_STATE.tags.length &&
    query.statuses.length === DEFAULT_LIST_QUERY_STATE.statuses.length;
}

export function resetListQueryPage<T extends Pick<ListQueryState, "search" | "tags" | "statuses" | "page" | "pageSize">>(query: T): T {
  return {
    ...query,
    page: 1
  };
}
