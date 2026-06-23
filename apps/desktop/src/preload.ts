import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("workhorseDesktop", {
  getTargetUrl: () => ipcRenderer.invoke("workhorse-desktop:get-target-url") as Promise<string>,
  openTargetUrl: () => ipcRenderer.invoke("workhorse-desktop:open-target-url") as Promise<void>,
  retryConnection: () => ipcRenderer.invoke("workhorse-desktop:retry-connection") as Promise<boolean>,
  writeClipboard: (text: string) => ipcRenderer.invoke("workhorse-desktop:write-clipboard", text) as Promise<boolean>
});
