import { contextBridge } from 'electron'

// All IPC channels are exposed in PLAN-04
contextBridge.exposeInMainWorld('api', {})
