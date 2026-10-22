
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getDatabase,
  ref,
  get,
  onValue,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js";
import {
  getAuth,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";

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
const db = getDatabase(app);
const auth = getAuth(app);

const $ = id => document.getElementById(id);
const cells = [...document.querySelectorAll(".cell")];

const lines = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6]
];

let mode = null;
let difficulty = "nightmare";
let board = Array(9).fill("");
let finished = false;
let thinking = false;
let aiTimer = null;

let user = null;
let loginPromise = null;
let roomId = null;
let roomData = null;
let mySymbol = null;
let unsubscribe = null;
let busy = false;

let aiWinId = "";
let aiRewardClaimed = false;

function message(text) {
  $("message").textContent = text;
}

function show(screen) {
  ["modeScreen", "aiSettings", "onlineLobby", "gameArea"]
    .forEach(id => $(id).classList.add("hidden"));

  $(screen).classList.remove("hidden");
  message("");
}

function emptyBoard() {
  return Array(9).fill("");
}

function normalizeBoard(value) {
  if (Array.isArray(value)) {
    return Array.from(
      { length: 9 },
      (_, index) => value[index] || ""
    );
  }

  return emptyBoard();
}

function resultOf(b) {
  for (const line of lines) {
    const [a, c, d] = line;

    if (b[a] && b[a] === b[c] && b[a] === b[d]) {
      return {
        winner: b[a],
        line
      };
    }
  }

  return b.every(Boolean)
    ? { winner: "draw", line: [] }
    : null;
}

function drawBoard(b, enabled) {
  const result = resultOf(b);

  cells.forEach((cell, index) => {
    cell.textContent = b[index] || "";
    cell.classList.toggle("o", b[index] === "O");
    cell.classList.toggle(
      "win",
      Boolean(result && result.line.includes(index))
    );

    cell.disabled = !enabled || Boolean(b[index]);
  });
}

