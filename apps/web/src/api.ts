import type {
  ApiResponse,
  CreateProjectRequest,
  CreateWorktreeRequest,
  DeleteProjectResponse,
  DeleteWorktreeRequest,
  DeleteWorktreeResponse,
  HealthResponse,
  MetaResponse,
  ProjectResponse,
  ProjectsResponse,
  UpdateProjectRequest,
  WorktreeResponse,
  WorktreesResponse
} from "@workhorse-station/shared";

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function getHealth() {
  return fetchJson<HealthResponse>("/health");
}

export function getMeta() {
  return fetchJson<MetaResponse>("/api/meta");
}

export function getProjects() {
  return fetchJson<ProjectsResponse>("/api/projects");
}

export function createProject(input: CreateProjectRequest) {
  return fetchJson<ProjectResponse>("/api/projects", {
    method: "POST",
    body: input
  });
}

export function updateProject(id: string, input: UpdateProjectRequest) {
  return fetchJson<ProjectResponse>(`/api/projects/${id}`, {
    method: "PATCH",
    body: input
  });
}

export function deleteProject(id: string) {
  return fetchJson<DeleteProjectResponse>(`/api/projects/${id}`, {
    method: "DELETE"
  });
}

export function getWorktrees(projectId: string) {
  return fetchJson<WorktreesResponse>(`/api/projects/${projectId}/worktrees`);
}

export function createWorktree(projectId: string, input: CreateWorktreeRequest) {
  return fetchJson<WorktreeResponse>(`/api/projects/${projectId}/worktrees`, {
    method: "POST",
    body: input
  });
}

export function deleteWorktree(projectId: string, worktreeId: string, input: DeleteWorktreeRequest) {
  return fetchJson<DeleteWorktreeResponse>(`/api/projects/${projectId}/worktrees/${worktreeId}`, {
    method: "DELETE",
    body: input
  });
}

type FetchOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
};

async function fetchJson<T>(url: string, options: FetchOptions = {}): Promise<T> {
  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers: options.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });

  const payload = (await response.json()) as ApiResponse<T>;

  if (!response.ok || !payload.ok) {
    if (payload.ok) {
      throw new ApiError("http_error", `${url} 返回 ${response.status}`, response.status);
    }

    throw new ApiError(payload.error.code, payload.error.message, response.status);
  }

  return payload.data;
}
