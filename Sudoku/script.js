
const boardElement = document.getElementById("sudokuBoard");
const timerElement = document.getElementById("timer");
const mistakesElement = document.getElementById("mistakes");
const hintsElement = document.getElementById("hintsLeft");
const statusElement = document.getElementById("status");
const completionElement = document.getElementById("completion");
const completionText = document.getElementById("completionText");
const difficultyElement = document.getElementById("difficulty");
const notesButton = document.getElementById("notesToggle");

let solution = [];
let initial = [];
let board = [];
let notes = [];
let selected = -1;
let mistakes = 0;
let hints = 3;
let seconds = 0;
let timer = null;
let notesMode = false;
let completed = false;
let gameWinId = "";
let rewardClaimed = false;
let puzzleVersion = 0;

function shuffled(values) {
  const items = [...values];

  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }

  return items;
}

function generateSolution() {
  const pattern = (row, col) =>
    (row * 3 + Math.floor(row / 3) + col) % 9;

  const bands = shuffled([0, 1, 2]);
  const stacks = shuffled([0, 1, 2]);

  const rows = bands.flatMap(band =>
    shuffled([0, 1, 2]).map(row => band * 3 + row)
  );

  const cols = stacks.flatMap(stack =>
    shuffled([0, 1, 2]).map(col => stack * 3 + col)
  );

  const digits = shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9]);

  return rows.flatMap(row =>
    cols.map(col => digits[pattern(row, col)])
  );
}

function validCandidates(values, index) {
  const row = Math.floor(index / 9);
  const col = index % 9;
  const used = new Set();

  for (let i = 0; i < 9; i++) {
    used.add(values[row * 9 + i]);
    used.add(values[i * 9 + col]);
  }

  const boxRow = Math.floor(row / 3) * 3;
  const boxCol = Math.floor(col / 3) * 3;

  for (let r = boxRow; r < boxRow + 3; r++) {
    for (let c = boxCol; c < boxCol + 3; c++) {
      used.add(values[r * 9 + c]);
    }
  }

  return [1, 2, 3, 4, 5, 6, 7, 8, 9]
    .filter(value => !used.has(value));
}

function countSolutions(values, limit = 2) {
  let bestIndex = -1;
  let bestOptions = null;

  for (let i = 0; i < 81; i++) {
    if (values[i] !== 0) continue;

    const options = validCandidates(values, i);

    if (options.length === 0) return 0;

    if (!bestOptions || options.length < bestOptions.length) {
      bestIndex = i;
      bestOptions = options;

      if (options.length === 1) break;
    }
  }

  if (bestIndex === -1) return 1;

  let count = 0;

  for (const value of bestOptions) {
    values[bestIndex] = value;
    count += countSolutions(values, limit - count);

    if (count >= limit) break;
  }

  values[bestIndex] = 0;
  return count;
}

function generatePuzzle(level) {
  solution = generateSolution();

  const puzzle = [...solution];
  const clues = {
    easy: 40,
    medium: 34,
    hard: 29
  }[level] || 34;

  let remaining = 81;

  for (const index of shuffled(
    Array.from({ length: 81 }, (_, i) => i)
  )) {
    if (remaining <= clues) break;

    const saved = puzzle[index];
    puzzle[index] = 0;

    if (countSolutions([...puzzle]) !== 1) {
      puzzle[index] = saved;
    } else {
      remaining--;
    }
  }

  return puzzle;
}