function createAIWinId() {
  if (window.ChefDeskLoyalty) {
    return ChefDeskLoyalty.createWinId();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function awardAIWin() {
  if (aiRewardClaimed) return;

  aiRewardClaimed = true;

  if (!window.ChefDesk || !window.ChefDeskLoyalty) {
    message("Loyalty system is unavailable.");
    return;
  }

  const winId = aiWinId;

  try {
    await ChefDesk.requireLogin();

    const result = ChefDeskLoyalty.addWin(
      "tictactoe",
      winId
    );

    if (mode !== "ai" || aiWinId !== winId) return;

    if (!result.success) {
      message(
        result.reason === "duplicate"
          ? "Points for this match were already recorded."
          : "Unable to save your loyalty points."
      );
      return;
    }

    if (result.earnedPoints > 0) {
      message(
        `🎉 +${result.gamePoints} game points and ` +
        `+${result.earnedPoints} loyalty points earned!`
      );
    } else {
      message(
        "🎉 +10 game points! Today's 100 loyalty points limit reached."
      );
    }
  } catch (error) {
    if (mode === "ai" && aiWinId === winId) {
      message("Unable to save your loyalty points.");
    }
  }
}

function startAI(level) {
  disconnectRoom();

  mode = "ai";
  difficulty = level;
  board = emptyBoard();
  finished = false;
  thinking = false;

  if (aiTimer) {
    clearTimeout(aiTimer);
    aiTimer = null;
  }

  aiWinId = createAIWinId();
  aiRewardClaimed = false;

  $("onlineInfo").classList.add("hidden");
  $("nameX").textContent = "You";

  $("nameO").textContent =
    level === "nightmare"
      ? "Expert AI"
      : level === "medium"
        ? "Medium AI"
        : "Easy AI";

  $("playAgain").disabled = false;
  $("playAgain").textContent = "↻ Play Again";

  show("gameArea");
  renderAI();
}

function renderAI() {
  drawBoard(board, !finished && !thinking);

  const result = resultOf(board);

  if (result) {
    $("status").textContent =
      result.winner === "X"
        ? "🎉 You win!"
        : result.winner === "O"
          ? "🤖 AI wins!"
          : "🤝 It's a draw!";
  } else {
    $("status").textContent = thinking
      ? "🤖 AI is thinking..."
      : "Your turn! Choose a square.";
  }
}

function minimax(b, depth, maximizing) {
  const result = resultOf(b);

  if (result) {
    if (result.winner === "O") return 10 - depth;
    if (result.winner === "X") return depth - 10;
    return 0;
  }

  let best = maximizing ? -Infinity : Infinity;

  for (let index = 0; index < 9; index++) {
    if (b[index]) continue;

    b[index] = maximizing ? "O" : "X";

    const score = minimax(
      b,
      depth + 1,
      !maximizing
    );

    b[index] = "";

    best = maximizing
      ? Math.max(best, score)
      : Math.min(best, score);
  }

  return best;
}

function bestAIMove() {
  const available = board
    .map((value, index) => value === "" ? index : -1)
    .filter(index => index >= 0);

  if (!available.length) return undefined;

  if (
    difficulty === "easy" ||
    (difficulty === "medium" && Math.random() < 0.45)
  ) {
    return available[
      Math.floor(Math.random() * available.length)
    ];
  }

  let bestScore = -Infinity;
  let moves = [];

  for (const index of available) {
    board[index] = "O";

    const score = minimax(board, 0, false);

    board[index] = "";

    if (score > bestScore) {
      bestScore = score;
      moves = [index];
    } else if (score === bestScore) {
      moves.push(index);
    }
  }

  return moves[Math.floor(Math.random() * moves.length)];
}

function playAI(index) {
  if (
    mode !== "ai" ||
    finished ||
    thinking ||
    board[index]
  ) {
    return;
  }

  board[index] = "X";

  const playerResult = resultOf(board);

  if (playerResult) {
    finished = true;
    renderAI();

    if (playerResult.winner === "X") {
      awardAIWin();
    }

    return;
  }

  thinking = true;
  renderAI();

  aiTimer = setTimeout(() => {
    aiTimer = null;

    if (mode !== "ai" || finished) return;

    const move = bestAIMove();

    if (move !== undefined) {
      board[move] = "O";
    }

    thinking = false;
    finished = Boolean(resultOf(board));

    renderAI();
  }, 400);
}

async function connectOnline() {
  if (user) return true;

  if (!loginPromise) {
    loginPromise = signInAnonymously(auth);
  }

  try {
    $("connection").textContent = "Connecting...";

    const credential = await loginPromise;
    user = credential.user;

    $("connection").textContent = "🟢 Online ready";
    return true;
  } catch (error) {
    loginPromise = null;
    $("connection").textContent =
      "🔴 Connection failed: " + error.message;
    return false;
  }
}

function roomRef(code) {
  return ref(db, `ticTacToeRooms/${code}`);
}

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const numbers = new Uint32Array(6);

  crypto.getRandomValues(numbers);

  return [...numbers]
    .map(number => chars[number % chars.length])
    .join("");
}

function newRoom(name) {
  return {
    players: {
      X: {
        uid: user.uid,
        name
      },
      O: {
        uid: "",
        name: ""
      }
    },
    board: emptyBoard(),
    turn: "X",
    status: "waiting",
    winner: "",
    rematch: {
      X: false,
      O: false
    },
    round: 1,
    createdAt: Date.now()
  };
}

function disconnectRoom() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }

  roomId = null;
  roomData = null;
  mySymbol = null;
}

function showRoom(code) {
  disconnectRoom();

  mode = "online";
  roomId = code;

  show("gameArea");

  $("onlineInfo").classList.remove("hidden");
  $("displayCode").textContent = code;

  unsubscribe = onValue(
    roomRef(code),
    snapshot => {
      if (!snapshot.exists()) {
        disconnectRoom();
        mode = null;
        show("modeScreen");
        message("Room no longer exists.");
        return;
      }

      roomData = snapshot.val();

      if (roomData.players?.X?.uid === user.uid) {
        mySymbol = "X";
      } else if (roomData.players?.O?.uid === user.uid) {
        mySymbol = "O";
      } else {
        disconnectRoom();
        mode = null;
        show("modeScreen");
        message("You are not a player in this room.");
        return;
      }

      renderOnline();
    },
    error => message(error.message)
  );
}

