
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const scoreElement = document.getElementById("score");
const bestScoreElement = document.getElementById("bestScore");
const livesElement = document.getElementById("lives");
const levelElement = document.getElementById("level");
const statusElement = document.getElementById("status");

const startButton = document.getElementById("startButton");
const pauseButton = document.getElementById("pauseButton");
const restartButton = document.getElementById("restartButton");
const playAgainButton = document.getElementById("playAgain");

const completionPanel = document.getElementById("completionPanel");
const completionLabel = document.getElementById("completionLabel");
const completionTitle = document.getElementById("completionTitle");
const completionText = document.getElementById("completionText");

const TILE_SIZE = 24;
const ROWS = 21;
const COLS = 21;

const DIRECTIONS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 }
};

const OPPOSITE = {
  up: "down",
  down: "up",
  left: "right",
  right: "left"
};

const MAZE = [
  "#####################",
  "#.........#.........#",
  "#.###.###.#.###.###.#",
  "#o###.###.#.###.###o#",
  "#...................#",
  "#.###.#.#####.#.###.#",
  "#.....#...#...#.....#",
  "#####.###.#.###.#####",
  "#...#..... .....#...#",
  "#.#.#.###   ###.#.#.#",
  "#.#...#       #...#.#",
  "#.#.#.###   ###.#.#.#",
  "#...#..... .....#...#",
  "#####.###.#.###.#####",
  "#.....#...#...#.....#",
  "#.###.#.#####.#.###.#",
  "#o..#...........#..o#",
  "###.#.###.#.###.#.###",
  "#.....#...#...#.....#",
  "#.#######.#.#######.#",
  "#####################"
];

const PLAYER_START = { x: 10, y: 16 };

const GHOST_STARTS = [
  { x: 9, y: 10, color: "#df794e" },
  { x: 10, y: 10, color: "#f19bb0" },
  { x: 11, y: 10, color: "#77c8c1" },
  { x: 10, y: 9, color: "#d6a5ec" }
];

const SAFE_TILES = new Set([
  "9,8", "10,8", "11,8",
  "9,9", "10,9", "11,9",
  "7,10", "8,10", "9,10", "10,10", "11,10", "12,10", "13,10",
  "9,11", "10,11", "11,11",
  "9,12", "10,12", "11,12",
  "10,16"
]);

let maze = [];
let player = null;
let ghosts = [];

let score = 0;
let lives = 3;
let level = 1;
let pelletsLeft = 0;

let bestScore = 0;

let gameState = "ready";
let desiredDirection = "left";
let powerUntil = 0;
let gameClock = 0;
let lastFrame = 0;
let accumulator = 0;
let animationId = null;
let lastStatus = "";

try {
  bestScore = Number(localStorage.getItem("chefdesk_pacman_best")) || 0;
} catch (error) {
  bestScore = 0;
}

function setStatus(message) {
  if (lastStatus !== message) {
    statusElement.textContent = message;
    lastStatus = message;
  }
}

function createMaze() {
  maze = MAZE.map(row => row.split(""));
  pelletsLeft = 0;

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (SAFE_TILES.has(`${x},${y}`)) {
        maze[y][x] = " ";
      }

      if (maze[y][x] === "." || maze[y][x] === "o") {
        pelletsLeft++;
      }
    }
  }
}

function isWalkable(x, y) {
  return (
    x >= 0 &&
    x < COLS &&
    y >= 0 &&
    y < ROWS &&
    maze[y][x] !== "#"
  );
}

function getValidDirections(x, y) {
  return Object.keys(DIRECTIONS).filter(direction => {
    const vector = DIRECTIONS[direction];

    return isWalkable(x + vector.x, y + vector.y);
  });
}

function createCharacters() {
  player = {
    x: PLAYER_START.x,
    y: PLAYER_START.y,
    direction: "left",
    mouthOpen: true
  };

  ghosts = GHOST_STARTS.map((start, index) => ({
    x: start.x,
    y: start.y,
    startX: start.x,
    startY: start.y,
    direction: ["left", "right", "up", "down"][index],
    color: start.color,
    index
  }));

  desiredDirection = "left";
  powerUntil = 0;
}

function updateStats() {
  scoreElement.textContent = score;
  bestScoreElement.textContent = bestScore;
  livesElement.textContent = lives;
  levelElement.textContent = level;
}

