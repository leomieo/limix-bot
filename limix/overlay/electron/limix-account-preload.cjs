const { contextBridge, ipcRenderer } = require("electron");

// The Limix sign-in window: only these three calls, no app bridge, files or other credentials.
contextBridge.exposeInMainWorld("limixAccount", {
  login: (username, password) => ipcRenderer.invoke("limix-account:login", username, password),
  removeMachine: (username, password, id) => ipcRenderer.invoke("limix-account:remove", username, password, id),
  open: (which) => ipcRenderer.invoke("limix-account:open", which),
});
