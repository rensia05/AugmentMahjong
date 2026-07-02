(function () {
  function createNetworkAdapter({ onStatus, onMessage, onRoom }) {
    let socket = null;
    let clientId = "";
    let clientRoster = [];
    let hostId = "";
    let roomId = "";

    function resetConnectionState(status) {
      socket = null;
      clientId = "";
      clientRoster = [];
      hostId = "";
      roomId = "";
      onStatus(status);
      if (onRoom) onRoom({ roomId, hostId, clients: [] });
    }

    return {
      connect(url) {
        if (!window.WebSocket) {
          onStatus("이 브라우저는 WebSocket을 지원하지 않습니다.");
          return;
        }

        const websocketUrl = normalizeWebSocketUrl(url);
        socket = new WebSocket(websocketUrl);
        onStatus("연결 시도 중");

        socket.addEventListener("open", () => onStatus("온라인 연결됨"));
        socket.addEventListener("close", () => resetConnectionState("연결 종료"));
        socket.addEventListener("error", () => onStatus("연결 오류"));
        socket.addEventListener("message", event => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === "welcome") {
              clientId = message.payload.clientId;
              onStatus(`온라인 연결됨 · ${clientId} · 방 없음`);
              return;
            }
            if (message.type === "room") {
              roomId = message.payload.roomId || "";
              hostId = message.payload.hostId || "";
              clientRoster = message.payload.clients || [];
              onStatus(makeRoomStatus(clientId, roomId, hostId, clientRoster));
              if (onRoom) onRoom({ roomId, hostId, clients: [...clientRoster] });
              return;
            }
            if (message.type === "roster") {
              clientRoster = message.payload.clients || [];
              hostId = message.payload.hostId || hostId;
              roomId = message.payload.roomId || roomId;
              onStatus(makeRoomStatus(clientId, roomId, hostId, clientRoster));
              if (onRoom) onRoom({ roomId, hostId, clients: [...clientRoster] });
              return;
            }
            if (message.type === "leftRoom") {
              roomId = "";
              hostId = "";
              clientRoster = [];
              onStatus(`온라인 연결됨 · ${clientId} · 방 없음`);
              if (onRoom) onRoom({ roomId, hostId, clients: [] });
              return;
            }
            if (message.type === "error") onStatus(message.payload?.message || "서버 오류");
            onMessage(message);
          } catch (error) {
            onStatus("알 수 없는 서버 메시지");
          }
        });
      },
      send(type, payload) {
        if (!socket || socket.readyState !== WebSocket.OPEN) return;
        socket.send(JSON.stringify({ type, payload, clientId }));
      },
      createRoom(roomCode) {
        this.send("createRoom", { roomId: normalizeRoomId(roomCode) });
      },
      joinRoom(roomCode) {
        this.send("joinRoom", { roomId: normalizeRoomId(roomCode) });
      },
      leaveRoom() {
        this.send("leaveRoom", {});
      },
      disconnect() {
        if (socket && socket.readyState === WebSocket.OPEN) {
          socket.close();
        } else {
          resetConnectionState("연결 종료");
        }
      },
      isConnected() {
        return Boolean(socket && socket.readyState === WebSocket.OPEN);
      },
      getClientId() {
        return clientId;
      },
      getClientRoster() {
        return [...clientRoster];
      },
      getRoomId() {
        return roomId;
      },
      isInRoom() {
        return Boolean(roomId);
      },
      isHost() {
        return Boolean(roomId && clientId && clientId === hostId);
      }
    };
  }

  function normalizeWebSocketUrl(url) {
    const trimmed = String(url || "").trim();
    if (trimmed.startsWith("https://")) return trimmed.replace(/^https:\/\//, "wss://");
    if (trimmed.startsWith("http://")) return trimmed.replace(/^http:\/\//, "ws://");
    if (trimmed.startsWith("wss://") || trimmed.startsWith("ws://")) return trimmed;
    if (trimmed) {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      return `${protocol}//${trimmed}`;
    }
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}`;
  }

  function normalizeRoomId(roomCode) {
    return String(roomCode || "").trim().toUpperCase();
  }

  function makeRoomStatus(clientId, roomId, hostId, roster) {
    if (!roomId) return `온라인 연결됨 · ${clientId} · 방 없음`;
    return `방 ${roomId} · ${clientId}${clientId === hostId ? " · 방장" : ""} · ${roster.length}명`;
  }

  window.NetworkMultiplayer = { createNetworkAdapter };
})();
