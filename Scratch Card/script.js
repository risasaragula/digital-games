
const checkinScreen = document.getElementById("checkin-screen");
const scratchScreen = document.getElementById("scratch-screen");
const resultScreen = document.getElementById("result-screen");
const checkinForm = document.getElementById("checkin-form");
const visitCodeInput = document.getElementById("visit-code");
const checkinError = document.getElementById("checkin-error");
const customerPhoneElement = document.getElementById("customer-phone");
const card = document.getElementById("scratch-card");
const canvas = document.getElementById("scratch-canvas");
const context = canvas.getContext("2d");
const hiddenPrize = document.getElementById("hidden-prize");
const hiddenEmoji = document.getElementById("hidden-emoji");
const progressText = document.getElementById("scratch-progress");
const revealButton = document.getElementById("reveal-button");
const resultEmoji = document.getElementById("result-emoji");
const resultHeading = document.getElementById("result-heading");
const resultPrize = document.getElementById("result-prize");
const resultDescription = document.getElementById("result-description");
const rewardsLink = document.getElementById("rewards-link");
const noWinNote = document.getElementById("no-win-note");

const STORAGE_KEY = "chefdesk_scratch_used_bills_v2";
const WIN_PROBABILITY = 0.20;

const outcomes = [
  { prize: "FREE COFFEE", emoji: "☕" },
  { prize: "10% OFF", emoji: "🎟️" },
  { prize: "FREE DESSERT", emoji: "🍰" },
  { prize: "TRY AGAIN", emoji: "🍀" },
  { prize: "BONUS POINTS", emoji: "⭐" },
  { prize: "FREE UPGRADE", emoji: "🎁" }
];

let customerPhone = "";
let visitCode = "";
let selectedOutcome = null;
let drawing = false;
let revealed = false;
let lastPoint = null;
let scratchMoves = 0;

function getUsedVisits() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "[]"
    );

    return Array.isArray(saved) ? saved : [];
  } catch (error) {
    console.error("Unable to load used visits:", error);
    return [];
  }
}

function showScreen(screen) {
  [checkinScreen, scratchScreen, resultScreen].forEach(item => {
    item.hidden = item !== screen;
  });
}

function normalizeVisitCode(code) {
  return code.trim().toUpperCase();
}

function reserveVisit(code) {
  const visits = getUsedVisits();

  if (visits.includes(code)) {
    return false;
  }

  visits.push(code);

  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(visits)
    );

    return true;
  } catch (error) {
    console.error("Unable to save visit:", error);
    return false;
  }
}

async function initialize() {
  try {
    const customer = await ChefDesk.requireLogin();

    customerPhone = customer.phone;
    customerPhoneElement.textContent = customer.displayPhone;

    showScreen(checkinScreen);
  } catch (error) {
    console.error("Unable to initialize Scratch & Win:", error);

    checkinError.textContent =
      "Unable to load your account. Please refresh and try again.";
  }
}

checkinForm.addEventListener("submit", event => {
  event.preventDefault();

  checkinError.textContent = "";

  const code = normalizeVisitCode(visitCodeInput.value);

  if (code.length < 4) {
    checkinError.textContent =
      "Enter a visit code with at least 4 characters.";
    return;
  }

  if (getUsedVisits().includes(code)) {
    checkinError.textContent =
      "This bill has already been used for Scratch & Win. " +
      "Please use a new bill code on your next visit.";
    return;
  }

  if (!reserveVisit(code)) {
    checkinError.textContent =
      "Unable to save your attempt. Please try again.";
    return;
  }

  visitCode = code;
  revealed = false;
  drawing = false;
  lastPoint = null;
  scratchMoves = 0;

  const isWinner = Math.random() < WIN_PROBABILITY;

  if (isWinner) {
    const winningOutcomes = outcomes.filter(
      outcome => outcome.prize !== "TRY AGAIN"
    );

    selectedOutcome = winningOutcomes[
      Math.floor(Math.random() * winningOutcomes.length)
    ];
  } else {
    selectedOutcome = outcomes.find(
      outcome => outcome.prize === "TRY AGAIN"
    );
  }

  hiddenPrize.textContent = selectedOutcome.prize;
  hiddenEmoji.textContent = selectedOutcome.emoji;

  progressText.textContent = "Scratched: 0%";
  canvas.style.display = "";

  showScreen(scratchScreen);
  requestAnimationFrame(prepareCanvas);
});

