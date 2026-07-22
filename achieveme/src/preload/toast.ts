import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron'
import type { UnlockToastPayload } from '../shared/types'

contextBridge.exposeInMainWorld('toastApi', {
  ready: (): void => {
    ipcRenderer.send('toast-ready')
  },
  onShow: (cb: (payload: UnlockToastPayload) => void): void => {
    const listener = (_event: IpcRendererEvent, payload: UnlockToastPayload): void => {
      cb(payload)
    }
    ipcRenderer.removeAllListeners('toast-show')
    ipcRenderer.on('toast-show', listener)
  },
  done: (): void => {
    ipcRenderer.send('toast-done')
  },
  click: (appid: string): void => {
    ipcRenderer.send('toast-click', appid)
  }
})
