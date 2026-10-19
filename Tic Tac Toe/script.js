import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import { getDatabase, ref, onValue, runTransaction } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-database.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_DATABASE_URL.firebasedatabase.app",
  projectId: "YOUR_PROJECT_ID",
  appId: "YOUR_APP_ID"
};

const $ = id => document.getElementById(id);
const cells = [...document.querySelectorAll(".cell")];
const lines = [
  [0,1,2], [3,4,5], [6,7,8],
  [0,3,6], [1,4,7], [2,5,8],
  [0,4,8], [2,4,6]
];

let mode = null;
let difficulty = "nightmare";
let board = Array(9).fill("");
let finished = false;
let thinking = false;
let aiTimer = null;
let db = null;
let auth = null;
let user = null;
let roomId = null;
let roomData = null;
let mySymbol = null;
let unsubscribe = null;
let busy = false;

function message(text) {
  $("message").textContent = text;
}
function show(screen) {
  ["modeScreen","aiSettings","onlineLobby","gameArea"]
    .forEach(id => $(id).classList.add("hidden"));
  $(screen).classList.remove("hidden");
  message("");
}
function emptyBoard() {
  return Array(9).fill("");
}
function resultOf(b) {
  for (const line of lines) {
    const [a,c,d] = line;
    if (b[a] && b[a] === b[c] && b[a] === b[d]) {
      return { winner: b[a], line };
    }
  }
  return b.every(Boolean)
    ? { winner: "draw", line: [] }
    : null;
}
function drawBoard(b, enabled) {
  const result = resultOf(b);
  cells.forEach((cell, i) => {
    cell.textContent = b[i] || "";
    cell.classList.toggle("o", b[i] === "O");
    cell.classList.toggle(
      "win",
      !!result && result.line.includes(i)
    );
    cell.disabled = !enabled || !!b[i];
  });
}

function startAI(level) {
  mode = "ai";
  difficulty = level;
  board = emptyBoard();
  finished = false;
  thinking = false;
  if (aiTimer) clearTimeout(aiTimer);
  $("onlineInfo").classList.add("hidden");
  $("nameX").textContent = "You";
  $("nameO").textContent =
    level === "nightmare" ? "Nightmare AI" :
    level === "medium" ? "Medium AI" : "Easy AI";
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
      result.winner === "X" ? "🎉 You win!" :
      result.winner === "O" ? "🤖 AI wins!" :
      "🤝 It's a draw!";
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
  for (let i = 0; i < 9; i++) {
    if (b[i]) continue;
    b[i] = maximizing ? "O" : "X";
    const score = minimax(b, depth + 1, !maximizing);
    b[i] = "";
    best = maximizing
      ? Math.max(best, score)
      : Math.min(best, score);
  }
  return best;
}

function bestAIMove() {
  const available = board
    .map((v, i) => v === "" ? i : -1)
    .filter(i => i >= 0);
  if (difficulty === "easy") {
    return available[
      Math.floor(Math.random() * available.length)
    ];
  }
  if (difficulty === "medium" && Math.random() < 0.45) {
    return available[
      Math.floor(Math.random() * available.length)
    ];
  }
  let bestScore = -Infinity;
  let moves = [];
  for (const i of available) {
    board[i] = "O";
    const score = minimax(board, 0, false);
    board[i] = "";
    if (score > bestScore) {
      bestScore = score;
      moves = [i];
    } else if (score === bestScore) {
      moves.push(i);
    }
  }
  return moves[Math.floor(Math.random() * moves.length)];
}

function playAI(index) {
  if (finished || thinking || board[index]) return;
  board[index] = "X";
  if (resultOf(board)) {
    finished = true;
    renderAI();
    return;
  }
  thinking = true;
  renderAI();
  aiTimer = setTimeout(() => {
    const move = bestAIMove();
    if (move !== undefined) board[move] = "O";

    thinking = false;
    finished = !!resultOf(board);
    renderAI();
  }, 400);
}

