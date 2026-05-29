import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";

const defaultUrl = "http://localhost:3001";
const appUrl = normalizeUrl(process.env.WORKHORSE_DESKTOP_URL) ?? defaultUrl;
const healthUrl = new URL("/health", ensureTrailingSlash(appUrl)).toString();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;

function ensureTrailingSlash(url: string) {
  return url.endsWith("/") ? url : `${url}/`;
}

function normalizeUrl(value: string | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.replace(/\/$/, "");
}

function toDataUrl(html: string) {
  return `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
}

async function checkServiceReady() {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(healthUrl, {
      signal: controller.signal,
      headers: {
        Accept: "application/json"
      }
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

function renderUnavailableHtml() {
  return `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Workhorse Station Desktop</title>
    <style>
      :root {
        color-scheme: dark;
        font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #0b0c0f;
        color: #e5e7eb;
      }
      .panel {
        width: min(560px, calc(100vw - 48px));
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 20px;
        background: rgba(17, 24, 39, 0.92);
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
        padding: 28px;
      }
      h1 {
        margin: 0 0 10px;
        font-size: 22px;
      }
      p {
        margin: 0;
        color: #94a3b8;
        line-height: 1.6;
      }
      code {
        display: inline-block;
        margin-top: 12px;
        padding: 6px 10px;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.06);
        color: #f8fafc;
      }
      .actions {
        display: flex;
        gap: 12px;
        margin-top: 24px;
      }
      button {
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 10px;
        background: rgba(255, 255, 255, 0.06);
        color: #f8fafc;
        padding: 10px 16px;
        font-size: 14px;
        cursor: pointer;
      }
      button:hover {
        background: rgba(255, 255, 255, 0.12);
      }
      #status {
        margin-top: 16px;
        font-size: 13px;
        color: #cbd5e1;
      }
    </style>
  </head>
  <body>
    <main class="panel">
      <h1>未连接到 Workhorse Station 服务</h1>
      <p>请先确保 WSL 内的 systemd 用户服务已启动，然后重试。</p>
      <code>${appUrl}</code>
      <div class="actions">
        <button id="retry" type="button">重试连接</button>
        <button id="open" type="button">浏览器打开</button>
      </div>
      <div id="status"></div>
    </main>
    <script>
      const retryButton = document.getElementById("retry");
      const openButton = document.getElementById("open");
      const statusNode = document.getElementById("status");

      retryButton.addEventListener("click", async () => {
        retryButton.disabled = true;
        statusNode.textContent = "正在检查 localhost:3001 ...";
        const ok = await window.workhorseDesktop.retryConnection();
        if (!ok) {
          statusNode.textContent = "服务仍未就绪，请确认 WSL 中的 workhorse-station 服务状态。";
          retryButton.disabled = false;
        }
      });

      openButton.addEventListener("click", async () => {
        await window.workhorseDesktop.openTargetUrl();
      });
    </script>
  </body>
</html>`;
}

async function loadWindowContent(window: BrowserWindow) {
  if (await checkServiceReady()) {
    await window.loadURL(appUrl);
    return true;
  }

  await window.loadURL(toDataUrl(renderUnavailableHtml()));
  return false;
}

function createMainWindow() {
  const window = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1100,
    minHeight: 720,
    autoHideMenuBar: true,
    backgroundColor: "#0b0c0f",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  window.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  window.webContents.on("did-fail-load", (_event, _errorCode, _errorDescription, validatedUrl, isMainFrame) => {
    if (isMainFrame && validatedUrl.startsWith(appUrl)) {
      void window.loadURL(toDataUrl(renderUnavailableHtml()));
    }
  });

  void loadWindowContent(window);
  return window;
}

ipcMain.handle("workhorse-desktop:get-target-url", () => appUrl);
ipcMain.handle("workhorse-desktop:open-target-url", async () => {
  await shell.openExternal(appUrl);
});
ipcMain.handle("workhorse-desktop:retry-connection", async () => {
  if (!mainWindow) {
    return false;
  }

  return loadWindowContent(mainWindow);
});

app.whenReady().then(() => {
  mainWindow = createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
