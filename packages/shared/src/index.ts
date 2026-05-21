export type ApiSuccess<T> = {
  ok: true;
  data: T;
};

export type ApiFailure = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
};

export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export type HealthResponse = {
  status: "ok";
  service: "workhorse-station-api";
  timestamp: string;
};

export type MetaResponse = {
  appName: "Workhorse Station";
  phase: "Phase 1";
  database: {
    connected: boolean;
    path: string;
    fts5: boolean;
  };
};

export type ProjectSummary = {
  id: string;
  name: string;
  path: string;
  defaultBranch: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProjectsResponse = {
  projects: ProjectSummary[];
};

export type ProjectResponse = {
  project: ProjectSummary;
};

export type CreateProjectRequest = {
  name: string;
  path: string;
  defaultBranch?: string;
  description?: string | null;
};

export type UpdateProjectRequest = Partial<CreateProjectRequest>;

export type DeleteProjectResponse = {
  deleted: true;
};

export type WorktreeStatus = "clean" | "dirty" | "missing" | "unknown";

export type WorktreeSummary = {
  id: string;
  projectId: string;
  name: string;
  path: string;
  branch: string;
  status: WorktreeStatus;
  createdAt: string;
  updatedAt: string;
};

export type WorktreesResponse = {
  worktrees: WorktreeSummary[];
};

export type WorktreeResponse = {
  worktree: WorktreeSummary;
};

export type CreateWorktreeRequest = {
  name: string;
  branch?: string;
  baseBranch?: string;
};

export type DeleteWorktreeRequest = {
  confirmBranch: string;
};

export type DeleteWorktreeResponse = {
  deleted: true;
  deletedBranch: string;
};
