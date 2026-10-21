
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import {
  getDatabase,
  ref,
  get,
  set,
  push,
  onValue,
  runTransaction,
  remove
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDbEtb9S2Mnqx02EQl2rwhonE1kg8XbmIw",
  authDomain: "chefdesk-games.firebaseapp.com",
  databaseURL: "https://chefdesk-games-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "chefdesk-games",
  storageBucket: "chefdesk-games.firebasestorage.app",
  messagingSenderId: "171693424148",
  appId: "1:171693424148:web:daa340e425a9a692e97101",
  measurementId: "G-GPGVNQCB4T"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const database = getDatabase(app);

const $ = id => document.getElementById(id);

const lobbyScreen = $("lobbyScreen");
const roomScreen = $("roomScreen");
const gameScreen = $("gameScreen");
const resultsScreen = $("resultsScreen");

const canvas = $("drawingCanvas");
const ctx = canvas.getContext("2d");

const FOOD_WORDS = [
  "Pizza", "Burger", "Biryani", "Dosa", "Idli",
  "Sandwich", "French Fries", "Ice Cream", "Coffee",
  "Milkshake", "Pasta", "Noodles", "Donut", "Cake",
  "Taco", "Popcorn", "Pancake", "Samosa", "Momos",
  "Cupcake", "Watermelon", "Banana", "Strawberry",
  "Hot Dog", "Waffle", "Cookie", "Lemonade",
  "Chocolate", "Croissant", "Pineapple"
];

const ROUND_SECONDS = 60;
const MAX_PLAYERS = 8;
const ROUNDS_PER_PLAYER = 3;

let uid = "";
let roomCode = "";
let roomData = null;
let unsubscribeRoom = null;
let unsubscribeStrokes = null;
let unsubscribeMessages = null;
let localRoundKey = "";
let lastRoomStatus = "";
let drawing = false;
let lastPoint = null;
let lastDrawTime = 0;
let brushColor = "#203a2c";
let brushSize = 9;
let eraserMode = false;
let roundTransitioning = false;
let lastTimer = -1;

function showScreen(screen) {
  [lobbyScreen, roomScreen, gameScreen, resultsScreen]
    .forEach(element => {
      element.classList.toggle("hidden", element !== screen);
    });
}

function setStatus(message) {
  $("globalStatus").textContent = message;
}

function safeName(name) {
  return name.trim().replace(/\s+/g, " ").slice(0, 18);
}

function normalizeAnswer(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function randomCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";

  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return code;
}

function randomWord() {
  return FOOD_WORDS[Math.floor(Math.random() * FOOD_WORDS.length)];
}

function getPlayers(room = roomData) {
  return Object.entries(room?.players || {})
    .map(([id, player]) => ({ id, ...player }));
}

function getSortedPlayers(room = roomData) {
  return getPlayers(room).sort((a, b) =>
    (b.score || 0) - (a.score || 0)
  );
}

function isHost() {
  return roomData?.hostId === uid;
}

function isDrawer() {
  return roomData?.game?.drawerId === uid;
}

function isPlaying() {
  return roomData?.status === "playing";
}

function getRoomRef() {
  return ref(database, `drawGuessRooms/${roomCode}`);
}

function getRoundKey(room = roomData) {
  return `${room?.game?.round || 0}-${room?.game?.startedAt || 0}`;
}

function setButtonBusy(button, busy) {
  button.disabled = busy;
}

async function ensureLogin() {
  if (auth.currentUser) {
    uid = auth.currentUser.uid;
    return;
  }

  const credential = await signInAnonymously(auth);
  uid = credential.user.uid;
}

function getNickname() {
  const name = safeName($("playerName").value);

  if (!name) {
    throw new Error("Enter your nickname first.");
  }

  return name;
}

function createPlayer(name) {
  return {
    name,
    score: 0,
    joinedAt: Date.now()
  };
}

async function createRoom() {
  const button = $("createRoom");

  try {
    setButtonBusy(button, true);
    setStatus("");

    const name = getNickname();
    await ensureLogin();

    let code = "";

    for (let attempt = 0; attempt < 10; attempt++) {
      const candidate = randomCode();
      const snapshot = await get(
        ref(database, `drawGuessRooms/${candidate}`)
      );

      if (!snapshot.exists()) {
        code = candidate;
        break;
      }
    }

    if (!code) {
      throw new Error("Couldn't generate a room code. Try again.");
    }

    const newRoom = {
      hostId: uid,
      status: "waiting",
      createdAt: Date.now(),
      players: {
        [uid]: createPlayer(name)
      }
    };

    const result = await runTransaction(
      ref(database, `drawGuessRooms/${code}`),
      current => current === null ? newRoom : undefined,
      { applyLocally: false }
    );

    if (!result.committed) {
      throw new Error("Room code already exists. Try again.");
    }

    connectRoom(code);
  } catch (error) {
    setStatus(error.message);
  } finally {
    setButtonBusy(button, false);
  }
}

async function joinRoom() {
  const button = $("joinRoom");

  try {
    setButtonBusy(button, true);
    setStatus("");

    const name = getNickname();
    const code = $("roomCodeInput").value
      .trim()
      .toUpperCase();

    if (!/^[A-Z2-9]{6}$/.test(code)) {
      throw new Error("Enter a valid 6-character room code.");
    }

    await ensureLogin();

    let failure = "Unable to join this room.";

    const result = await runTransaction(
      ref(database, `drawGuessRooms/${code}`),
      room => {
        if (!room) {
          failure = "Room not found.";
          return;
        }

        if (room.status !== "waiting") {
          failure = "This game has already started.";
          return;
        }

        if (
          !room.players?.[uid] &&
          Object.keys(room.players || {}).length >= MAX_PLAYERS
        ) {
          failure = "This room is full.";
          return;
        }

        room.players ||= {};
        room.players[uid] ||= createPlayer(name);

        return room;
      },
      { applyLocally: false }
    );

    if (!result.committed) {
      throw new Error(failure);
    }

    connectRoom(code);
  } catch (error) {
    setStatus(error.message);
  } finally {
    setButtonBusy(button, false);
  }
}

function disconnectListeners() {
  if (unsubscribeRoom) unsubscribeRoom();
  if (unsubscribeStrokes) unsubscribeStrokes();
  if (unsubscribeMessages) unsubscribeMessages();

  unsubscribeRoom = null;
  unsubscribeStrokes = null;
  unsubscribeMessages = null;
}

function connectRoom(code) {
  disconnectListeners();

  roomCode = code;
  roomData = null;
  localRoundKey = "";
  lastRoomStatus = "";
  lastTimer = -1;

  $("roomCodeDisplay").textContent = code;
  showScreen(roomScreen);

  unsubscribeRoom = onValue(
    getRoomRef(),
    snapshot => {
      const room = snapshot.val();

      if (!room || !room.players?.[uid]) {
        disconnectListeners();
        roomCode = "";
        roomData = null;
        showScreen(lobbyScreen);
        setStatus("Room closed or you have left the game.");
        return;
      }

      roomData = room;
      renderRoom();
    },
    error => setStatus(error.message)
  );
}

function renderRoom() {
  if (!roomData) return;

  const status = roomData.status;

  if (status === "waiting") {
    showScreen(roomScreen);
    renderWaitingRoom();
  } else if (status === "playing") {
    showScreen(gameScreen);
    renderGame();
  } else if (status === "roundEnd" || status === "finished") {
    showScreen(resultsScreen);
    renderResults();
  }

  lastRoomStatus = status;
}

function renderWaitingRoom() {
  const players = getPlayers();

  $("playerCount").textContent = `${players.length} / ${MAX_PLAYERS}`;
  $("roomPlayers").replaceChildren();

  players.forEach(player => {
    const item = document.createElement("div");
    item.className = "player-card";

    const avatar = document.createElement("span");
    avatar.className = "player-avatar";
    avatar.textContent = "🍽️";

    const name = document.createElement("span");
    name.textContent =
      player.name +
      (player.id === roomData.hostId ? " 👑" : "") +
      (player.id === uid ? " (You)" : "");

    item.append(avatar, name);
    $("roomPlayers").appendChild(item);
  });

  $("startGame").classList.toggle("hidden", !isHost());
  $("startGame").disabled = players.length < 2;

  $("waitingMessage").textContent = isHost()
    ? players.length < 2
      ? "At least 2 players are needed."
      : "Everyone is here? Start the game!"
    : "Waiting for the host to start...";
}

function getDrawerForRound(room, round) {
  const order = room.game?.playerOrder || [];
  return order[(round - 1) % order.length];
}

function makeRound(room, round) {
  const drawerId = getDrawerForRound(room, round);

  return {
    ...room.game,
    round,
    drawerId,
    word: randomWord(),
    startedAt: Date.now(),
    duration: ROUND_SECONDS,
    guessed: {},
    roundPoints: {}
  };
}

async function startGame() {
  try {
    setStatus("");

    const result = await runTransaction(
      getRoomRef(),
      room => {
        if (!room || room.hostId !== uid) return;
        if (room.status !== "waiting") return;

        const players = getPlayers(room);

        if (players.length < 2) return;

        room.game = {
          playerOrder: players.map(player => player.id),
          totalRounds: players.length * ROUNDS_PER_PLAYER
        };

        room.game = makeRound(room, 1);
        room.status = "playing";

        return room;
      },
      { applyLocally: false }
    );

    if (!result.committed) {
      setStatus("Unable to start the game.");
    }
  } catch (error) {
    setStatus(error.message);
  }
}

function clearDrawing() {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawSegment(segment) {
  if (!segment) return;

  ctx.beginPath();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = segment.color || "#203a2c";
  ctx.lineWidth = Number(segment.size) || 9;

  ctx.moveTo(
    segment.x1 * canvas.width,
    segment.y1 * canvas.height
  );

  ctx.lineTo(
    segment.x2 * canvas.width,
    segment.y2 * canvas.height
  );

  ctx.stroke();
}

function subscribeRound() {
  const key = getRoundKey();

  if (key === localRoundKey) return;

  if (unsubscribeStrokes) unsubscribeStrokes();
  if (unsubscribeMessages) unsubscribeMessages();

  localRoundKey = key;
  lastTimer = -1;
  clearDrawing();
  $("guessMessages").replaceChildren();

  const round = roomData.game.round;
  const drawingPath =
    `drawGuessData/${roomCode}/rounds/${round}/strokes`;

  const messagePath =
    `drawGuessData/${roomCode}/rounds/${round}/messages`;

  unsubscribeStrokes = onValue(
    ref(database, drawingPath),
    snapshot => {
      clearDrawing();

      const strokes = snapshot.val() || {};

      Object.values(strokes).forEach(stroke => {
        if (stroke.clear) {
          clearDrawing();
        } else {
          drawSegment(stroke);
        }
      });
    },
    error => setStatus(error.message)
  );

  unsubscribeMessages = onValue(
    ref(database, messagePath),
    snapshot => {
      const messages = snapshot.val() || {};
      renderMessages(Object.values(messages));
    },
    error => setStatus(error.message)
  );
}

function renderGame() {
  const game = roomData.game;
  const drawer = roomData.players[game.drawerId];
  const drawerMode = isDrawer();
  const guessed = Boolean(game.guessed?.[uid]);

  subscribeRound();

  $("roundNumber").textContent =
    `${game.round} / ${game.totalRounds}`;

  $("myScore").textContent =
    roomData.players[uid]?.score || 0;

  $("drawingTitle").textContent = drawerMode
    ? "You're the artist!"
    : `${drawer?.name || "Someone"} is drawing`;

  $("drawerLabel").textContent = drawerMode
    ? "YOUR TURN TO DRAW"
    : "GUESS THE FOOD";

  $("wordLength").textContent = drawerMode
    ? ""
    : game.word.replace(/[A-Za-z]/g, "_");

  $("secretWordBox").classList.toggle("hidden", !drawerMode);
  $("secretWord").textContent = drawerMode ? game.word : "";

  $("drawingTools").classList.toggle("hidden", !drawerMode);

  $("canvasOverlay").classList.toggle("hidden", !guessed || drawerMode);
  $("canvasOverlay").textContent = guessed
    ? "Correct guess! Waiting for the round to finish."
    : "";

  $("guessInput").disabled = drawerMode || guessed;
  $("sendGuess").disabled = drawerMode || guessed;

  $("guessInput").placeholder = drawerMode
    ? "You're drawing this round"
    : guessed
      ? "You guessed correctly!"
      : "What's the food?";

  renderLeaderboard($("liveLeaderboard"));
  updateTimer();
}

function renderMessages(messages) {
  const container = $("guessMessages");
  container.replaceChildren();

  messages.slice(-60).forEach(message => {
    const item = document.createElement("div");
    item.className =
      `guess-message${message.correct ? " correct" : ""}`;

    const name = document.createElement("strong");
    name.textContent = message.name || "Player";

    const text = document.createElement("span");
    text.textContent = message.correct
      ? "🎉 Guessed correctly!"
      : message.text || "";

    item.append(name, text);
    container.appendChild(item);
  });

  container.scrollTop = container.scrollHeight;
}

function renderLeaderboard(container) {
  container.replaceChildren();

  getSortedPlayers().forEach((player, index) => {
    const row = document.createElement("div");
    row.className = "leader-row";

    const name = document.createElement("span");
    name.textContent =
      `${index + 1}. ${player.name}` +
      (player.id === uid ? " (You)" : "");

    const points = document.createElement("strong");
    points.textContent = `${player.score || 0} pts`;

    row.append(name, points);
    container.appendChild(row);
  });
}

function getPoint(event) {
  const rect = canvas.getBoundingClientRect();

  return {
    x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
    y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
  };
}

function canDraw() {
  return isPlaying() && isDrawer();
}

function getStrokeRef() {
  return ref(
    database,
    `drawGuessData/${roomCode}/rounds/${roomData.game.round}/strokes`
  );
}

function startDrawing(event) {
  if (!canDraw()) return;

  event.preventDefault();
  drawing = true;
  lastPoint = getPoint(event);
  lastDrawTime = 0;

  canvas.setPointerCapture(event.pointerId);
}

function moveDrawing(event) {
  if (!drawing || !canDraw()) return;

  event.preventDefault();

  const now = performance.now();

  if (now - lastDrawTime < 25) return;

  lastDrawTime = now;

  const point = getPoint(event);

  const segment = {
    x1: lastPoint.x,
    y1: lastPoint.y,
    x2: point.x,
    y2: point.y,
    color: eraserMode ? "#ffffff" : brushColor,
    size: eraserMode ? brushSize * 3 : brushSize
  };

  drawSegment(segment);
  lastPoint = point;

  push(getStrokeRef(), segment).catch(error => {
    setStatus(error.message);
  });
}

function stopDrawing() {
  drawing = false;
  lastPoint = null;
}

async function clearCanvasForEveryone() {
  if (!canDraw()) return;

  try {
    await push(getStrokeRef(), {
      clear: true,
      at: Date.now()
    });
  } catch (error) {
    setStatus(error.message);
  }
}

function selectColor(button) {
  document.querySelectorAll("[data-color]")
    .forEach(item => {
      item.classList.toggle("active", item === button);
    });

  brushColor = button.dataset.color;
  eraserMode = false;
  $("eraserButton").textContent = "Eraser";
}

async function sendGuess(event) {
  event.preventDefault();

  if (!isPlaying() || isDrawer()) return;

  const input = $("guessInput");
  const guess = input.value.trim().slice(0, 40);

  if (!guess || roomData.game.guessed?.[uid]) return;

  input.value = "";

  const round = roomData.game.round;
  const roundStart = roomData.game.startedAt;
  const correct =
    normalizeAnswer(guess) ===
    normalizeAnswer(roomData.game.word);

  try {
    if (correct) {
      const result = await runTransaction(
        getRoomRef(),
        room => {
          if (!room || room.status !== "playing") return;

          if (
            room.game.round !== round ||
            room.game.startedAt !== roundStart
          ) {
            return;
          }

          if (
            room.game.drawerId === uid ||
            room.game.guessed?.[uid] ||
            !room.players?.[uid]
          ) {
            return;
          }

          room.game.guessed ||= {};
          room.game.roundPoints ||= {};

          const correctCount =
            Object.keys(room.game.guessed).length;

          const guessPoints = Math.max(40, 100 - correctCount * 20);
          const drawerId = room.game.drawerId;

          room.game.guessed[uid] = true;
          room.game.roundPoints[uid] = guessPoints;

          room.players[uid].score =
            (room.players[uid].score || 0) + guessPoints;

          if (room.players[drawerId]) {
            room.players[drawerId].score =
              (room.players[drawerId].score || 0) + 25;

            room.game.roundPoints[drawerId] =
              (room.game.roundPoints[drawerId] || 0) + 25;
          }

          return room;
        },
        { applyLocally: false }
      );

      if (!result.committed) return;
    }

    await push(
      ref(
        database,
        `drawGuessData/${roomCode}/rounds/${round}/messages`
      ),
      {
        uid,
        name: roomData.players[uid]?.name || "Player",
        text: correct ? "" : guess,
        correct,
        at: Date.now()
      }
    );
  } catch (error) {
    setStatus(error.message);
  }
}

async function finishRound() {
  if (roundTransitioning || !isPlaying()) return;

  roundTransitioning = true;

  const round = roomData.game.round;
  const startedAt = roomData.game.startedAt;

  try {
    await runTransaction(
      getRoomRef(),
      room => {
        if (!room || room.status !== "playing") return;

        if (
          room.game.round !== round ||
          room.game.startedAt !== startedAt
        ) {
          return;
        }

        const expired =
          Date.now() >=
          room.game.startedAt + room.game.duration * 1000;

        const eligibleGuessers = getPlayers(room)
          .filter(player => player.id !== room.game.drawerId);

        const everyoneGuessed = eligibleGuessers.length > 0 &&
          eligibleGuessers.every(
            player => room.game.guessed?.[player.id]
          );

        if (!expired && !everyoneGuessed) return;

        room.status =
          room.game.round >= room.game.totalRounds
            ? "finished"
            : "roundEnd";

        room.game.endedAt = Date.now();

        return room;
      },
      { applyLocally: false }
    );
  } catch (error) {
    setStatus(error.message);
  } finally {
    roundTransitioning = false;
  }
}

function updateTimer() {
  if (!isPlaying()) return;

  const game = roomData.game;

  const remaining = Math.max(
    0,
    Math.ceil(
      (game.startedAt + game.duration * 1000 - Date.now()) / 1000
    )
  );

  if (remaining !== lastTimer) {
    $("roundTimer").textContent = `${remaining}s`;
    lastTimer = remaining;
  }

  const eligible = getPlayers()
    .filter(player => player.id !== game.drawerId);

  const allGuessed = eligible.length > 0 &&
    eligible.every(player => game.guessed?.[player.id]);

  if (remaining === 0 || allGuessed) {
    finishRound();
  }
}

function renderResults() {
  const game = roomData.game;
  const finished = roomData.status === "finished";

  $("resultsTitle").textContent = finished
    ? "We have a winner!"
    : `Round ${game.round} complete!`;

  const sorted = getSortedPlayers();

  $("resultsDescription").textContent = finished
    ? `${sorted[0]?.name || "A foodie"} wins with ${sorted[0]?.score || 0} points!`
    : `The food was ${game.word}. Ready for the next round?`;

  renderLeaderboard($("resultsLeaderboard"));

  $("nextRound").classList.toggle(
    "hidden",
    !isHost() || finished
  );

  $("nextRound").textContent =
    "Next Round →";
}

async function nextRound() {
  if (!isHost()) return;

  try {
    const result = await runTransaction(
      getRoomRef(),
      room => {
        if (
          !room ||
          room.hostId !== uid ||
          room.status !== "roundEnd"
        ) {
          return;
        }

        const next = room.game.round + 1;

        if (next > room.game.totalRounds) return;

        room.game = makeRound(room, next);
        room.status = "playing";

        return room;
      },
      { applyLocally: false }
    );

    if (!result.committed) {
      setStatus("Unable to start the next round.");
    }
  } catch (error) {
    setStatus(error.message);
  }
}

async function leaveRoom() {
  if (!roomCode) return;

  const code = roomCode;

  disconnectListeners();
  roomCode = "";
  roomData = null;

  showScreen(lobbyScreen);

  try {
    const roomReference = ref(
      database,
      `drawGuessRooms/${code}`
    );

    const snapshot = await get(roomReference);
    const room = snapshot.val();

    if (!room?.players?.[uid]) return;

    if (room.hostId === uid) {
      await remove(roomReference);
      await remove(
        ref(database, `drawGuessData/${code}`)
      );
    } else {
      await runTransaction(
        roomReference,
        current => {
          if (!current?.players?.[uid]) return;

          delete current.players[uid];

          if (current.game?.guessed) {
            delete current.game.guessed[uid];
          }

          return current;
        },
        { applyLocally: false }
      );
    }
  } catch (error) {
    setStatus(error.message);
  }
}

async function copyRoomCode() {
  try {
    await navigator.clipboard.writeText(roomCode);
    setStatus("Room code copied!");
  } catch (error) {
    setStatus(`Share this room code: ${roomCode}`);
  }
}

$("createRoom").addEventListener("click", createRoom);
$("joinRoom").addEventListener("click", joinRoom);
$("startGame").addEventListener("click", startGame);
$("leaveRoom").addEventListener("click", leaveRoom);
$("backToLobby").addEventListener("click", leaveRoom);
$("copyCode").addEventListener("click", copyRoomCode);
$("nextRound").addEventListener("click", nextRound);
$("guessForm").addEventListener("submit", sendGuess);

canvas.addEventListener("pointerdown", startDrawing);
canvas.addEventListener("pointermove", moveDrawing);
canvas.addEventListener("pointerup", stopDrawing);
canvas.addEventListener("pointercancel", stopDrawing);
canvas.addEventListener("lostpointercapture", stopDrawing);

document.querySelectorAll("[data-color]")
  .forEach(button => {
    button.addEventListener("click", () => selectColor(button));
  });

$("brushSize").addEventListener("change", event => {
  brushSize = Number(event.target.value);
});

$("eraserButton").addEventListener("click", () => {
  eraserMode = !eraserMode;

  $("eraserButton").textContent = eraserMode
    ? "Drawing"
    : "Eraser";
});

$("clearCanvas").addEventListener(
  "click",
  clearCanvasForEveryone
);

$("roomCodeInput").addEventListener("input", event => {
  event.target.value = event.target.value
    .toUpperCase()
    .replace(/[^A-Z2-9]/g, "");
});

setInterval(updateTimer, 500);

async function initialize() {
  clearDrawing();
  showScreen(lobbyScreen);

  try {
    await ensureLogin();
    setStatus("");
  } catch (error) {
    setStatus(
      "Firebase connection failed. Check configuration and Anonymous Authentication."
    );
  }
}

initialize();
