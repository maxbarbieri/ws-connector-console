const { app, BrowserWindow, ipcMain } = require('electron/main');
const path = require('path');
const { WebSocket, WebSocketServer } = require('ws');

let lastClientId = 0;

function createWindow(title) {
  const window = new BrowserWindow({
    title: title,
    webPreferences: {
      preload: path.join(__dirname, 'window/preload.js')
    },
  });
  window.loadFile(path.join(__dirname, 'window/window.html'));
  window.maximize();
  return window;
}

function printUsageAndExit() {
  console.log("Usage:\nServer > ws-connector-console -s PORT PATH\n\tExample: ws-connector-console -s 3000 /ws\n\nClient > ws-connector-console -c URL\n\tExample: ws-connector-console -c ws://localhost:3000/ws");
  app.exit(-1);
}

function validateCliArgs() {
  if (process.argv.length !== 3 && process.argv.length !== 4) {
    printUsageAndExit();
  }

  let listenPort = "";
  let listenPath = "";
  let serverUrl = "";
  if (process.argv[1] === "-s") {
    listenPort = process.argv[2];
    listenPath = process.argv[3];

  } else if (process.argv[1] === "-c") {
    serverUrl = process.argv[2];

  } else {
    printUsageAndExit();
  }

  return { listenPort, listenPath, serverUrl };
}

function main() {
  let { listenPort, listenPath, serverUrl } = validateCliArgs();

  app.on('ready', () => {
    //start console either in client mode or in server mode
    if (serverUrl !== "") { //client mode
      let wsConn = new WebSocket(serverUrl);
      wsConn.onopen = () => {
        let window = createWindow("[Client] WSC Console to Server "+serverUrl);
        linkWindowWithWebSocket(window, wsConn, "r2m_msg");
      };
      wsConn.onerror = () => {
        console.log("Can't connect to "+serverUrl);
        app.exit(-1);
      };

    } else { //server mode
      //keep the app running even if all windows are closed (because it may still accept new connections)
      app.on('window-all-closed', e => e.preventDefault());

      //start ws server
      const wsServer = new WebSocketServer({
        port: parseInt(listenPort),
        path: listenPath
      });
      wsServer.on('connection', (wsConn) => handleIncomingConnection(wsConn, listenPort, listenPath));
    }
  });
}

function linkWindowWithWebSocket(window, wsConn, respChan) {
  window.webContents.once("dom-ready", () => {
    window.webContents.send('set_resp_chan', respChan);

    ipcMain.on(respChan, (_event, msg) => {
      wsConn.send(msg);
    });

    wsConn.on('message', function(data, isBinary) {
      const msg = isBinary ? data : data.toString();

      //forward all messages from wsConn to the window
      window.webContents.send('m2r_msg', msg);
    });

    //close connection when the window is closed
    window.on("close", () => {
      ipcMain.removeHandler(respChan);
      window = null;
      if (wsConn != null) {
        wsConn.close();
      }
    });

    //tell window when the connection is closed
    wsConn.on("close", () => {
      wsConn = null;
      if (window != null) {
        window.webContents.send("m2r_conn_closed");
      }
    });
  });
}

function handleIncomingConnection(wsConn, listenPort, listenPath) {
  lastClientId++;
  let clientId = lastClientId;
  let respChan = "r2m_msg_"+clientId;
  let window = createWindow("[Server][:"+listenPort+listenPath+"] WSC Console from Client #"+clientId);
  linkWindowWithWebSocket(window, wsConn, respChan);
}

main();
