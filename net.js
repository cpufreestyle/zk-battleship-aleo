/**
 * net.js — 互联网联机对战模块（PeerJS / WebRTC）
 *
 * 流程：
 * 1. 主机创建房间 → 生成房间号（PeerID）
 * 2. 客机输入房间号 → 建立连接
 * 3. 双方各自放船 → 放完后交换 ship bitstring（通过 ZK 验证而非明文传输）
 * 4. 开火/结果通过 DataChannel 实时同步
 *
 * 隐私设计：
 * - 不直接传输 ship bitstring，而是传输 ZK 证明结果
 * - 对方只能验证命中/未命中，看不到船位
 */

let _peer = null;
let _conn = null; // DataConnection
let _isHost = false;
let _roomCode = "";
let _onMessage = null;
let _onStatus = null;
let _onConnected = null;

/** PeerJS 配置 — 免费信令 + STUN打洞 + TURN中继兜底 */
const PEER_CONFIG = {
  config: {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun.cloudflare.com:3478" },
      // Open Relay 免费 TURN —— 关键：P2P 打洞失败时走中继，否则直接超时
      { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
      { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
      { urls: "turn:openrelay.metered.ca:443?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
    ],
    iceCandidatePoolSize: 10,
  },
  debug: 2,
};

/** 动态加载 PeerJS 库 —— jsdelivr 优先（国内可达），unpkg 兜底 */
const PEERJS_CDNS = [
  "https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js",
  "https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js",
];

async function loadPeerJS() {
  if (window.Peer) return window.Peer;
  for (const url of PEERJS_CDNS) {
    try {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = url;
        script.onload = resolve;
        script.onerror = () => { script.remove(); reject(new Error("load fail")); };
        document.head.appendChild(script);
      });
      if (window.Peer) return window.Peer;
    } catch (_) { /* try next CDN */ }
  }
  throw new Error("PeerJS 加载失败（所有CDN均不可达）");
}

/** 生成 4 位房间号 */
function generateRoomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

/** 创建房间（主机） */
async function createRoom(onStatus, onMessage, onConnected) {
  _onStatus = onStatus;
  _onMessage = onMessage;
  _onConnected = onConnected;
  _isHost = true;

  try {
    onStatus("正在加载联机模块…");
    const Peer = await loadPeerJS();

    _roomCode = "sf-" + generateRoomCode();
    onStatus(`创建房间中… 房间号: ${_roomCode}`);

    _peer = new Peer(_roomCode, PEER_CONFIG);

    // 主机注册超时：信令服务器不可达时快速反馈
    const hostOpenTimeout = setTimeout(() => {
      if (!_peer || !_peer.open) {
        onStatus("信令服务器连接超时\n• 请检查网络/代理后重试");
      }
    }, 10000);

    _peer.on("open", (id) => {
      clearTimeout(hostOpenTimeout);
      onStatus(`房间已创建！房间号: ${_roomCode.substring(3)}\n等待对手加入…`);
    });

    _peer.on("connection", (conn) => {
      // 关键修复：等 conn 完全打开后再设置
      conn.on("open", () => {
        _conn = conn;
        setupConnection(conn);
      });
      conn.on("error", (err) => {
        console.error("[NET] host conn error:", err);
        onStatus(`对手连接失败: ${err.message}`);
      });
    });

    _peer.on("error", (err) => {
      console.error("[NET] Peer error:", err);
      if (err.type === "unavailable-id") {
        onStatus("房间号已被占用，请重试");
      } else if (err.type === "network" || err.type === "server-error") {
        onStatus("网络错误，请检查网络后重试");
      } else {
        onStatus(`连接错误: ${err.type || err.message}`);
      }
    });

    return _roomCode;
  } catch (e) {
    onStatus(`初始化失败: ${e.message}`);
    return null;
  }
}

/** 加入房间（客机） */
async function joinRoom(code, onStatus, onMessage, onConnected) {
  _onStatus = onStatus;
  _onMessage = onMessage;
  _onConnected = onConnected;
  _isHost = false;
  _roomCode = "sf-" + code.toUpperCase();

  try {
    onStatus("正在加载联机模块…");
    const Peer = await loadPeerJS();

    // 客机用随机 ID
    _peer = new Peer(PEER_CONFIG);

    // peer 注册超时：信令服务器不可达时快速失败，而不是干等
    const openTimeout = setTimeout(() => {
      if (!_peer || !_peer.open) {
        onStatus("信令服务器连接超时\n• 请检查网络/代理\n• 稍后重试");
      }
    }, 10000);

    _peer.on("open", (id) => {
      clearTimeout(openTimeout);
      onStatus(`正在连接房间 ${code}…`);
      _conn = _peer.connect(_roomCode, { reliable: true });

      // 关键修复：监听 conn 的 open 事件，不要在 peer open 后立刻发消息
      _conn.on("open", () => {
        setupConnection(_conn);
        // DataChannel 已打开，安全发送 join 消息
        _conn.send({ type: "join", id: id });
      });

      _conn.on("error", (err) => {
        console.error("[NET] conn error:", err);
        onStatus(`连接失败: ${err.message || "房间不存在或已满"}`);
      });

      // 连接超时（20秒）—— 覆盖 STUN打洞+TURN协商
      const timeout = setTimeout(() => {
        if (!_conn || !_conn.open) {
          onStatus("连接超时，请检查房间号或网络\n• 确认主机已创建房间\n• 确认双方网络正常\n• 可能需要开启代理/VPN");
        }
      }, 20000);

      // 连接成功后清除超时
      _conn.on("open", () => clearTimeout(timeout));
    });

    _peer.on("error", (err) => {
      console.error("[NET] Peer error:", err);
      if (err.type === "peer-unavailable") {
        onStatus("房间不存在或主机已关闭\n请确认房间号正确");
      } else if (err.type === "network" || err.type === "server-error") {
        onStatus("网络错误，可能需要开启代理/VPN");
      } else {
        onStatus(`连接错误: ${err.type || err.message}`);
      }
    });

  } catch (e) {
    onStatus(`初始化失败: ${e.message}`);
  }
}

/** 设置 DataChannel 事件 */
function setupConnection(conn) {
  // conn 应该已经 open 了（调用方确保）
  conn.on("data", (data) => {
    console.log("[NET] received:", data.type || data);
    if (_onMessage) _onMessage(data);
  });

  conn.on("close", () => {
    console.log("[NET] connection closed");
    if (_onStatus) _onStatus("对手已断开连接");
    if (_onMessage) _onMessage({ type: "disconnect" });
  });

  conn.on("error", (err) => {
    console.error("[NET] Conn error:", err);
    if (_onStatus) _onStatus(`连接错误: ${err.message}`);
  });

  // 触发连接成功回调
  if (_onConnected) {
    console.log("[NET] connection established, isHost:", _isHost);
    _onConnected(_isHost);
  }
}

/** 发送消息 */
function send(data) {
  if (_conn && _conn.open) {
    _conn.send(data);
    return true;
  }
  return false;
}

/** 是否已连接 */
function isConnected() {
  return _conn && _conn.open;
}

/** 是否是主机 */
function isHost() {
  return _isHost;
}

/** 获取房间号 */
function getRoomCode() {
  return _roomCode;
}

/** 断开连接 */
function disconnect() {
  if (_conn) { try { _conn.close(); } catch (_) {} _conn = null; }
  if (_peer) { try { _peer.destroy(); } catch (_) {} _peer = null; }
  _isHost = false;
  _roomCode = "";
}

export const Net = {
  createRoom,
  joinRoom,
  send,
  isConnected,
  isHost,
  getRoomCode,
  disconnect,
};
