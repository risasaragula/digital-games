
(function () {
  const STORAGE_PREFIX = "chefdesk_loyalty_customer_v1_";
  const POINTS_PER_WIN = 10;
  const DAILY_LIMIT = 100;

  const GAME_NAMES = {
    quiz: "Foodie Quiz",
    tictactoe: "Tic-Tac-Toe",
    pacman: "Pac-Man",
    sudoku: "Sudoku",
    foodmatch: "Food Match"
  };

  function getPhone() {
    const customer = window.ChefDesk?.getCustomer();

    if (!customer || !/^[6-9]\d{9}$/.test(customer.phone)) {
      return null;
    }

    return customer.phone;
  }

  function getStorageKey() {
    const phone = getPhone();
    return phone ? STORAGE_PREFIX + phone : null;
  }

  function getTodayKey() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
  }

  function emptyWallet() {
    return {
      totalPoints: 0,
      gamePoints: 0,
      history: []
    };
  }

  function getWallet() {
    const key = getStorageKey();

    if (!key) {
      return emptyWallet();
    }

    try {
      const saved = JSON.parse(
        localStorage.getItem(key) || "null"
      );

      if (
        saved &&
        Number.isFinite(saved.totalPoints) &&
        Number.isFinite(saved.gamePoints) &&
        Array.isArray(saved.history)
      ) {
        return saved;
      }
    } catch (error) {
      console.error("Unable to load loyalty wallet:", error);
    }

    return emptyWallet();
  }

  function saveWallet(wallet) {
    const key = getStorageKey();

    if (!key) {
      return false;
    }

    try {
      localStorage.setItem(key, JSON.stringify(wallet));
      return true;
    } catch (error) {
      console.error("Unable to save loyalty wallet:", error);
      return false;
    }
  }

  function getTodayPoints(wallet = getWallet()) {
    const today = getTodayKey();

    return wallet.history
      .filter(entry => entry.day === today)
      .reduce(
        (total, entry) => total + (entry.earnedPoints || 0),
        0
      );
  }

  function getRemainingPoints() {
    return Math.max(
      0,
      DAILY_LIMIT - getTodayPoints()
    );
  }

  function createWinId() {
    if (
      window.crypto &&
      typeof window.crypto.randomUUID === "function"
    ) {
      return window.crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function addPoints(gameId, winId, redeemable) {
    if (!getPhone()) {
      return {
        success: false,
        reason: "not_logged_in"
      };
    }

    if (
      !GAME_NAMES[gameId] ||
      typeof winId !== "string" ||
      !winId.trim()
    ) {
      return {
        success: false,
        reason: "invalid"
      };
    }

    const wallet = getWallet();
    const uniqueId = `${gameId}:${winId}`;

    const alreadyRecorded = wallet.history.some(
      entry => entry.id === uniqueId
    );

    if (alreadyRecorded) {
      return {
        success: false,
        reason: "duplicate"
      };
    }

    const remaining = Math.max(
      0,
      DAILY_LIMIT - getTodayPoints(wallet)
    );

    const earnedPoints = redeemable
      ? Math.min(POINTS_PER_WIN, remaining)
      : 0;

    wallet.gamePoints += POINTS_PER_WIN;
    wallet.totalPoints += earnedPoints;

    wallet.history.unshift({
      id: uniqueId,
      game: GAME_NAMES[gameId],
      gameId,
      gamePoints: POINTS_PER_WIN,
      earnedPoints,
      rewardType: redeemable ? "redeemable" : "game_only",
      day: getTodayKey(),
      timestamp: new Date().toISOString()
    });

    if (!saveWallet(wallet)) {
      return {
        success: false,
        reason: "storage"
      };
    }

    window.dispatchEvent(
      new Event("chefdesk:points-updated")
    );

    return {
      success: true,
      gamePoints: POINTS_PER_WIN,
      earnedPoints,
      totalPoints: wallet.totalPoints,
      remainingToday: Math.max(
        0,
        remaining - earnedPoints
      ),
      dailyLimitReached:
        getTodayPoints(wallet) >= DAILY_LIMIT
    };
  }

  function addWin(gameId, winId) {
    return addPoints(gameId, winId, true);
  }

  function addGamePoints(gameId, winId) {
    return addPoints(gameId, winId, false);
  }

  window.ChefDeskLoyalty = {
    getWallet,
    addWin,
    addGamePoints,
    createWinId,
    getTodayPoints,
    getRemainingPoints,
    DAILY_LIMIT,
    POINTS_PER_WIN
  };
})();