function saveBestScore() {
  if (score > bestScore) {
    bestScore = score;

    try {
      localStorage.setItem("chefdesk_pacman_best", String(bestScore));
    } catch (error) {
      bestScore = score;
    }
  }
}

function addScore(points) {
  score += points;
  saveBestScore();
  updateStats();
}

function startNewGame() {
  score = 0;
  lives = 3;
  level = 1;
  gameClock = 0;
  accumulator = 0;

  createMaze();
  createCharacters();
  updateStats();

  gameState = "playing";
  completionPanel.classList.add("hidden");

  startButton.disabled = true;
  pauseButton.disabled = false;
  pauseButton.textContent = "Pause";

  setStatus("Collect all the pellets. Watch out for ghosts!");

  lastFrame = performance.now();
  draw();
}

function startNextLevel() {
  level++;
  gameClock = 0;
  accumulator = 0;

  createMaze();
  createCharacters();
  updateStats();

  setStatus(`Level ${level}! The ghosts are getting faster.`);
}

function resetPositions() {
  createCharacters();
  accumulator = 0;
}

function finishGame() {
  gameState = "over";

  startButton.disabled = false;
  startButton.textContent = "Start Game";
  pauseButton.disabled = true;

  completionLabel.textContent = "GAME OVER";
  completionTitle.textContent = "Nice run!";
  completionText.textContent =
    `You scored ${score} points and reached level ${level}. Ready for another round?`;

  completionPanel.classList.remove("hidden");
  setStatus("Game over. Try again and beat your best score.");
}

function togglePause() {
  if (gameState === "playing") {
    gameState = "paused";
    pauseButton.textContent = "Resume";
    setStatus("Game paused.");
  } else if (gameState === "paused") {
    gameState = "playing";
    pauseButton.textContent = "Pause";
    setStatus("Back in the game!");
    lastFrame = performance.now();
  }
}

function setDirection(direction) {
  if (!DIRECTIONS[direction]) {
    return;
  }

  desiredDirection = direction;
}

function movePlayer() {
  const wanted = DIRECTIONS[desiredDirection];

  if (
    isWalkable(
      player.x + wanted.x,
      player.y + wanted.y
    )
  ) {
    player.direction = desiredDirection;
  }

  const vector = DIRECTIONS[player.direction];

  if (
    isWalkable(
      player.x + vector.x,
      player.y + vector.y
    )
  ) {
    player.x += vector.x;
    player.y += vector.y;
  }

  player.mouthOpen = !player.mouthOpen;
}

function collectPellet() {
  const tile = maze[player.y][player.x];

  if (tile === ".") {
    maze[player.y][player.x] = " ";
    pelletsLeft--;
    addScore(10);
  } else if (tile === "o") {
    maze[player.y][player.x] = " ";
    pelletsLeft--;
    addScore(50);

    powerUntil = gameClock + 6500;
    setStatus("Power mode! You can catch the ghosts.");
  }

  if (pelletsLeft === 0) {
    addScore(200);
    startNextLevel();
    return true;
  }

  return false;
}

function isPowered() {
  return gameClock < powerUntil;
}

function getDistance(x1, y1, x2, y2) {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2);
}

function chooseGhostDirection(ghost) {
  const options = getValidDirections(ghost.x, ghost.y);

  if (options.length === 0) {
    return ghost.direction;
  }

  let choices = options;

  if (options.length > 1) {
    const withoutReverse = options.filter(
      direction => direction !== OPPOSITE[ghost.direction]
    );

    if (withoutReverse.length > 0) {
      choices = withoutReverse;
    }
  }

  const randomMove = Math.random() < 0.28;

  if (randomMove) {
    return choices[Math.floor(Math.random() * choices.length)];
  }

  const frightened = isPowered();

  const sorted = [...choices].sort((a, b) => {
    const nextA = DIRECTIONS[a];
    const nextB = DIRECTIONS[b];

    const distanceA = getDistance(
      ghost.x + nextA.x,
      ghost.y + nextA.y,
      player.x,
      player.y
    );

    const distanceB = getDistance(
      ghost.x + nextB.x,
      ghost.y + nextB.y,
      player.x,
      player.y
    );

    return frightened
      ? distanceB - distanceA
      : distanceA - distanceB;
  });

  return sorted[0];
}

