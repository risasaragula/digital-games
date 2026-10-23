
(() => {
  "use strict";

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

  const STORAGE_KEY = "chefdesk_collect_win_v2";
  const CLAIMS_KEY = "chefdesk_collect_bill_claims_v1";
  const WIN_PROBABILITY = 0.20;

  const pointsElement = document.getElementById("points");
  const collectedElement = document.getElementById("collected");
  const levelElement = document.getElementById("level");
  const progressText = document.getElementById("progressText");
  const progressFill = document.getElementById("progressFill");
  const progressTrack = document.getElementById("progressTrack");

  const visitStep = document.getElementById("visitStep");
  const discoveryStep = document.getElementById("discoveryStep");
  const collectionsSection = document.getElementById("collectionsSection");
  const rewardsPanel = document.getElementById("rewardsPanel");

  const visitForm = document.getElementById("visitForm");
  const phoneInput = document.getElementById("phoneNumber");
  const billInput = document.getElementById("billCode");
  const verificationStatus =
    document.getElementById("verificationStatus");

  const statusElement = document.getElementById("status");
  const mysteryCard = document.getElementById("mysteryCard");
  const mysteryIcon = document.getElementById("mysteryIcon");
  const mysteryTitle = document.getElementById("mysteryTitle");
  const mysteryDescription =
    document.getElementById("mysteryDescription");

  const collectButton = document.getElementById("collectButton");

  const collectionsContainer =
    document.getElementById("collectionsContainer");

  const TOTAL_ITEMS = COLLECTIONS.reduce(
    (total, collection) => total + collection.items.length,
    0
  );

  const VALID_IDS = new Set(
    COLLECTIONS.flatMap(collection =>
      collection.items.map(item => item.id)
    )
  );

  let currentPhone = "";
  let currentBill = "";
  let verified = false;
  let attemptCompleted = false;

  let customers = loadCustomers();
  let usedBills = loadUsedBills();

  function readStorage(key) {
    try {
      const value = JSON.parse(localStorage.getItem(key));

      return value &&
        typeof value === "object" &&
        !Array.isArray(value)
        ? value
        : {};
    } catch {
      return {};
    }
  }

  function loadCustomers() {
    return readStorage(STORAGE_KEY);
  }

  function loadUsedBills() {
    return readStorage(CLAIMS_KEY);
  }

  function saveData() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(customers)
      );

      localStorage.setItem(
        CLAIMS_KEY,
        JSON.stringify(usedBills)
      );

      return true;
    } catch (error) {
      console.error("Unable to save collection:", error);
      return false;
    }
  }

  function emptyCustomer() {
    return {
      collected: [],
      history: []
    };
  }

  function getCustomer() {
    if (!currentPhone) {
      return emptyCustomer();
    }

    const saved = customers[currentPhone];

    if (!saved || !Array.isArray(saved.collected)) {
      return emptyCustomer();
    }

    return {
      collected: [...new Set(saved.collected)].filter(
        id => VALID_IDS.has(id)
      ),
      history: Array.isArray(saved.history)
        ? saved.history
        : []
    };
  }

  function isCollectionComplete(index, customer) {
    return COLLECTIONS[index].items.every(item =>
      customer.collected.includes(item.id)
    );
  }

  function getCurrentLevel(customer) {
    for (let index = 0; index < COLLECTIONS.length; index++) {
      if (!isCollectionComplete(index, customer)) {
        return index + 1;
      }
    }

    return COLLECTIONS.length;
  }

  function getPoints(customer) {
    const completedCollections = COLLECTIONS.filter(
      (_, index) => isCollectionComplete(index, customer)
    ).length;

    return customer.collected.length * 10 +
      completedCollections * 100;
  }

  function isGameComplete(customer) {
    return customer.collected.length === TOTAL_ITEMS;
  }

  function updateStats(customer) {
    const count = customer.collected.length;
    const percentage = Math.round(
      (count / TOTAL_ITEMS) * 100
    );

    pointsElement.textContent = getPoints(customer);
    collectedElement.textContent = `${count}/${TOTAL_ITEMS}`;
    levelElement.textContent = getCurrentLevel(customer);
    progressText.textContent = `${percentage}%`;
    progressFill.style.width = `${percentage}%`;

    progressTrack.setAttribute(
      "aria-valuenow",
      String(percentage)
    );
  }

  function renderCollections(customer) {
    collectionsContainer.innerHTML = COLLECTIONS.map(
      (collection, index) => {
        const unlocked =
          index === 0 ||
          isCollectionComplete(index - 1, customer);

        const collectedCount = collection.items.filter(
          item => customer.collected.includes(item.id)
        ).length;

        const completed =
          collectedCount === collection.items.length;

        const itemsHtml = collection.items.map(item => {
          const collected = customer.collected.includes(item.id);

          const itemClass = collected
            ? "collected-item"
            : unlocked
              ? "hidden-item"
              : "locked-item";

          return `
            <div class="food-item ${itemClass}">
              <div class="food-icon">
                ${collected ? item.icon : "❔"}
              </div>
              <div class="food-name">
                ${
                  collected
                    ? item.name
                    : unlocked
                      ? "Not discovered"
                      : "Locked"
                }
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
                ${
                  completed
                    ? "✓ Complete"
                    : unlocked
                      ? `${collectedCount}/4`
                      : "🔒 Locked"
                }
              </span>
            </div>

            <div class="food-grid">
              ${itemsHtml}
            </div>
          </div>
        `;
      }
    ).join("");
  }

  function render() {
    const customer = getCustomer();

    updateStats(customer);
    renderCollections(customer);

    if (isGameComplete(customer)) {
      verified = false;
      collectButton.disabled = true;
      collectButton.textContent = "Collection Complete";

      if (!attemptCompleted) {
        statusElement.textContent =
          "Congratulations! You completed all three food collections.";
      }

      return;
    }

    collectButton.disabled = !verified || attemptCompleted;
    collectButton.textContent = attemptCompleted
      ? "Attempt Completed"
      : "Discover Food";
  }

  function normalizeBill(value) {
    return value.trim().toUpperCase();
  }

  function resetMystery() {
    mysteryCard.classList.remove("revealed");
    mysteryIcon.textContent = "❔";
    mysteryTitle.textContent = "Mystery Food";
    mysteryDescription.textContent =
      "A delicious surprise awaits.";
  }

  function showVisitStep() {
    visitStep.hidden = false;
    discoveryStep.hidden = true;
    collectionsSection.hidden = true;
    rewardsPanel.hidden = true;

    visitStep.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  function showDiscoveryStep() {
    visitStep.hidden = true;
    discoveryStep.hidden = false;
    collectionsSection.hidden = false;
    rewardsPanel.hidden = false;

    discoveryStep.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  function verifyVisit(event) {
    event.preventDefault();

    const phone = phoneInput.value.trim();
    const bill = normalizeBill(billInput.value);

    verificationStatus.textContent = "";

    if (!/^[6-9]\d{9}$/.test(phone)) {
      verificationStatus.textContent =
        "Enter a valid 10-digit mobile number.";
      return;
    }

    if (bill.length < 4) {
      verificationStatus.textContent =
        "Bill code must contain at least 4 characters.";
      return;
    }

    currentPhone = phone;
    currentBill = bill;
    verified = false;
    attemptCompleted = false;

    resetMystery();
    render();

    const customer = getCustomer();

    if (isGameComplete(customer)) {
      verificationStatus.textContent =
        "You have already completed all collections!";
      return;
    }

    if (usedBills[bill]) {
      verificationStatus.textContent =
        "This bill has already been used for Collect & Win.";
      return;
    }

    verified = true;

    render();

    statusElement.textContent =
      "Your visit is ready. Tap Discover Food to reveal your result!";

    showDiscoveryStep();
  }

  function discoverFood() {
    if (
      !verified ||
      attemptCompleted ||
      !currentPhone ||
      !currentBill
    ) {
      return;
    }

    if (usedBills[currentBill]) {
      verified = false;
      attemptCompleted = true;
      render();

      statusElement.textContent =
        "This bill has already been used.";
      return;
    }

    const customer = getCustomer();

    if (isGameComplete(customer)) {
      verified = false;
      render();
      return;
    }

    const isWinner = Math.random() < WIN_PROBABILITY;
    const now = new Date().toISOString();

    if (!isWinner) {
      const claim = {
        phone: currentPhone,
        result: "TRY AGAIN",
        itemId: null,
        date: now
      };

      usedBills[currentBill] = claim;

      if (!saveData()) {
        delete usedBills[currentBill];

        statusElement.textContent =
          "Unable to save your attempt. Please try again.";
        return;
      }

      verified = false;
      attemptCompleted = true;

      mysteryCard.classList.add("revealed");
      mysteryIcon.textContent = "🍀";
      mysteryTitle.textContent = "TRY AGAIN";
      mysteryDescription.textContent =
        "No food discovered this time.";

      render();

      statusElement.textContent =
        "Better luck next time! Return with a new bill for another chance.";

      return;
    }

    const levelIndex = getCurrentLevel(customer) - 1;

    const availableItems = COLLECTIONS[levelIndex].items.filter(
      item => !customer.collected.includes(item.id)
    );

    if (availableItems.length === 0) {
      return;
    }

    const randomIndex = Math.floor(
      Math.random() * availableItems.length
    );

    const item = availableItems[randomIndex];

    const updatedCustomer = {
      collected: [...customer.collected, item.id],
      history: [
        ...customer.history,
        {
          bill: currentBill,
          itemId: item.id,
          date: now
        }
      ]
    };

    const previousCustomer = customers[currentPhone];

    customers[currentPhone] = updatedCustomer;

    usedBills[currentBill] = {
      phone: currentPhone,
      result: "WIN",
      itemId: item.id,
      date: now
    };

    if (!saveData()) {
      delete usedBills[currentBill];

      if (previousCustomer === undefined) {
        delete customers[currentPhone];
      } else {
        customers[currentPhone] = previousCustomer;
      }

      statusElement.textContent =
        "Unable to save your discovery. Please try again.";

      return;
    }

    verified = false;
    attemptCompleted = true;

    mysteryCard.classList.add("revealed");
    mysteryIcon.textContent = item.icon;
    mysteryTitle.textContent = item.name;
    mysteryDescription.textContent =
      "+10 demo collection points · Food discovered!";

    const completedCollection = isCollectionComplete(
      levelIndex,
      updatedCustomer
    );

    render();

    if (isGameComplete(updatedCustomer)) {
      mysteryDescription.textContent =
        "+110 demo collection points · All collections completed!";

      statusElement.textContent =
        "Congratulations! You completed the entire menu.";
    } else if (completedCollection) {
      mysteryDescription.textContent =
        "+110 demo collection points · Collection completed!";

      statusElement.textContent =
        `Level ${getCurrentLevel(updatedCustomer)} unlocked!`;
    } else {
      statusElement.textContent =
        `${item.name} collected! Return with a new bill for your next chance.`;
    }
  }

  function goBackToVisit() {
    verified = false;
    attemptCompleted = false;
    currentBill = "";

    billInput.value = "";
    verificationStatus.textContent = "";

    resetMystery();
    render();
    showVisitStep();
  }

  visitForm.addEventListener("submit", verifyVisit);
  collectButton.addEventListener("click", discoverFood);

  render();
  showVisitStep();
})();
