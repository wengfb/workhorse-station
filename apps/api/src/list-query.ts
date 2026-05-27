import type { ListQuery } from "@workhorse-station/shared";

type RawListQuery = {
  search?: string;
  tags?: string;
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

  return {
    search,
    tags: tags?.length ? tags : undefined,
    page: page && page > 0 ? page : undefined,
    pageSize: pageSize && pageSize > 0 && pageSize <= 100 ? pageSize : undefined
  };
}