async function connectOnline() {
  if (user) return true;
  if (firebaseConfig.apiKey === "YOUR_API_KEY") {
    $("connection").textContent =
      "Firebase setup required for online mode.";
    return false;
  }
  try {
    $("connection").textContent = "Connecting...";
    if (!auth) {
      const app = initializeApp(firebaseConfig);
      db = getDatabase(app);
      auth = getAuth(app);
    }
    const credential = await signInAnonymously(auth);
    user = credential.user;
    $("connection").textContent = "🟢 Online ready";
    return true;
  } catch (error) {
    $("connection").textContent =
      "🔴 Connection failed: " + error.message;
    return false;
  }
}

function roomRef(code) {
  return ref(db, "ticTacToeRooms/" + code);
}

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const numbers = new Uint32Array(6);
  crypto.getRandomValues(numbers);
  return [...numbers]
    .map(n => chars[n % chars.length])
    .join("");
}

function newRoom(name) {
  return {
    players: {
      X: { uid: user.uid, name },
      O: { uid: "", name: "" }
    },
    board: emptyBoard(),
    turn: "X",
    status: "waiting",
    winner: "",
    rematch: { X: false, O: false },
    round: 1,
    createdAt: Date.now()
  };
}

function showRoom(code) {
  mode = "online";
  roomId = code;
  show("gameArea");
  $("onlineInfo").classList.remove("hidden");
  $("displayCode").textContent = code;
  if (unsubscribe) unsubscribe();
  unsubscribe = onValue(
    roomRef(code),
    snapshot => {
      if (!snapshot.exists()) {
        message("Room no longer exists.");
        exitRoom();
        return;
      }
      roomData = snapshot.val();
      if (roomData.players?.X?.uid === user.uid) {
        mySymbol = "X";
      } else if (roomData.players?.O?.uid === user.uid) {
        mySymbol = "O";
      } else {
        exitRoom();
        message("You are not a player in this room.");
        return;
      }
      renderOnline();
    },
    error => message(error.message)
  );
}

function renderOnline() {
  if (!roomData) return;
  const b = roomData.board || emptyBoard();
  $("nameX").textContent =
    roomData.players?.X?.name || "Waiting...";
  $("nameO").textContent =
    roomData.players?.O?.name || "Waiting...";
  drawBoard(
    b,
    !busy &&
    roomData.status === "playing" &&
    roomData.turn === mySymbol
  );
  if (roomData.status === "waiting") {
    $("status").textContent =
      "Waiting for your friend to join...";
  } else if (roomData.status === "finished") {
    $("status").textContent =
      roomData.winner === "draw" ? "🤝 Draw!" :
      roomData.winner === mySymbol ? "🎉 You won!" :
      "Your friend won!";
  } else {
    $("status").textContent =
      roomData.turn === mySymbol
        ? "Your turn!"
        : "Waiting for your friend...";
  }

  const voted = roomData.rematch?.[mySymbol] === true;

  $("playAgain").disabled =
    busy || roomData.status !== "finished" || voted;

  $("playAgain").textContent =
    voted ? "Waiting for friend..." : "↻ Play Again";
}

async function createRoom() {
  if (!(await connectOnline()) || busy) return;

  busy = true;
  $("createRoom").disabled = true;

  try {
    const name =
      $("playerName").value.trim().slice(0, 24) || "Guest";

    for (let i = 0; i < 5; i++) {
      const code = makeCode();

      const tx = await runTransaction(
        roomRef(code),
        current => current === null
          ? newRoom(name)
          : undefined,
        { applyLocally: false }
      );

      if (tx.committed) {
        showRoom(code);
        return;
      }
    }

    message("Could not create room. Try again.");
  } catch (error) {
    message(error.message);
  } finally {
    busy = false;
    $("createRoom").disabled = false;
  }
}