function formatTime(value) {
  const minutes = Math.floor(value / 60);
  const secs = value % 60;

  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function updateStats() {
  timerElement.textContent = formatTime(seconds);
  mistakesElement.textContent = mistakes;
  hintsElement.textContent = hints;
}

function startTimer() {
  clearInterval(timer);

  timer = setInterval(() => {
    if (!completed) {
      seconds++;
      updateStats();
    }
  }, 1000);
}

function isPeer(a, b) {
  const ar = Math.floor(a / 9);
  const ac = a % 9;
  const br = Math.floor(b / 9);
  const bc = b % 9;

  return ar === br ||
    ac === bc ||
    (
      Math.floor(ar / 3) === Math.floor(br / 3) &&
      Math.floor(ac / 3) === Math.floor(bc / 3)
    );
}

function renderBoard() {
  boardElement.replaceChildren();

  for (let index = 0; index < 81; index++) {
    const cell = document.createElement("button");

    cell.type = "button";
    cell.className = "cell";
    cell.setAttribute("role", "gridcell");

    cell.setAttribute(
      "aria-label",
      `Row ${Math.floor(index / 9) + 1}, column ${index % 9 + 1}` +
      (board[index] ? `, ${board[index]}` : ", empty")
    );

    if (index % 9 === 2 || index % 9 === 5) {
      cell.classList.add("box-right");
    }

    if (
      Math.floor(index / 9) === 2 ||
      Math.floor(index / 9) === 5
    ) {
      cell.classList.add("box-bottom");
    }

    if (initial[index]) {
      cell.classList.add("given");
    }

    if (
      selected !== -1 &&
      isPeer(selected, index) &&
      selected !== index
    ) {
      cell.classList.add("peer");
    }

    if (selected === index) {
      cell.classList.add("selected");
    }

    if (
      selected !== -1 &&
      board[selected] &&
      board[index] === board[selected] &&
      index !== selected
    ) {
      cell.classList.add("same-value");
    }

    if (
      board[index] &&
      board[index] !== solution[index]
    ) {
      cell.classList.add("invalid");
    }

    if (board[index]) {
      cell.textContent = board[index];
    } else if (notes[index].size) {
      const noteGrid = document.createElement("span");
      noteGrid.className = "notes";

      for (let value = 1; value <= 9; value++) {
        const note = document.createElement("span");

        note.textContent = notes[index].has(value)
          ? value
          : "";

        noteGrid.appendChild(note);
      }

      cell.appendChild(noteGrid);
    }

    cell.addEventListener("click", () => {
      selected = index;
      renderBoard();
    });

    boardElement.appendChild(cell);
  }
}

function clearPeerNotes(index, value) {
  for (let i = 0; i < 81; i++) {
    if (isPeer(i, index)) {
      notes[i].delete(value);
    }
  }
}

function enterNumber(value) {
  if (
    completed ||
    selected < 0 ||
    initial[selected]
  ) {
    return;
  }

  if (notesMode) {
    if (board[selected]) return;

    if (notes[selected].has(value)) {
      notes[selected].delete(value);
    } else {
      notes[selected].add(value);
    }
  } else {
    if (board[selected] === value) return;

    board[selected] = value;
    notes[selected].clear();

    if (value !== solution[selected]) {
      mistakes++;

      statusElement.textContent =
        "That number doesn't fit. Try another.";
    } else {
      clearPeerNotes(selected, value);

      statusElement.textContent =
        "Keep going. You're making progress.";
    }
  }

  updateStats();
  renderBoard();
  checkCompletion();
}

function eraseSelected() {
  if (
    completed ||
    selected < 0 ||
    initial[selected]
  ) {
    return;
  }

  board[selected] = 0;
  notes[selected].clear();
  renderBoard();
}

function giveHint() {
  if (completed || hints === 0) return;

  let index = selected;

  if (
    index < 0 ||
    initial[index] ||
    board[index] === solution[index]
  ) {
    index = board.findIndex(
      (value, i) =>
        !initial[i] &&
        value !== solution[i]
    );
  }

  if (index === -1) return;

  board[index] = solution[index];
  initial[index] = solution[index];

  notes[index].clear();
  clearPeerNotes(index, solution[index]);

  selected = index;
  hints--;

  statusElement.textContent =
    "One square has been completed for you.";

  updateStats();
  renderBoard();
  checkCompletion();
}

function createGameWinId() {
  if (window.ChefDeskLoyalty) {
    return ChefDeskLoyalty.createWinId();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function awardSudokuPoints() {
  if (rewardClaimed) return;

  rewardClaimed = true;

  const currentWinId = gameWinId;
  const currentPuzzleVersion = puzzleVersion;

  if (!window.ChefDesk || !window.ChefDeskLoyalty) {
    statusElement.textContent =
      "Puzzle complete! Loyalty system is unavailable.";
    return;
  }

  try {
    await ChefDesk.requireLogin();

    const result = ChefDeskLoyalty.addWin(
      "sudoku",
      currentWinId
    );

    if (puzzleVersion !== currentPuzzleVersion) return;

    if (!result.success) {
      statusElement.textContent =
        "Puzzle complete! Unable to save loyalty points.";
      return;
    }

    if (result.earnedPoints > 0) {
      statusElement.textContent =
        `🎉 +${result.gamePoints} game points and ` +
        `+${result.earnedPoints} loyalty points earned!`;
    } else {
      statusElement.textContent =
        "🎉 +10 game points! Today's 100 loyalty points limit reached.";
    }
  } catch (error) {
    if (puzzleVersion === currentPuzzleVersion) {
      statusElement.textContent =
        "Puzzle complete! Unable to save loyalty points.";
    }
  }
}

function checkCompletion() {
  if (completed) return;

  if (!board.every(
    (value, index) => value === solution[index]
  )) {
    return;
  }

  completed = true;
  clearInterval(timer);
  timer = null;

  statusElement.textContent = "Puzzle complete.";

  completionText.textContent =
    `You solved the ${difficultyElement.value} puzzle ` +
    `in ${formatTime(seconds)} with ${mistakes} mistakes.`;

  completionElement.classList.remove("hidden");

  awardSudokuPoints();
}

function beginGame() {
  clearInterval(timer);

  initial = generatePuzzle(difficultyElement.value);
  board = [...initial];
  notes = Array.from(
    { length: 81 },
    () => new Set()
  );

  selected = -1;
  mistakes = 0;
  hints = 3;
  seconds = 0;
  notesMode = false;
  completed = false;
  gameWinId = createGameWinId();
  rewardClaimed = false;
  puzzleVersion++;

  notesButton.textContent = "Notes: Off";
  notesButton.setAttribute("aria-pressed", "false");

  completionElement.classList.add("hidden");

  statusElement.textContent =
    "Select a square to begin.";

  updateStats();
  renderBoard();
  startTimer();
}

function restartGame() {
  clearInterval(timer);

  board = [...initial];

  notes = Array.from(
    { length: 81 },
    () => new Set()
  );

  selected = -1;
  mistakes = 0;
  seconds = 0;
  completed = false;
  puzzleVersion++;

  completionElement.classList.add("hidden");

  statusElement.textContent = "Puzzle restarted.";

  updateStats();
  renderBoard();
  startTimer();
}

document.querySelectorAll("[data-number]")
  .forEach(button => {
    button.addEventListener("click", () => {
      enterNumber(Number(button.dataset.number));
    });
  });

document.getElementById("newGame")
  .addEventListener("click", beginGame);

document.getElementById("playAgain")
  .addEventListener("click", beginGame);

document.getElementById("restart")
  .addEventListener("click", restartGame);

document.getElementById("hint")
  .addEventListener("click", giveHint);

document.getElementById("erase")
  .addEventListener("click", eraseSelected);

notesButton.addEventListener("click", () => {
  notesMode = !notesMode;

  notesButton.textContent =
    `Notes: ${notesMode ? "On" : "Off"}`;

  notesButton.setAttribute(
    "aria-pressed",
    String(notesMode)
  );
});

document.addEventListener("keydown", event => {
  if (
    ["INPUT", "SELECT", "TEXTAREA"]
      .includes(document.activeElement.tagName)
  ) {
    return;
  }

  if (/^[1-9]$/.test(event.key)) {
    enterNumber(Number(event.key));
  }

  if (
    event.key === "Backspace" ||
    event.key === "Delete"
  ) {
    eraseSelected();
  }

  if (
    selected < 0 ||
    ![
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight"
    ].includes(event.key)
  ) {
    return;
  }

  event.preventDefault();

  const moves = {
    ArrowUp: -9,
    ArrowDown: 9,
    ArrowLeft: -1,
    ArrowRight: 1
  };

  const col = selected % 9;

  if (
    event.key === "ArrowLeft" &&
    col === 0
  ) {
    return;
  }

  if (
    event.key === "ArrowRight" &&
    col === 8
  ) {
    return;
  }

  const next = selected + moves[event.key];

  if (next < 0 || next >= 81) return;

  selected = next;
  renderBoard();
});

async function initializeGame() {
  if (window.ChefDesk) {
    await ChefDesk.requireLogin();
  }

  beginGame();
}

initializeGame();