function renderOnline() {
  if (!roomData || mode !== "online") return;

  const currentBoard = normalizeBoard(roomData.board);

  $("nameX").textContent =
    roomData.players?.X?.name || "Waiting...";

  $("nameO").textContent =
    roomData.players?.O?.name || "Waiting...";

  drawBoard(
    currentBoard,
    !busy &&
    roomData.status === "playing" &&
    roomData.turn === mySymbol
  );

  if (roomData.status === "waiting") {
    $("status").textContent =
      "Waiting for your friend to join...";
  } else if (roomData.status === "finished") {
    $("status").textContent =
      roomData.winner === "draw"
        ? "🤝 It's a draw!"
        : roomData.winner === mySymbol
          ? "🎉 You won!"
          : "Your friend won!";
  } else {
    $("status").textContent =
      roomData.turn === mySymbol
        ? "Your turn!"
        : "Waiting for your friend...";
  }

  const voted = roomData.rematch?.[mySymbol] === true;

  $("playAgain").disabled =
    busy ||
    roomData.status !== "finished" ||
    voted;

  $("playAgain").textContent = voted
    ? "Waiting for friend..."
    : "↻ Play Again";
}

async function createRoom() {
  if (busy || !(await connectOnline())) return;

  busy = true;
  $("createRoom").disabled = true;

  try {
    const name =
      $("playerName").value.trim().slice(0, 24) ||
      "Guest";

    for (let attempt = 0; attempt < 5; attempt++) {
      const code = makeCode();

      const result = await runTransaction(
        roomRef(code),
        current => current === null
          ? newRoom(name)
          : undefined,
        { applyLocally: false }
      );

      if (result.committed) {
        showRoom(code);
        return;
      }
    }

    message("Could not create a room. Try again.");
  } catch (error) {
    message(error.message);
  } finally {
    busy = false;
    $("createRoom").disabled = false;
  }
}

async function joinRoom() {
  if (busy || !(await connectOnline())) return;

  const code = $("roomCode").value.trim().toUpperCase();

  if (!/^[A-Z2-9]{6}$/.test(code)) {
    message("Enter a valid 6-character room code.");
    return;
  }

  busy = true;
  $("joinRoom").disabled = true;

  try {
    const name =
      $("playerName").value.trim().slice(0, 24) ||
      "Guest";

    const reference = roomRef(code);
    const snapshot = await get(reference);

    if (!snapshot.exists()) {
      message("Room not found. Check your code.");
      return;
    }

    const existing = snapshot.val();

    if (
      existing.players?.X?.uid !== user.uid &&
      existing.players?.O?.uid !== user.uid
    ) {
      if (
        existing.status !== "waiting" ||
        existing.players?.O?.uid
      ) {
        message("This room is already full or has started.");
        return;
      }
    }

    const transaction = await runTransaction(
      reference,
      current => {
        if (!current) return;

        if (
          current.players?.X?.uid === user.uid ||
          current.players?.O?.uid === user.uid
        ) {
          return current;
        }

        if (
          current.status !== "waiting" ||
          current.players?.O?.uid
        ) {
          return;
        }

        current.players.O = {
          uid: user.uid,
          name
        };

        current.status = "playing";
        return current;
      },
      { applyLocally: false }
    );

    const data = transaction.snapshot.val();

    if (
      data &&
      (
        data.players?.X?.uid === user.uid ||
        data.players?.O?.uid === user.uid
      )
    ) {
      showRoom(code);
    } else {
      message("Unable to join. Room may already be full.");
    }
  } catch (error) {
    message(error.message);
  } finally {
    busy = false;
    $("joinRoom").disabled = false;
  }
}

