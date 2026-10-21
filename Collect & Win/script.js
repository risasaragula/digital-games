
const COLLECTIONS = [
  {
    name: "Quick Bites",
    description: "Level 1 · Snack favourites",
    items: [
      { id: "burger", name: "Burger", icon: "🍔" },
      { id: "pizza", name: "Pizza", icon: "🍕" },
      { id: "fries", name: "Fries", icon: "🍟" },
      { id: "hotdog", name: "Hot Dog", icon: "🌭" }
    ]
  },
  {
    name: "Sweet Treats",
    description: "Level 2 · Dessert favourites",
    items: [
      { id: "icecream", name: "Ice Cream", icon: "🍦" },
      { id: "donut", name: "Donut", icon: "🍩" },
      { id: "cake", name: "Cake", icon: "🍰" },
      { id: "cookie", name: "Cookie", icon: "🍪" }
    ]
  },
  {
    name: "Fresh Picks",
    description: "Level 3 · Fresh and fruity",
    items: [
      { id: "apple", name: "Apple", icon: "🍎" },
      { id: "banana", name: "Banana", icon: "🍌" },
      { id: "strawberry", name: "Strawberry", icon: "🍓" },
      { id: "watermelon", name: "Watermelon", icon: "🍉" }
    ]
  }
];

const STORAGE_KEY = "chefdesk_collect_win_v1";

const pointsElement = document.getElementById("points");
const collectedElement = document.getElementById("collected");
const levelElement = document.getElementById("level");
const progressText = document.getElementById("progressText");
const progressFill = document.getElementById("progressFill");
const progressTrack = document.getElementById("progressTrack");
const statusElement = document.getElementById("status");

const mysteryCard = document.getElementById("mysteryCard");
const mysteryIcon = document.getElementById("mysteryIcon");
const mysteryTitle = document.getElementById("mysteryTitle");
const mysteryDescription = document.getElementById("mysteryDescription");

const collectButton = document.getElementById("collectButton");
const collectionsContainer = document.getElementById("collectionsContainer");

const TOTAL_ITEMS = COLLECTIONS.reduce(
  (total, collection) => total + collection.items.length,
  0
);

let state = loadState();

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));

    if (saved && Array.isArray(saved.collected)) {
      const validIds = new Set(
        COLLECTIONS.flatMap(collection =>
          collection.items.map(item => item.id)
        )
      );

      return {
        collected: [...new Set(saved.collected)].filter(
          id => validIds.has(id)
        )
      };
    }
  } catch (error) {
    // Start with an empty collection if storage is unavailable.
  }

  return { collected: [] };
}

function saveState() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    // Gameplay remains available without persistent storage.
  }
}

function isCollectionComplete(index) {
  return COLLECTIONS[index].items.every(item =>
    state.collected.includes(item.id)
  );
}

function getCurrentLevel() {
  for (let index = 0; index < COLLECTIONS.length; index++) {
    if (!isCollectionComplete(index)) {
      return index + 1;
    }
  }

  return COLLECTIONS.length;
}

function getPoints() {
  const completedCollections = COLLECTIONS.filter(
    (_, index) => isCollectionComplete(index)
  ).length;

  return state.collected.length * 10 + completedCollections * 100;
}

function getAvailableItems() {
  const levelIndex = getCurrentLevel() - 1;

  return COLLECTIONS[levelIndex].items.filter(
    item => !state.collected.includes(item.id)
  );
}

function isGameComplete() {
  return state.collected.length === TOTAL_ITEMS;
}

function updateStats() {
  const count = state.collected.length;
  const percentage = Math.round((count / TOTAL_ITEMS) * 100);

  pointsElement.textContent = getPoints();
  collectedElement.textContent = `${count}/${TOTAL_ITEMS}`;
  levelElement.textContent = getCurrentLevel();
  progressText.textContent = `${percentage}%`;
  progressFill.style.width = `${percentage}%`;
  progressTrack.setAttribute("aria-valuenow", String(percentage));
}

function renderCollections() {
  collectionsContainer.innerHTML = COLLECTIONS.map((collection, index) => {
    const unlocked = index === 0 || isCollectionComplete(index - 1);

    const collectedCount = collection.items.filter(
      item => state.collected.includes(item.id)
    ).length;

    const completed = collectedCount === collection.items.length;

    const itemsHtml = collection.items.map(item => {
      const collected = state.collected.includes(item.id);

      const itemClass = collected
        ? "collected-item"
        : unlocked
          ? "hidden-item"
          : "locked-item";

      return `
        <div class="food-item ${itemClass}">
          <div class="food-icon">${collected ? item.icon : "❔"}</div>
          <div class="food-name">
            ${collected ? item.name : unlocked ? "Not discovered" : "Locked"}
          </div>
        </div>
      `;
    }).join("");

    return `
      <div class="collection-group ${unlocked ? "" : "locked"}">
        <div class="collection-header">
          <div>
            <h3>${collection.name}</h3>
            <p>${collection.description}</p>
          </div>

          <span class="collection-badge">
            ${completed ? "✓ Complete" : unlocked ? `${collectedCount}/4` : "🔒 Locked"}
          </span>
        </div>

        <div class="food-grid">
          ${itemsHtml}
        </div>
      </div>
    `;
  }).join("");
}

function render() {
  updateStats();
  renderCollections();

  if (isGameComplete()) {
    collectButton.disabled = true;
    collectButton.textContent = "Collection Complete";
    statusElement.textContent =
      "Congratulations! You collected all 12 foods and completed every level.";
  } else {
    collectButton.disabled = false;
    collectButton.textContent = "Discover Food";
  }
}

function discoverFood() {
  if (isGameComplete()) {
    return;
  }

  const previousLevel = getCurrentLevel();
  const availableItems = getAvailableItems();

  if (availableItems.length === 0) {
    return;
  }

  const randomIndex = Math.floor(Math.random() * availableItems.length);
  const item = availableItems[randomIndex];

  state.collected.push(item.id);
  saveState();

  mysteryCard.classList.add("revealed");
  mysteryIcon.textContent = item.icon;
  mysteryTitle.textContent = item.name;
  mysteryDescription.textContent = "+10 points · New food discovered!";

  render();

  if (isGameComplete()) {
    mysteryDescription.textContent =
      "+110 points · Final collection completed!";
    return;
  }

  if (getCurrentLevel() > previousLevel) {
    statusElement.textContent =
      `Collection completed! +100 bonus points. Level ${getCurrentLevel()} unlocked!`;
  } else {
    statusElement.textContent =
      `${item.name} collected! Keep discovering to complete this collection.`;
  }
}

function resetGame() {
  const confirmed = window.confirm(
    "Reset your collection? All collected foods and points will be cleared."
  );

  if (!confirmed) {
    return;
  }

  state = { collected: [] };
  saveState();

  mysteryCard.classList.remove("revealed");
  mysteryIcon.textContent = "❔";
  mysteryTitle.textContent = "Mystery Food";
  mysteryDescription.textContent = "A delicious surprise awaits.";

  render();

  statusElement.textContent =
    "Collection reset. Discover your first food item!";
}

collectButton.addEventListener("click", discoverFood);

render();
