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

  } else if (sentMsgType === TYPE_RESPONSE) { //if we respond with a response, we have received a request with response
    winBoxParams = { width: "300px", height: "200px", x: id*10+"px", y: id*10+"px" };

  } else if (sentMsgType === TYPE_SUBSCRIPTION_DATA) { //if we respond with subscription data, we have received a subscription request
    winBoxParams = { width: "300px", height: "400px", x: id*10+"px", y: id*10+"px" };
  }

  let w = new WinBox(title, winBoxParams);
  w.removeControl("wb-full");
  let term = $(w.body).terminal(function (cmd) {
    if (cmd !== "" && prompt !== "") {
      if (!!sendMessage(sentMsgType, id, method, cmd, sentMsgType !== TYPE_SUBSCRIPTION_DATA)) {
        if (sentMsgType === TYPE_RESPONSE) { //disable terminal after the first response (if only one response is expected)
          term.set_prompt("");
          term.freeze(true);
        }
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

  if (sentMsgType === TYPE_SUBSCRIPTION_DATA) { //if we have received a subscription request
    w.addControl({
      index: 0,
      class: "wb-close-subscription",
      image: "assets/stop.svg",
      click: function(event, wbox){
        if (!term.frozen()) { //if the terminal is not frozen when the close subscription button is clicked
          echoRaw(term, "-- SUBSCRIPTION CLOSED --", null);
          term.set_prompt("");
          term.freeze(true);

          //remove the id from the subscriptions map
          mapOngoingReceivedSubscriptionIdToTerminal.delete(id);

          //send a message flagged as the last one to close the subscription
          sendMessage(sentMsgType, id, method, null, true);
          wbox.removeControl("wb-close-subscription");
        }
      }
    });
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
    let wrappedMsg = {
      type: type,
      id: id,
      method: method
    };

    try {
      wrappedMsg.data = JSON.parse(msgString);

    } catch (e) {
      alert("Exception in JSON.parse(msgString): "+e.toString());
      return null;
    }

    if (last) {
      wrappedMsg.last = true;
    }

    if (type === TYPE_UNSUBSCRIPTION_REQUEST) {
      let terminal = mapOngoingSentSubscriptionIdToTerminal.get(id);
      echoRaw(terminal, "-- SUBSCRIPTION CLOSED --", null);
      terminal.set_prompt("");
      terminal.freeze(true);
      mapOngoingSentSubscriptionIdToTerminal.delete(id);
    }

    window.electronAPI.sendMessage(respChan, JSON.stringify(wrappedMsg));

    return wrappedMsg.data;
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
      if (msgObj.last) { //if this is the subscription's last message
        mapOngoingSentSubscriptionIdToTerminal.delete(msgObj.id);
        if (!terminal.frozen()) { //if the terminal is not already frozen
          echoRaw(terminal, "-- SUBSCRIPTION CLOSED --", null);
          terminal.set_prompt("");
          terminal.freeze(true);
        }
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
let newSubReqBtn = document.getElementById("new-sub-req-btn");

window.electronAPI.onConnectionClosed(() => {
  respChan = "";
  newReqBtn.disabled = true;
  newFfReqBtn.disabled = true;
  newSubReqBtn.disabled = true;
  alert("Connection closed");
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
  if (!!payloadObj) {
    let terminal = newTerminalForSentReq("Req #"+reqId+" ("+method+")", reqId, method, false);
    echoRaw(terminal, "> ", payloadObj);
    mapOngoingSentRequestIdToTerminal.set(reqId, terminal);
  }
});

newFfReqBtn.addEventListener("click", function() { //new sent fire&forget
  let method = document.getElementById("new-req-method").value;
  let dataStr = document.getElementById("new-req-data").value;

  if (!method || !dataStr) {
    alert("You must specify a method and a data string.");
    return;
  }

  let payloadObj = sendMessage(TYPE_REQUEST, 0, method, dataStr, false);
  if (!!payloadObj) {
    let terminal = newTerminalForSentReq("Fire&Forget Req (" + method + ")", 0, method, false);
    echoRaw(terminal, "> ", payloadObj);
  }
});

newSubReqBtn.addEventListener("click", function() { //new sent subscription request
  let method = document.getElementById("new-req-method").value;
  let dataStr = document.getElementById("new-req-data").value;

  if (!method || !dataStr) {
    alert("You must specify a method and a data string.");
    return;
  }

  lastSentSubId++;
  let subId = lastSentSubId;

  let payloadObj = sendMessage(TYPE_SUBSCRIPTION_REQUEST, subId, method, dataStr, false);
  if (!!payloadObj) {
    let terminal = newTerminalForSentReq("Sub #" + subId + " (" + method + ")", subId, method, true);
    echoRaw(terminal, "sub-req> ", payloadObj);
    mapOngoingSentSubscriptionIdToTerminal.set(subId, terminal);
  }
});