function prepareCanvas() {
  const bounds = card.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;

  canvas.width = Math.round(bounds.width * dpr);
  canvas.height = Math.round(bounds.height * dpr);

  context.setTransform(dpr, 0, 0, dpr, 0, 0);
  context.globalCompositeOperation = "source-over";

  const gradient = context.createLinearGradient(
    0,
    0,
    bounds.width,
    bounds.height
  );

  gradient.addColorStop(0, "#a9b4b4");
  gradient.addColorStop(0.5, "#e0e5e4");
  gradient.addColorStop(1, "#9da9a9");

  context.fillStyle = gradient;
  context.fillRect(0, 0, bounds.width, bounds.height);

  context.fillStyle = "#365447";
  context.font = "bold 20px Arial";
  context.textAlign = "center";
  context.textBaseline = "middle";

  context.fillText(
    "SCRATCH HERE ✨",
    bounds.width / 2,
    bounds.height / 2
  );

  context.globalCompositeOperation = "destination-out";
}

function getPoint(event) {
  const rect = canvas.getBoundingClientRect();

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

function scratchLine(from, to) {
  context.beginPath();
  context.lineWidth = 36;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.moveTo(from.x, from.y);
  context.lineTo(to.x, to.y);
  context.stroke();
}

canvas.addEventListener("pointerdown", event => {
  if (revealed || !selectedOutcome) {
    return;
  }

  drawing = true;
  lastPoint = getPoint(event);

  canvas.setPointerCapture(event.pointerId);
  scratchLine(lastPoint, lastPoint);
});

canvas.addEventListener("pointermove", event => {
  if (!drawing || revealed) {
    return;
  }

  const nextPoint = getPoint(event);

  scratchLine(lastPoint, nextPoint);
  lastPoint = nextPoint;
  scratchMoves++;

  if (scratchMoves % 8 === 0) {
    checkScratchProgress();
  }
});

function stopDrawing() {
  drawing = false;
  lastPoint = null;
}

canvas.addEventListener("pointerup", stopDrawing);
canvas.addEventListener("pointercancel", stopDrawing);

function checkScratchProgress() {
  const { width, height } = canvas;

  const pixels = context.getImageData(
    0,
    0,
    width,
    height
  ).data;

  let cleared = 0;
  let sampled = 0;

  for (let i = 3; i < pixels.length; i += 80) {
    sampled++;

    if (pixels[i] < 100) {
      cleared++;
    }
  }

  const percentage = sampled > 0
    ? (cleared / sampled) * 100
    : 0;

  progressText.textContent =
    `Scratched: ${Math.min(100, Math.round(percentage))}%`;

  if (percentage >= 40) {
    revealResult();
  }
}

revealButton.addEventListener("click", revealResult);

function revealResult() {
  if (revealed || !selectedOutcome) {
    return;
  }

  revealed = true;
  drawing = false;
  canvas.style.display = "none";

  const won = selectedOutcome.prize !== "TRY AGAIN";

  if (won) {
    ChefDesk.addDemoReward(
      "Scratch & Win",
      selectedOutcome.prize,
      visitCode
    );
  }

  resultEmoji.textContent = selectedOutcome.emoji;
  resultPrize.textContent = selectedOutcome.prize;

  resultHeading.textContent = won
    ? "Congratulations!"
    : "Better luck next time!";

  resultDescription.textContent = won
    ? "Your demo reward has been added automatically to My Rewards. This is not a redeemable coupon."
    : "No reward this time. Your next restaurant visit brings another chance.";

  rewardsLink.hidden = !won;
  noWinNote.hidden = won;

  showScreen(resultScreen);
}

initialize();