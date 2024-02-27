const TYPE_REQUEST = 0;
const TYPE_RESPONSE = 1;
const TYPE_SUBSCRIPTION_REQUEST = 2;
const TYPE_SUBSCRIPTION_DATA = 3;
const TYPE_UNSUBSCRIPTION_REQUEST = 4;

let respChan = "";

window.electronAPI.onSetRespChan((rCh) => {
  respChan = rCh;
});

//set prompt = "" to disable user input
function newTerminalForReceivedReq(title, id, method, sentMsgType, prompt) {
  let winBoxParams = {};
  if (id === 0) { //fire&forget request
    winBoxParams = { width: "300px", height: "150px", x: id*10+"px", y: id*10+"px" };

  } else if (sentMsgType === TYPE_RESPONSE) { //request with response
    winBoxParams = { width: "300px", height: "200px", x: id*10+"px", y: id*10+"px" };

  } else if (sentMsgType === TYPE_SUBSCRIPTION_DATA) { //subscription request
    winBoxParams = { width: "300px", height: "400px", x: id*10+"px", y: id*10+"px" };
  }

  let w = new WinBox(title, winBoxParams);
  w.removeControl("wb-full");
  let term = $(w.body).terminal(function (cmd) {
    if (cmd !== "" && prompt !== "") {
      sendMessage(sentMsgType, id, method, cmd, sentMsgType !== TYPE_SUBSCRIPTION_DATA);
      if (sentMsgType === TYPE_RESPONSE) { //disable terminal after the first response (if only one response is expected)
        term.set_prompt("");
        term.freeze(true);
      }
    }

  }, {
    greetings: "",
    name: title,
    clear: false,
    prompt: prompt === "" ? "" : (prompt + "> "),
    invokeMethods: false,
    scrollOnEcho: false
  });

  if (prompt === "") {
    term.freeze(true);
  }

  w.onclose = function(){
    if (!term.frozen()) { //if the terminal is not frozen when the window is closed
      //we should send an empty response (with last flag set to true for subscriptions)
      sendMessage(sentMsgType, id, method, null, sentMsgType === TYPE_SUBSCRIPTION_DATA);

      //remove the id from the subscriptions map
      mapOngoingReceivedSubscriptionIdToTerminal.delete(id);
    }
    return false; //return false to close the window
  };

  return term;
}

function newTerminalForSentReq(title, id, method, isSub) {
  let winBoxParams;
  if (isSub) { //subscription request sent, next sent messages are subscription updates, expected received messages are subscription data
    winBoxParams = { width: "300px", height: "400px", x: id*10+"px", y: id*10+"px" };

  } else { //sent request, expected response
    winBoxParams = { width: "300px", height: "200px", x: id*10+"px", y: id*10+"px" };
  }

  let w = new WinBox(title, winBoxParams);
  w.removeControl("wb-full");

  let term = $(w.body).terminal(function (cmd) {
    if (cmd !== "" && isSub) {
      sendMessage(TYPE_SUBSCRIPTION_REQUEST, id, method, cmd, false);
    }

  }, {
    greetings: "",
    name: title,
    clear: false,
    prompt: isSub ? "update-sub> " : "",
    invokeMethods: false,
    scrollOnEcho: false
  });

  if (isSub) {
    w.addControl({
      index: 0,
      class: "wb-unsubscribe",
      image: "assets/stop.svg",
      click: function(event, wbox){
        if (!term.frozen()) { //if the terminal is not frozen when the unsubscribe button is clicked
          //send an unsubscription request
          sendMessage(TYPE_UNSUBSCRIPTION_REQUEST, id, method, null, false);
          wbox.removeControl("wb-unsubscribe");
        }
      }
    });

  } else {
    term.freeze(true);
  }

  w.onclose = function(){
    if (!term.frozen()) { //if the terminal is not frozen when the window is closed
      if (isSub) { //if this was a subscription
        //we should send an unsubscription request
        sendMessage(TYPE_UNSUBSCRIPTION_REQUEST, id, method, null, false);

        //remove the terminal mapping
        mapOngoingSentSubscriptionIdToTerminal.delete(id);

      } else { //if this was a request
        //remove the terminal mapping
        mapOngoingSentRequestIdToTerminal.delete(id);
      }
    }
    return false; //return false to close the window
  };

  return term;
}

function sendMessage(type, id, method, msgString, last) {
  if (respChan !== "") {
    let payloadObj;
    try {
      payloadObj = JSON.parse(msgString)

    } catch (e) {
      alert("Exception in JSON.parse(msgString): "+e.toString())
    }
    let wrappedMsg = {
      type: type,
      id: id,
      method: method,
      data: payloadObj
    };
    if (last) {
      wrappedMsg.last = true;
    }
    window.electronAPI.sendMessage(respChan, JSON.stringify(wrappedMsg));

    return payloadObj;
  }
  return null;
}

let lastSentReqId = 0;
let lastSentSubId = 0;

let mapOngoingReceivedSubscriptionIdToTerminal = new Map();
let mapOngoingSentSubscriptionIdToTerminal = new Map();
let mapOngoingSentRequestIdToTerminal = new Map();

window.electronAPI.onMessage((msg) => handleIncomingMessage(JSON.parse(msg)));

function echoRaw(terminal, prompt, payload) {
  terminal.echo(prompt+(!payload ? "" : JSON.stringify(payload)), { raw: true });
}

