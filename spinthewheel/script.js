const checkinScreen = document.getElementById("checkin-screen");
const gameScreen = document.getElementById("game-screen");
const resultScreen = document.getElementById("result-screen");

const checkinForm = document.getElementById("checkin-form");
const checkinError = document.getElementById("checkin-error");
const visitCodeInput = document.getElementById("visit-code");
const loggedInPhone = document.getElementById("logged-in-phone");

const wheel = document.getElementById("wheel");
const spinButton = document.getElementById("spin-button");
const spinHint = document.getElementById("spin-hint");

const resultIcon = document.getElementById("result-icon");
const resultHeading = document.getElementById("result-heading");
const prizeName = document.getElementById("prize-name");
const resultDescription = document.getElementById("result-description");

const winnerActions = document.getElementById("winner-actions");
const loserActions = document.getElementById("loser-actions");

const prizes = [
  "FREE COFFEE",
  "10% OFF",
  "FREE DESSERT",
  "TRY AGAIN",
  "BONUS POINTS",
  "FREE UPGRADE"
];

const STORAGE_KEY = "chefdesk_spin_used_bills_v2";
const WIN_PROBABILITY = 0.20;

let customerPhone = "";
let visitCode = "";
let selectedPrize = "";
let isSpinning = false;
let spinUsed = false;

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

function saveUsedVisit(code) {
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

function showScreen(screen) {
  [checkinScreen, gameScreen, resultScreen].forEach(element => {
    element.hidden = true;
  });

  screen.hidden = false;
}

function normalizeVisitCode(code) {
  return code.trim().toUpperCase();
}

async function initialize() {
  try {
    const customer = await ChefDesk.requireLogin();

    customerPhone = customer.phone;
    loggedInPhone.textContent = customer.displayPhone;

    showScreen(checkinScreen);
  } catch (error) {
    console.error("Unable to initialize Spin & Win:", error);

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
      "Enter a valid visit code.";
    return;
  }

  if (getUsedVisits().includes(code)) {
    checkinError.textContent =
      "This bill has already been used for Spin & Win. " +
      "Please use a new bill code on your next visit.";

    return;
  }

  visitCode = code;
  spinUsed = false;
  isSpinning = false;

  spinButton.disabled = false;
  spinHint.textContent = "One spin per bill. Good luck!";

  showScreen(gameScreen);
});

spinButton.addEventListener("click", () => {
  if (isSpinning || spinUsed || !visitCode) {
    return;
  }

  if (getUsedVisits().includes(visitCode)) {
    spinHint.textContent =
      "This bill has already been used.";

    spinButton.disabled = true;
    return;
  }

  if (!saveUsedVisit(visitCode)) {
    spinHint.textContent =
      "Unable to save this attempt. Please try again.";

    return;
  }

  isSpinning = true;
  spinUsed = true;
  spinButton.disabled = true;

  spinHint.textContent = "Spinning... good luck!";

  const isWinner = Math.random() < WIN_PROBABILITY;

  let winningIndex;

  if (isWinner) {
    const winningIndices = prizes
      .map((prize, index) => {
        return prize === "TRY AGAIN" ? -1 : index;
      })
      .filter(index => index !== -1);

    winningIndex = winningIndices[
      Math.floor(Math.random() * winningIndices.length)
    ];
  } else {
    winningIndex = prizes.indexOf("TRY AGAIN");
  }

  selectedPrize = prizes[winningIndex];

  const segmentAngle = 360 / prizes.length;

  const targetAngle = (
    360 - winningIndex * segmentAngle
  ) % 360;

  const rotation = 2160 + targetAngle;

  wheel.style.transition = "none";
  wheel.style.transform = "rotate(0deg)";

  void wheel.offsetWidth;

  wheel.style.transition = "";
  wheel.style.transform = `rotate(${rotation}deg)`;

  function finish(event) {
    if (event.propertyName !== "transform") {
      return;
    }

    wheel.removeEventListener("transitionend", finish);

    isSpinning = false;
    displayResult();
  }

  wheel.addEventListener("transitionend", finish);
});

function displayResult() {
  winnerActions.hidden = true;
  loserActions.hidden = true;

  if (selectedPrize === "TRY AGAIN") {
    resultIcon.textContent = "🍀";
    resultHeading.textContent = "Better luck next time!";
    prizeName.textContent = "TRY AGAIN";

    resultDescription.textContent =
      "No reward this time. Come back for another " +
      "restaurant visit to try again.";

    loserActions.hidden = false;
  } else {
    resultIcon.textContent = "🎉";
    resultHeading.textContent = "Congratulations!";
    prizeName.textContent = selectedPrize;

    resultDescription.textContent =
      "Your demo reward has been added to " +
      "My Rewards on this browser. " +
      "It is not a redeemable restaurant coupon.";

    ChefDesk.addDemoReward(
      "Spin & Win",
      selectedPrize,
      visitCode
    );

    winnerActions.hidden = false;
  }

  showScreen(resultScreen);
}

initialize();