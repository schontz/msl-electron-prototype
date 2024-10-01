// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { contextBridge, ipcRenderer } from "electron";

const electronBridge = {
  transformFrame: (operation: string, frame: any) => {
    return ipcRenderer.invoke('transform-frame', operation, frame);
  }
}

const whenDom = new Promise((resolve) => {
  window.addEventListener('DOMContentLoaded', () => {
    resolve('loaded');
  });
});

ipcRenderer.on('message-port', async (event) => {
  await whenDom;
  window.postMessage('message-port', '*', event.ports);
});

contextBridge.exposeInMainWorld('electronBridge', electronBridge);
