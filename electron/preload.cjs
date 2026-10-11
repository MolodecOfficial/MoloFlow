const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronUpdater', {
    checkUpdates: () => ipcRenderer.invoke('updater:check'),
    startDownload: (downloadUrl) => ipcRenderer.invoke('updater:download', downloadUrl),
    installUpdate: () => ipcRenderer.invoke('updater:install'),
    onProgress: (callback) => {
        const handler = (_, progress) => callback(progress)
        ipcRenderer.on('updater:progress', handler)
        return () => ipcRenderer.removeListener('updater:progress', handler)
    },
    onComplete: (callback) => {
        const handler = (_, info) => callback(info)
        ipcRenderer.on('updater:complete', handler)
        return () => ipcRenderer.removeListener('updater:complete', handler)
    },
    onError: (callback) => {
        const handler = (_, err) => callback(err)
        ipcRenderer.on('updater:error', handler)
        return () => ipcRenderer.removeListener('updater:error', handler)
    }
})