async function playOnline(index) {
  if (
    mode !== "online" ||
    !roomId ||
    !user ||
    busy
  ) {
    return;
  }

  busy = true;
  renderOnline();

  const currentRoom = roomId;

  try {
    const result = await runTransaction(
      roomRef(currentRoom),
      current => {
        if (!current || current.status !== "playing") {
          return;
        }

        const symbol =
          current.players?.X?.uid === user.uid
            ? "X"
            : current.players?.O?.uid === user.uid
              ? "O"
              : null;

        const currentBoard = normalizeBoard(current.board);

        if (
          !symbol ||
          current.turn !== symbol ||
          currentBoard[index]
        ) {
          return;
        }

        currentBoard[index] = symbol;
        current.board = currentBoard;

        const outcome = resultOf(currentBoard);

        if (outcome) {
          current.status = "finished";
          current.winner = outcome.winner;
          current.rematch = {
            X: false,
            O: false
          };
        } else {
          current.turn = symbol === "X" ? "O" : "X";
        }

        return current;
      },
      { applyLocally: false }
    );

    if (!result.committed) {
      message("Move not saved. Please try again.");
    }
  } catch (error) {
    message(error.message);
  } finally {
    busy = false;

    if (mode === "online" && roomId === currentRoom) {
      renderOnline();
    }
  }
}

async function rematchOnline() {
  if (
    mode !== "online" ||
    !roomId ||
    !user ||
    busy
  ) {
    return;
  }

  busy = true;
  renderOnline();

  const currentRoom = roomId;

  try {
    await runTransaction(
      roomRef(currentRoom),
      current => {
        if (!current || current.status !== "finished") {
          return;
        }

        const symbol =
          current.players?.X?.uid === user.uid
            ? "X"
            : current.players?.O?.uid === user.uid
              ? "O"
              : null;

        if (!symbol) return;

        current.rematch ||= {
          X: false,
          O: false
        };

        current.rematch[symbol] = true;

        if (current.rematch.X && current.rematch.O) {
          current.board = emptyBoard();
          current.status = "playing";
          current.winner = "";
          current.turn =
            current.round % 2 === 1 ? "O" : "X";
          current.round += 1;
          current.rematch = {
            X: false,
            O: false
          };
        }

        return current;
      },
      { applyLocally: false }
    );
  } catch (error) {
    message(error.message);
  } finally {
    busy = false;

    if (mode === "online" && roomId === currentRoom) {
      renderOnline();
    }
  }
}

function exitRoom() {
  disconnectRoom();
  mode = null;
  show("modeScreen");
}

async function copyInvite() {
  if (!roomId) return;

  const url = new URL(location.href);
  url.searchParams.set("room", roomId);

  try {
    await navigator.clipboard.writeText(url.toString());
    message("Invite link copied!");
  } catch (error) {
    message(`Share this room code: ${roomId}`);
  }
}

$("chooseAI").onclick = () => show("aiSettings");

$("chooseOnline").onclick = async () => {
  show("onlineLobby");
  await connectOnline();
};

$("backFromAI").onclick = () => show("modeScreen");
$("backFromOnline").onclick = () => show("modeScreen");

document.querySelectorAll("[data-difficulty]")
  .forEach(button => {
    button.onclick = () => {
      startAI(button.dataset.difficulty);
    };
  });

$("createRoom").onclick = createRoom;
$("joinRoom").onclick = joinRoom;
$("copyInvite").onclick = copyInvite;

cells.forEach((cell, index) => {
  cell.onclick = () => {
    if (mode === "ai") {
      playAI(index);
    } else if (mode === "online") {
      playOnline(index);
    }
  };
});

$("playAgain").onclick = () => {
  if (mode === "ai") {
    startAI(difficulty);
  } else if (mode === "online") {
    rematchOnline();
  }
};

$("changeMode").onclick = () => {
  if (aiTimer) {
    clearTimeout(aiTimer);
    aiTimer = null;
  }

  thinking = false;

  if (mode === "online") {
    exitRoom();
  } else {
    mode = null;
    show("modeScreen");
  }
};

$("roomCode").addEventListener("input", event => {
  event.target.value = event.target.value
    .toUpperCase()
    .replace(/[^A-Z2-9]/g, "");
});

const inviteCode = new URLSearchParams(
  location.search
).get("room");

if (inviteCode) {
  $("roomCode").value = inviteCode.toUpperCase();
  show("onlineLobby");
  connectOnline();
} else {
  show("modeScreen");
}