function handleIncomingMessage(msgObj) {
  if (msgObj.type === TYPE_REQUEST && msgObj.id !== 0) { //request with response
    let terminal = newTerminalForReceivedReq("Req #"+msgObj.id+" ("+msgObj.method+")", msgObj.id, msgObj.method, TYPE_RESPONSE, "respond");
    echoRaw(terminal, "< ", msgObj.data);

  } else if (msgObj.type === TYPE_REQUEST && msgObj.id === 0) { //fire&forget request
    let terminal = newTerminalForReceivedReq("Fire&Forget Req ("+msgObj.method+")", msgObj.id, msgObj.method, -1, "");
    echoRaw(terminal, "< ", msgObj.data);

  } else if (msgObj.type === TYPE_RESPONSE) { //response
    if (mapOngoingSentRequestIdToTerminal.has(msgObj.id)) { //if the original request terminal still exists
      let terminal = mapOngoingSentRequestIdToTerminal.get(msgObj.id);
      echoRaw(terminal, "< ", msgObj.data);
      mapOngoingSentRequestIdToTerminal.delete(msgObj.id);
    }

  } else if (msgObj.type === TYPE_SUBSCRIPTION_REQUEST) { //subscription request
    if (mapOngoingReceivedSubscriptionIdToTerminal.has(msgObj.id)) { //subscription update
      let terminal = mapOngoingReceivedSubscriptionIdToTerminal.get(msgObj.id);
      echoRaw(terminal, "< ", msgObj.data);

    } else { //new subscription
      let terminal = newTerminalForReceivedReq("Sub #"+msgObj.id+" ("+msgObj.method+")", msgObj.id, msgObj.method, TYPE_SUBSCRIPTION_DATA, "send");
      echoRaw(terminal, "< ", msgObj.data);
      mapOngoingReceivedSubscriptionIdToTerminal.set(msgObj.id, terminal);
    }

  } else if (msgObj.type === TYPE_SUBSCRIPTION_DATA) { //subscription data
    if (mapOngoingSentSubscriptionIdToTerminal.has(msgObj.id)) { //if the subscription terminal still exists
      let terminal = mapOngoingSentSubscriptionIdToTerminal.get(msgObj.id);
      echoRaw(terminal, "< ", msgObj.data);
      if (msgObj.last) {
        echoRaw(terminal, "-- SUBSCRIPTION CLOSED --", null);
        terminal.set_prompt("");
        terminal.freeze(true);
        mapOngoingSentSubscriptionIdToTerminal.delete(msgObj.id);
      }
    }

  } else if (msgObj.type === TYPE_UNSUBSCRIPTION_REQUEST) { //unsubscription request
    let terminal = mapOngoingReceivedSubscriptionIdToTerminal.get(msgObj.id);
    echoRaw(terminal, "-- PEER HAS UNSUBSCRIBED --", null);
    terminal.set_prompt("");
    terminal.freeze(true);
    mapOngoingReceivedSubscriptionIdToTerminal.delete(msgObj.id);
  }
}

let newReqBtn = document.getElementById("new-req-btn");
let newFfReqBtn = document.getElementById("new-ff-req-btn");
let newsubReqBtn = document.getElementById("new-sub-req-btn");

window.electronAPI.onConnectionClosed(() => {
  respChan = "";
  alert("Connection closed");
  newReqBtn.disabled = true;
  newFfReqBtn.disabled = true;
  newsubReqBtn.disabled = true;
});

newReqBtn.addEventListener("click", function() { //new sent request (with response)
  let method = document.getElementById("new-req-method").value;
  let dataStr = document.getElementById("new-req-data").value;

  if (!method || !dataStr) {
    alert("You must specify a method and a data string.");
    return;
  }

  lastSentReqId++;
  let reqId = lastSentReqId;

  let payloadObj = sendMessage(TYPE_REQUEST, reqId, method, dataStr, false);

  let terminal = newTerminalForSentReq("Req #"+reqId+" ("+method+")", reqId, method, false);
  echoRaw(terminal, "> ", payloadObj);

  mapOngoingSentRequestIdToTerminal.set(reqId, terminal);
});

newFfReqBtn.addEventListener("click", function() { //new sent fire&forget
  let method = document.getElementById("new-req-method").value;
  let dataStr = document.getElementById("new-req-data").value;

  if (!method || !dataStr) {
    alert("You must specify a method and a data string.");
    return;
  }

  let payloadObj = sendMessage(TYPE_REQUEST, 0, method, dataStr, false);

  let terminal = newTerminalForSentReq("Fire&Forget Req ("+method+")", 0, method, false);
  echoRaw(terminal, "> ", payloadObj);
});

newsubReqBtn.addEventListener("click", function() { //new sent subscription request
  let method = document.getElementById("new-req-method").value;
  let dataStr = document.getElementById("new-req-data").value;

  if (!method || !dataStr) {
    alert("You must specify a method and a data string.");
    return;
  }

  lastSentSubId++;
  let subId = lastSentSubId;

  let payloadObj = sendMessage(TYPE_SUBSCRIPTION_REQUEST, subId, method, dataStr, false);

  let terminal = newTerminalForSentReq("Sub #"+subId+" ("+method+")", subId, method, true);
  echoRaw(terminal, "sub-req> ", payloadObj);

  mapOngoingSentSubscriptionIdToTerminal.set(subId, terminal);
});