async function joinRoom() {
  if (!(await connectOnline()) || busy) return;

  const code = $("roomCode").value.trim().toUpperCase();

  if (!/^[A-Z2-9]{6}$/.test(code)) {
    message("Enter a valid 6-character room code.");
    return;
  }

  busy = true;
  $("joinRoom").disabled = true;

  try {
    const name = $("playerName").value.trim().slice(0, 24) || "Guest";

    const tx = await runTransaction(
      roomRef(code),
      current => {
        if (!current) return;

        if (
          current.players?.X?.uid === user.uid ||
          current.players?.O?.uid === user.uid
        ) return current;

        if (
          current.players?.O?.uid ||
          current.status !== "waiting"
        ) return;

        current.players.O = { uid: user.uid, name };
        current.status = "playing";
        return current;
      },
      { applyLocally: false }
    );

    const data = tx.snapshot.val();

    if (
      data &&
      (data.players?.X?.uid === user.uid ||
       data.players?.O?.uid === user.uid)
    ) {
      showRoom(code);
    } else {
      message("Room not found or already full.");
    }
  } catch (error) {
    message(error.message);
  } finally {
    busy = false;
    $("joinRoom").disabled = false;
  }
}

async function playOnline(index) {
  if (!roomId || !user || busy) return;

  busy = true;

  try {
    await runTransaction(
      roomRef(roomId),
      current => {
        if (!current || current.status !== "playing") {
          return;
        }

        const symbol =
          current.players?.X?.uid === user.uid ? "X" :
          current.players?.O?.uid === user.uid ? "O" :
          null;

        if (
          !symbol ||
          current.turn !== symbol ||
          current.board[index]
        ) return;

        current.board[index] = symbol;

        const result = resultOf(current.board);

        if (result) {
          current.status = "finished";
          current.winner = result.winner;
          current.rematch = { X: false, O: false };
        } else {
          current.turn = symbol === "X" ? "O" : "X";
        }

        return current;
      },
      { applyLocally: false }
    );
  } catch (error) {
    message(error.message);
  } finally {
    busy = false;
    renderOnline();
  }
}

async function rematchOnline() {
  if (!roomId || !user || busy) return;

  busy = true;

  try {
    await runTransaction(
      roomRef(roomId),
      current => {
        if (!current || current.status !== "finished") {
          return;
        }

        const symbol =
          current.players?.X?.uid === user.uid ? "X" :
          current.players?.O?.uid === user.uid ? "O" :
          null;

        if (!symbol) return;

        current.rematch = current.rematch ||
          { X: false, O: false };

        current.rematch[symbol] = true;

        if (current.rematch.X && current.rematch.O) {
          current.board = emptyBoard();
          current.status = "playing";
          current.winner = "";
          current.turn =
            current.round % 2 === 1 ? "O" : "X";
          current.round++;
          current.rematch = { X: false, O: false };
        }

        return current;
      },
      { applyLocally: false }
    );
  } catch (error) {
    message(error.message);
  } finally {
    busy = false;
    renderOnline();
  }
}

function exitRoom() {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }

  roomId = null;
  roomData = null;
  mySymbol = null;
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
  } catch {
    message("Share this room code: " + roomId);
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
    button.onclick = () =>
      startAI(button.dataset.difficulty);
  });

$("createRoom").onclick = createRoom;
$("joinRoom").onclick = joinRoom;
$("copyInvite").onclick = copyInvite;

cells.forEach((cell, index) => {
  cell.onclick = () => {
    if (mode === "ai") playAI(index);
    if (mode === "online") playOnline(index);
  };
});

$("playAgain").onclick = () => {
  if (mode === "ai") startAI(difficulty);
  if (mode === "online") rematchOnline();
};

$("changeMode").onclick = () => {
  if (aiTimer) clearTimeout(aiTimer);

  if (mode === "online") exitRoom();
  else {
    mode = null;
    show("modeScreen");
  }
};
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