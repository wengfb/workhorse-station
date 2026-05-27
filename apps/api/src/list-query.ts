import type { ListQuery, TodoStatus } from "@workhorse-station/shared";

const todoStatuses = new Set<TodoStatus>(["draft", "pending", "in_progress", "completed"]);

type RawListQuery = {
  search?: string;
  tags?: string;
  statuses?: string;
  page?: string;
  pageSize?: string;
};

export function parseListQuery(query: RawListQuery): ListQuery {
  const page = query.page ? parseInt(query.page, 10) : undefined;
  const pageSize = query.pageSize ? parseInt(query.pageSize, 10) : undefined;
  const search = query.search?.trim() || undefined;
  const tags = query.tags
    ? query.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean)
    : undefined;
  const statuses = query.statuses
    ? query.statuses
        .split(",")
        .map((status) => status.trim())
        .filter((status): status is TodoStatus => todoStatuses.has(status as TodoStatus))
    : undefined;

  return {
    search,
    tags: tags?.length ? tags : undefined,
    statuses: statuses?.length ? statuses : undefined,
    page: page && page > 0 ? page : undefined,
    pageSize: pageSize && pageSize > 0 && pageSize <= 100 ? pageSize : undefined
  };
}
