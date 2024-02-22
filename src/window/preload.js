const { contextBridge, ipcRenderer } = require('electron/renderer')

contextBridge.exposeInMainWorld('electronAPI', {
    onMessage: (callback) => ipcRenderer.on('m2r_msg', (_event, msg) => callback(msg)),
    onSetRespChan: (callback) => ipcRenderer.on('set_resp_chan', (_event, respChan) => callback(respChan)),
    onConnectionClosed: (callback) => ipcRenderer.on('m2r_conn_closed', (_event) => callback()),
    sendMessage: (resp_chan, msg) => ipcRenderer.send(resp_chan, msg)
});