function moveGhosts() {
  ghosts.forEach(ghost => {
    ghost.direction = chooseGhostDirection(ghost);

    const vector = DIRECTIONS[ghost.direction];

    if (
      isWalkable(
        ghost.x + vector.x,
        ghost.y + vector.y
      )
    ) {
      ghost.x += vector.x;
      ghost.y += vector.y;
    }
  });
}

function checkCollisions() {
  for (const ghost of ghosts) {
    if (ghost.x !== player.x || ghost.y !== player.y) {
      continue;
    }

    if (isPowered()) {
      addScore(200);

      ghost.x = ghost.startX;
      ghost.y = ghost.startY;
      ghost.direction = "up";

      setStatus("Ghost caught! +200 points.");
    } else {
      lives--;
      updateStats();

      if (lives <= 0) {
        finishGame();
      } else {
        resetPositions();
        setStatus(`Watch out! ${lives} lives remaining.`);
      }

      return true;
    }
  }

  return false;
}

function updateGame() {
  if (gameState !== "playing") {
    return;
  }

  const previousPlayer = { x: player.x, y: player.y };
  const previousGhosts = ghosts.map(ghost => ({
    x: ghost.x,
    y: ghost.y
  }));

  movePlayer();

  if (checkCollisions()) {
    return;
  }

  if (collectPellet()) {
    return;
  }

  moveGhosts();

  if (checkCollisions()) {
    return;
  }

  for (let i = 0; i < ghosts.length; i++) {
    const ghost = ghosts[i];
    const previousGhost = previousGhosts[i];

    const crossedPaths =
      ghost.x === previousPlayer.x &&
      ghost.y === previousPlayer.y &&
      previousGhost.x === player.x &&
      previousGhost.y === player.y;

    if (crossedPaths) {
      if (isPowered()) {
        addScore(200);

        ghost.x = ghost.startX;
        ghost.y = ghost.startY;
        ghost.direction = "up";
      } else {
        lives--;
        updateStats();

        if (lives <= 0) {
          finishGame();
        } else {
          resetPositions();
          setStatus(`Watch out! ${lives} lives remaining.`);
        }

        return;
      }
    }
  }

  if (!isPowered() && powerUntil !== 0) {
    powerUntil = 0;
    setStatus("Power mode ended. Avoid the ghosts!");
  }
}

function drawWalls() {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (maze[y][x] !== "#") {
        continue;
      }

      const px = x * TILE_SIZE;
      const py = y * TILE_SIZE;

      ctx.fillStyle = "#285640";
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

      ctx.fillStyle = "#32684d";
      ctx.fillRect(px + 3, py + 3, TILE_SIZE - 6, TILE_SIZE - 6);
    }
  }
}

function drawPellets() {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const tile = maze[y][x];

      if (tile !== "." && tile !== "o") {
        continue;
      }

      const centerX = x * TILE_SIZE + TILE_SIZE / 2;
      const centerY = y * TILE_SIZE + TILE_SIZE / 2;

      ctx.beginPath();

      ctx.arc(
        centerX,
        centerY,
        tile === "o" ? 6 : 2.8,
        0,
        Math.PI * 2
      );

      ctx.fillStyle = tile === "o"
        ? "#df794e"
        : "#e9d9ad";

      ctx.fill();
    }
  }
}

function drawPlayer() {
  const centerX = player.x * TILE_SIZE + TILE_SIZE / 2;
  const centerY = player.y * TILE_SIZE + TILE_SIZE / 2;

  const rotations = {
    right: 0,
    down: Math.PI / 2,
    left: Math.PI,
    up: -Math.PI / 2
  };

  const angle = rotations[player.direction];
  const mouth = player.mouthOpen ? 0.28 : 0.07;

  ctx.beginPath();

  ctx.moveTo(centerX, centerY);

  ctx.arc(
    centerX,
    centerY,
    TILE_SIZE * 0.43,
    angle + mouth,
    angle + Math.PI * 2 - mouth
  );

  ctx.closePath();
  ctx.fillStyle = "#f5c85a";
  ctx.fill();
}

