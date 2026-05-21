import type {
  ApiResponse,
  CreateProjectRequest,
  DeleteProjectResponse,
  HealthResponse,
  MetaResponse,
  ProjectResponse,
  ProjectsResponse,
  UpdateProjectRequest
} from "@workhorse-station/shared";

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
    throw new Error(payload.ok ? `${url} 返回 ${response.status}` : payload.error.message);
  }

  return payload.data;
}
