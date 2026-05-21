import { useEffect, useMemo, useState } from "react";
import type { ApiResponse, HealthResponse, MetaResponse, ProjectsResponse } from "@workhorse-station/shared";

type ApiState = {
  health: ApiResponse<HealthResponse> | null;
  meta: ApiResponse<MetaResponse> | null;
  projects: ApiResponse<ProjectsResponse> | null;
  loading: boolean;
  error: string | null;
};

const mainTabs = ["总览", "项目", "笔记", "待办", "Skill", "会话", "历史"];
const sideTabs = ["终端", "AI 聊天", "会话输出"];

const featureCards = [
  { title: "项目", value: "0", detail: "等待接入项目 CRUD" },
  { title: "Worktree", value: "0", detail: "Phase 1 管理项目级 worktree" },
  { title: "待办", value: "0", detail: "Phase 2 支持笔记转待办" },
  { title: "会话", value: "0", detail: "Phase 5 接入 Claude Code" }
];

export function App() {
  const [activeMainTab, setActiveMainTab] = useState(mainTabs[0]);
  const [activeSideTab, setActiveSideTab] = useState(sideTabs[0]);
  const [apiState, setApiState] = useState<ApiState>({
    health: null,
    meta: null,
    projects: null,
    loading: true,
    error: null
  });

  useEffect(() => {
    let cancelled = false;

    async function loadApiState() {
      try {
        const [health, meta, projects] = await Promise.all([
          fetchJson<HealthResponse>("/health"),
          fetchJson<MetaResponse>("/api/meta"),
          fetchJson<ProjectsResponse>("/api/projects")
        ]);

        if (!cancelled) {
          setApiState({ health, meta, projects, loading: false, error: null });
        }
      } catch (error) {
        if (!cancelled) {
          setApiState((current) => ({
            ...current,
            loading: false,
            error: error instanceof Error ? error.message : "API 连接失败"
          }));
        }
      }
    }

    void loadApiState();

    return () => {
      cancelled = true;
    };
  }, []);

  const apiConnected = apiState.health?.ok === true;
  const projectCount = apiState.projects?.ok ? apiState.projects.data.projects.length : 0;
  const databaseInfo = apiState.meta?.ok ? apiState.meta.data.database : null;

  const sideContent = useMemo(() => {
    if (activeSideTab === "AI 聊天") {
      return <ChatPlaceholder />;
    }

    if (activeSideTab === "会话输出") {
      return <SessionPlaceholder />;
    }

    return <TerminalPlaceholder apiConnected={apiConnected} />;
  }, [activeSideTab, apiConnected]);

  return (
    <div className="flex min-h-screen flex-col bg-[#0b0c10] text-slate-100">
      <header className="flex h-16 items-center gap-3 border-b border-white/10 bg-[#111318] px-5">
        <div className="mr-2">
          <div className="text-sm font-semibold tracking-wide">Workhorse Station</div>
          <div className="text-xs text-slate-400">Phase 0 工程骨架</div>
        </div>
        <button className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">项目：未选择</button>
        <button className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-200">worktree：main</button>
        <input
          className="min-w-72 flex-1 rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm outline-none placeholder:text-slate-500 focus:border-slate-400"
          placeholder="搜索项目、笔记、待办、Skill"
        />
        <button className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-950">新建笔记</button>
        <button className="rounded-lg border border-white/10 px-3 py-2 text-sm text-slate-200">新建待办</button>
        <button className="rounded-lg border border-emerald-400/40 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-200">新建会话</button>
      </header>

      <main className="grid flex-1 grid-cols-[minmax(0,1fr)_420px] overflow-hidden">
        <section className="flex min-w-0 flex-col border-r border-white/10 bg-[#0f1117]">
          <nav className="flex gap-1 border-b border-white/10 px-5 py-3">
            {mainTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveMainTab(tab)}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  activeMainTab === tab ? "bg-white text-slate-950" : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                }`}
              >
                {tab}
              </button>
            ))}
          </nav>

          <div className="flex-1 overflow-auto p-5">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-semibold">{activeMainTab}</h1>
                <p className="mt-1 text-sm text-slate-400">Notion 风格的列表 / 详情联动区域，当前是 Phase 0 占位骨架。</p>
              </div>
              <StatusPill connected={apiConnected} loading={apiState.loading} />
            </div>

            <div className="grid grid-cols-4 gap-3">
              {featureCards.map((card) => (
                <article key={card.title} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="text-xs text-slate-500">{card.title}</div>
                  <div className="mt-2 text-2xl font-semibold">{card.title === "项目" ? projectCount : card.value}</div>
                  <div className="mt-2 text-xs text-slate-400">{card.detail}</div>
                </article>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-[minmax(0,0.95fr)_minmax(320px,0.65fr)] gap-4">
              <section className="rounded-xl border border-white/10 bg-[#151821]">
                <div className="border-b border-white/10 px-4 py-3 text-sm font-medium">列表视图</div>
                <div className="divide-y divide-white/10">
                  {["绑定第一个项目", "创建项目级 worktree", "记录随手记", "生成 Claude Code prompt"].map((item, index) => (
                    <div key={item} className="flex items-center justify-between px-4 py-3 text-sm">
                      <div>
                        <div className="text-slate-200">{item}</div>
                        <div className="text-xs text-slate-500">MVP 闭环步骤 {index + 1}</div>
                      </div>
                      <span className="rounded-full border border-white/10 px-2 py-1 text-xs text-slate-400">待实现</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-xl border border-white/10 bg-[#151821]">
                <div className="border-b border-white/10 px-4 py-3 text-sm font-medium">详情 / 属性</div>
                <div className="space-y-4 p-4 text-sm text-slate-300">
                  <DetailRow label="当前阶段" value="Phase 0" />
                  <DetailRow label="API 状态" value={apiConnected ? "已连接" : apiState.loading ? "连接中" : "未连接"} />
                  <DetailRow label="SQLite" value={databaseInfo?.connected ? "已初始化" : "等待后端"} />
                  <DetailRow label="FTS5" value={databaseInfo ? (databaseInfo.fts5 ? "可用" : "不可用") : "未知"} />
                  {apiState.error ? <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">{apiState.error}</p> : null}
                </div>
              </section>
            </div>
          </div>
        </section>

        <aside className="flex min-w-0 flex-col bg-[#101114]">
          <div className="flex border-b border-white/10 p-3">
            {sideTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveSideTab(tab)}
                className={`flex-1 rounded-md px-3 py-2 text-sm ${
                  activeSideTab === tab ? "bg-white text-slate-950" : "text-slate-400 hover:bg-white/5 hover:text-slate-100"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="flex-1 overflow-auto p-4">{sideContent}</div>
        </aside>
      </main>
    </div>
  );
}

