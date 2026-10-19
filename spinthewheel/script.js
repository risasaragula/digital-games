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
const STORAGE_KEY = "chefdesk_demo_used_visits";
let customerPhone = "";
let visitCode = "";
let selectedPrize = "";
let isSpinning = false;
let spinUsed = false;
function getUsedVisits() {
  try {
    return JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "[]"
    );
  } catch {
    return [];
  }
}
function saveUsedVisit(key) {
  const visits = getUsedVisits();
  if (!visits.includes(key)) {
    visits.push(key);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(visits)
    );
  }
}
function showScreen(screen) {
  [checkinScreen, gameScreen, resultScreen]
    .forEach(element => {
      element.hidden = true;
    });
  screen.hidden = false;
}
function visitKey(phone, code) {
  return `${phone}:${code.toUpperCase()}`;
}
async function initialize() {
  const customer = await ChefDesk.requireLogin();
  customerPhone = customer.phone;
  loggedInPhone.textContent = customer.displayPhone;
  showScreen(checkinScreen);
}
initialize();
checkinForm.addEventListener("submit", event => {
  event.preventDefault();
  checkinError.textContent = "";
  const code = visitCodeInput.value
    .trim()
    .toUpperCase();
  if (code.length < 4) {
    checkinError.textContent =
      "Enter a valid visit code.";
    return;
  }
  const key = visitKey(customerPhone, code);
  if (getUsedVisits().includes(key)) {
    checkinError.textContent =
      "You've already spun for this visit. " +
      "A new visit code is required.";
    return;
  }
  visitCode = code;
  spinUsed = false;
  showScreen(gameScreen);
});
spinButton.addEventListener("click", () => {
  if (isSpinning || spinUsed) return;
  isSpinning = true;
  spinUsed = true;
  spinButton.disabled = true;
  spinHint.textContent = "Spinning... good luck!";
  saveUsedVisit(visitKey(customerPhone, visitCode));
  const winningIndex = Math.floor(
    Math.random() * prizes.length
  );
  selectedPrize = prizes[winningIndex];
  const segmentAngle = 360 / prizes.length;
  const targetAngle = (360 - winningIndex * segmentAngle) % 360;
  const rotation = 2160 + targetAngle;
  wheel.style.transform = `rotate(${rotation}deg)`;
  wheel.addEventListener(
    "transitionend",
    function finish(event) {
      if (event.propertyName !== "transform") return;
      wheel.removeEventListener("transitionend", finish);
      isSpinning = false;
      displayResult();
    }
  );
});
function displayResult() {
  winnerActions.hidden = true;
  loserActions.hidden = true;
  if (selectedPrize === "TRY AGAIN") {
    resultIcon.textContent = "🍀";
    resultHeading.textContent = "Better luck next time!";
    prizeName.textContent = "TRY AGAIN";
    resultDescription.textContent = "No reward this time. Come back for " + "another restaurant visit to try again.";
    loserActions.hidden = false;
  } else {
    resultIcon.textContent = "🎉";
    resultHeading.textContent = "Congratulations!";
    prizeName.textContent = selectedPrize;
    resultDescription.textContent = "Your demo reward has been added to " + "My Rewards on this browser. " + "It is not a redeemable restaurant coupon.";
    ChefDesk.addDemoReward(
      "Spin & Win", selectedPrize, visitCode
    );
    winnerActions.hidden = false;
  }
  showScreen(resultScreen);
}