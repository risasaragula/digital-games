
const foodItems = [
  "Pizza",
  "Burger",
  "Pasta",
  "Dosa",
  "Biryani",
  "Noodles",
  "Sandwich",
  "Ice Cream",
  "Coffee",
  "Cake",
  "Fries",
  "Taco",
  "Donut"
];

const grid = document.getElementById("memoryGrid");
const movesElement = document.getElementById("moves");
const matchesElement = document.getElementById("matches");
const timerElement = document.getElementById("timer");
const statusElement = document.getElementById("status");
const completionPanel = document.getElementById("completionPanel");
const completionText = document.getElementById("completionText");

let cards = [];
let selectedCards = [];
let matchedSets = 0;
let moves = 0;
let seconds = 0;
let timer = null;
let hideTimeout = null;
let locked = false;
let gameStarted = false;
let gameCompleted = false;

function shuffle(items) {
  const array = [...items];

  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }

  return array;
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const remaining = totalSeconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(remaining).padStart(2, "0")}`;
}

function updateStats() {
  movesElement.textContent = moves;
  matchesElement.textContent = `${matchedSets}/${foodItems.length}`;
  timerElement.textContent = formatTime(seconds);
}

function startTimer() {
  if (gameStarted) return;

  gameStarted = true;

  timer = setInterval(() => {
    seconds++;
    updateStats();
  }, 1000);
}

function createDeck() {
  const deck = [];

  foodItems.forEach((food, index) => {
    for (let copy = 0; copy < 3; copy++) {
      deck.push({
        id: `${index}-${copy}`,
        food,
        matched: false,
        bonus: false
      });
    }
  });

  deck.push({
    id: "bonus",
    food: "BONUS",
    matched: false,
    bonus: true
  });

  return shuffle(deck);
}

function getCardElement(index) {
  return grid.children[index];
}

function revealCard(index) {
  const card = cards[index];
  const element = getCardElement(index);

  element.textContent = card.food;
  element.classList.add("flipped");
  element.setAttribute("aria-label", card.food);
}

function hideCard(index) {
  const element = getCardElement(index);

  element.textContent = "?";
  element.classList.remove("flipped");
  element.setAttribute("aria-label", `Hidden card ${index + 1}`);
}

function renderCards() {
  grid.replaceChildren();

  cards.forEach((card, index) => {
    const button = document.createElement("button");

    button.type = "button";
    button.className = "memory-card";
    button.textContent = "?";
    button.setAttribute("aria-label", `Hidden card ${index + 1}`);

    button.addEventListener("click", () => flipCard(index));

    grid.appendChild(button);
  });
}

function flipCard(index) {
  if (locked || gameCompleted) return;

  const card = cards[index];

  if (card.matched || selectedCards.includes(index)) return;

  if (card.bonus) {
    statusElement.textContent =
      "Special card found. Complete all 13 sets to reveal it.";
    return;
  }

  startTimer();
  revealCard(index);
  selectedCards.push(index);

  if (selectedCards.length < 3) {
    statusElement.textContent =
      `${selectedCards.length} of 3 cards selected.`;
    return;
  }

  moves++;
  updateStats();

  const selectedFoods = selectedCards.map(i => cards[i].food);
  const isMatch = selectedFoods.every(food => food === selectedFoods[0]);

  if (isMatch) {
    selectedCards.forEach(i => {
      cards[i].matched = true;

      const element = getCardElement(i);
      element.classList.add("matched");
      element.disabled = true;
    });

    matchedSets++;
    selectedCards = [];
    statusElement.textContent = "Triple match completed.";
    updateStats();

    if (matchedSets === foodItems.length) {
      finishGame();
    }
  } else {
    locked = true;
    statusElement.textContent = "Not a match. Try again.";

    const cardsToHide = [...selectedCards];

    hideTimeout = setTimeout(() => {
      cardsToHide.forEach(hideCard);
      selectedCards = [];
      locked = false;
      hideTimeout = null;
    }, 1100);
  }
}

function finishGame() {
  clearInterval(timer);
  timer = null;
  gameCompleted = true;

  const bonusIndex = cards.findIndex(card => card.bonus);

  if (bonusIndex !== -1) {
    const bonusElement = getCardElement(bonusIndex);

    bonusElement.textContent = "BONUS";
    bonusElement.classList.add("bonus", "flipped");
    bonusElement.setAttribute("aria-label", "Bonus card revealed");
    bonusElement.disabled = true;
  }

  statusElement.textContent = "All 13 triple matches completed.";

  completionText.textContent =
    `You completed the challenge in ${moves} moves and ${formatTime(seconds)}.`;

  completionPanel.classList.remove("hidden");
}

function startGame() {
  clearInterval(timer);
  clearTimeout(hideTimeout);

  timer = null;
  hideTimeout = null;
  cards = createDeck();
  selectedCards = [];
  matchedSets = 0;
  moves = 0;
  seconds = 0;
  locked = false;
  gameStarted = false;
  gameCompleted = false;

  completionPanel.classList.add("hidden");
  statusElement.textContent = "Find three identical food cards.";

  renderCards();
  updateStats();
}

document.getElementById("restartGame")
  .addEventListener("click", startGame);

document.getElementById("playAgain")
  .addEventListener("click", startGame);

startGame();