async function fetchJson<T>(url: string): Promise<ApiResponse<T>> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`${url} 返回 ${response.status}`);
  }

  return response.json() as Promise<ApiResponse<T>>;
}

function StatusPill({ connected, loading }: { connected: boolean; loading: boolean }) {
  const label = loading ? "API 连接中" : connected ? "API 已连接" : "API 未连接";
  const className = connected
    ? "border-emerald-400/40 bg-emerald-400/10 text-emerald-200"
    : "border-amber-400/40 bg-amber-400/10 text-amber-200";

  return <span className={`rounded-full border px-3 py-1 text-xs ${className}`}>{label}</span>;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="text-right text-slate-100">{value}</span>
    </div>
  );
}

function TerminalPlaceholder({ apiConnected }: { apiConnected: boolean }) {
  return (
    <div className="h-full rounded-xl border border-white/10 bg-black p-4 font-mono text-sm text-emerald-200">
      <div>$ workhorse-station</div>
      <div className="mt-2 text-slate-500">右侧默认终端占位，后续接入 xterm.js 与 PTY。</div>
      <div className="mt-4">API: {apiConnected ? "connected" : "waiting"}</div>
      <div className="mt-1">phase: 0</div>
      <div className="mt-1 animate-pulse">_</div>
    </div>
  );
}

function ChatPlaceholder() {
  return (
    <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm">
      <div className="rounded-lg bg-white/10 p-3 text-slate-200">AI 聊天窗口占位</div>
      <div className="rounded-lg border border-white/10 p-3 text-slate-400">后续接入 Claude SDK、工具调用和草稿确认。</div>
      <input className="w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 outline-none" placeholder="输入任务、笔记或 prompt 需求" />
    </div>
  );
}

function SessionPlaceholder() {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
      <div className="font-medium text-slate-100">Claude Code 会话输出</div>
      <p className="mt-2 text-slate-400">Phase 5 将绑定项目、worktree、prompt 和待办，并保存会话摘要。</p>
    </div>
  );
}
