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
  phase: "Phase 0";
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