function drawGhost(ghost) {
  const x = ghost.x * TILE_SIZE + TILE_SIZE / 2;
  const y = ghost.y * TILE_SIZE + TILE_SIZE / 2;
  const radius = TILE_SIZE * 0.39;

  ctx.beginPath();

  ctx.arc(
    x,
    y - 2,
    radius,
    Math.PI,
    0
  );

  ctx.lineTo(x + radius, y + radius);

  for (let i = 2; i >= -2; i--) {
    ctx.lineTo(
      x + (i * radius) / 2,
      y + radius - (i % 2 === 0 ? 0 : 4)
    );
  }

  ctx.closePath();

  ctx.fillStyle = isPowered()
    ? "#638fca"
    : ghost.color;

  ctx.fill();

  ctx.fillStyle = "white";

  ctx.beginPath();
  ctx.arc(x - 4, y - 2, 3.2, 0, Math.PI * 2);
  ctx.arc(x + 4, y - 2, 3.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#163b2c";

  ctx.beginPath();
  ctx.arc(x - 4, y - 2, 1.5, 0, Math.PI * 2);
  ctx.arc(x + 4, y - 2, 1.5, 0, Math.PI * 2);
  ctx.fill();
}

function drawOverlay(title, subtitle) {
  ctx.fillStyle = "rgba(10, 30, 22, 0.78)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.textAlign = "center";

  ctx.fillStyle = "#fffdf8";
  ctx.font = "bold 31px Georgia";
  ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 12);

  ctx.font = "14px Arial";
  ctx.fillStyle = "#e9d9ad";
  ctx.fillText(subtitle, canvas.width / 2, canvas.height / 2 + 23);
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#10281f";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawWalls();
  drawPellets();

  if (player) {
    drawPlayer();
  }

  ghosts.forEach(drawGhost);

  if (gameState === "ready") {
    drawOverlay("PAC-MAN", "Press Start Game to play");
  } else if (gameState === "paused") {
    drawOverlay("PAUSED", "Press Resume or Space");
  } else if (gameState === "over") {
    drawOverlay("GAME OVER", `Final score: ${score}`);
  }
}

function gameLoop(timestamp) {
  if (!lastFrame) {
    lastFrame = timestamp;
  }

  const delta = Math.min(timestamp - lastFrame, 100);
  lastFrame = timestamp;

  if (gameState === "playing") {
    gameClock += delta;
    accumulator += delta;

    const stepDuration = Math.max(105, 230 - (level - 1) * 13);

    while (accumulator >= stepDuration && gameState === "playing") {
      updateGame();
      accumulator -= stepDuration;
    }
  }

  draw();

  animationId = requestAnimationFrame(gameLoop);
}

startButton.addEventListener("click", () => {
  startButton.textContent = "Start Game";
  startNewGame();
});

pauseButton.addEventListener("click", togglePause);
restartButton.addEventListener("click", startNewGame);
playAgainButton.addEventListener("click", startNewGame);

document.querySelectorAll("[data-direction]").forEach(button => {
  button.addEventListener("click", () => {
    setDirection(button.dataset.direction);
    canvas.focus();
  });
});

document.addEventListener("keydown", event => {
  const keyDirections = {
    ArrowUp: "up",
    ArrowDown: "down",
    ArrowLeft: "left",
    ArrowRight: "right",
    w: "up",
    s: "down",
    a: "left",
    d: "right"
  };

  const key = event.key.length === 1
    ? event.key.toLowerCase()
    : event.key;

  if (keyDirections[key]) {
    event.preventDefault();
    setDirection(keyDirections[key]);
  }

  if (event.code === "Space") {
    event.preventDefault();
    togglePause();
  }
});

let touchStartX = 0;
let touchStartY = 0;

canvas.addEventListener("touchstart", event => {
  const touch = event.changedTouches[0];

  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
}, { passive: true });

canvas.addEventListener("touchend", event => {
  const touch = event.changedTouches[0];

  const deltaX = touch.clientX - touchStartX;
  const deltaY = touch.clientY - touchStartY;

  if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 20) {
    return;
  }

  if (Math.abs(deltaX) > Math.abs(deltaY)) {
    setDirection(deltaX > 0 ? "right" : "left");
  } else {
    setDirection(deltaY > 0 ? "down" : "up");
  }
}, { passive: true });

createMaze();
createCharacters();
updateStats();
draw();

animationId = requestAnimationFrame(gameLoop);
