
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

  const firebaseConfig = {
    apiKey: "AIzaSyDbEtb9S2Mnqx02EQl2rwhonE1kg8XbmIw",
    authDomain: "chefdesk-games.firebaseapp.com",
    databaseURL: "https://chefdesk-games-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "chefdesk-games",
    storageBucket: "chefdesk-games.firebasestorage.app",
    messagingSenderId: "171693424148",
    appId: "1:171693424148:web:daa340e425a9a692e97101"
  };

  let firebasePromise = null;
  let unsubscribe = null;
  let connectedUid = null;
  let cloudWallet = null;
  let cloudReady = false;
  let cloudError = "";
  let connectionVersion = 0;
  let connectingPromise = null;

  function notify() {
    window.dispatchEvent(
      new Event("chefdesk:points-updated")
    );
  }

  function getCustomer() {
    return window.ChefDesk?.getCustomer() || null;
  }

  function getPhone() {
    const customer = getCustomer();

    return customer && /^[6-9]\d{9}$/.test(customer.phone)
      ? customer.phone
      : null;
  }

  function getStorageKey() {
    const phone = getPhone();

    return phone ? STORAGE_PREFIX + phone : null;
  }

  function getTodayKey() {
    const date = new Date();

    return [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0")
    ].join("-");
  }

  function emptyWallet() {
    return {
      totalPoints: 0,
      gamePoints: 0,
      history: []
    };
  }

  function getLocalWallet() {
    const key = getStorageKey();

    if (!key) return emptyWallet();

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
      console.error("Local wallet error:", error);
    }

    return emptyWallet();
  }

  function saveLocalWallet(wallet) {
    const key = getStorageKey();

    if (!key) return false;

    try {
      localStorage.setItem(key, JSON.stringify(wallet));
      return true;
    } catch (error) {
      console.error("Wallet save error:", error);
      return false;
    }
  }

  function getWallet() {
    const local = getLocalWallet();

    if (!cloudReady || !cloudWallet) {
      return local;
    }

    return {
      totalPoints: local.totalPoints,
      gamePoints: cloudWallet.gamePoints,
      history: local.history
    };
  }

  function getTodayPoints(wallet = getLocalWallet()) {
    const today = getTodayKey();

    return wallet.history
      .filter(entry => entry.day === today)
      .reduce(
        (sum, entry) => sum + (Number(entry.earnedPoints) || 0),
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
    if (window.crypto?.randomUUID) {
      return window.crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  async function getFirebase() {
    if (!firebasePromise) {
      firebasePromise = Promise.all([
        import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js"),
        import("https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js")
      ]).then(([appModule, authModule, firestore]) => {
        const app = appModule.getApps().find(
          item => item.name === "chefdesk-customer-auth"
        ) || appModule.initializeApp(
          firebaseConfig,
          "chefdesk-customer-auth"
        );

        return {
          auth: authModule.getAuth(app),
          firestore,
          db: firestore.getFirestore(app)
        };
      }).catch(error => {
        firebasePromise = null;
        throw error;
      });
    }

    return firebasePromise;
  }

  function disconnectWallet() {
    connectionVersion += 1;

    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }

    connectedUid = null;
    cloudWallet = null;
    cloudReady = false;
    cloudError = "";
    connectingPromise = null;

    notify();
  }

  async function getAuthenticatedUser() {
    const { auth } = await getFirebase();

    await auth.authStateReady();

    const user = auth.currentUser;

    if (!user || !user.phoneNumber) {
      return null;
    }

    return user;
  }

  async function connectWallet() {
    if (connectingPromise) {
      return connectingPromise;
    }

    const operation = async () => {
      const user = await getAuthenticatedUser();

      if (!user) {
        disconnectWallet();
        return false;
      }

      if (
        connectedUid === user.uid &&
        unsubscribe &&
        cloudReady
      ) {
        return true;
      }

      if (
        connectedUid === user.uid &&
        unsubscribe &&
        !cloudError
      ) {
        return true;
      }

      disconnectWallet();

      const version = connectionVersion;
      connectedUid = user.uid;
      cloudError = "";

      const { db, firestore } = await getFirebase();

      const winsRef = firestore.collection(
        db,
        "demoWallets",
        user.uid,
        "wins"
      );

      return new Promise(resolve => {
        let settled = false;

        function finish(value) {
          if (!settled) {
            settled = true;
            resolve(value);
          }
        }

        unsubscribe = firestore.onSnapshot(
          winsRef,
          snapshot => {
            if (version !== connectionVersion) {
              finish(false);
              return;
            }

            const wins = snapshot.docs.map(item => ({
              id: item.id,
              ...item.data()
            }));

            cloudWallet = {
              gamePoints: wins.reduce(
                (sum, win) =>
                  sum + (Number(win.gamePoints) || 0),
                0
              ),
              wins
            };

            cloudReady = true;
            cloudError = "";

            notify();
            finish(true);
          },
          error => {
            if (version !== connectionVersion) {
              finish(false);
              return;
            }

            console.error("Firestore wallet error:", error);

            cloudReady = false;
            cloudError = error.code || error.message;
            notify();
            finish(false);
          }
        );
      });
    };

    connectingPromise = operation();

    try {
      return await connectingPromise;
    } finally {
      connectingPromise = null;
    }
  }

  function getSyncStatus() {
    return {
      connected: cloudReady,
      uid: connectedUid,
      error: cloudError,
      cloudGamePoints: cloudWallet?.gamePoints ?? null
    };
  }

  async function recordCloudGameWin(gameId, winId) {
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

    try {
      const user = await getAuthenticatedUser();

      if (!user) {
        return {
          success: false,
          reason: "not_logged_in"
        };
      }

      const { db, firestore } = await getFirebase();

      const uniqueId = `${gameId}:${winId}`;
      const documentId = encodeURIComponent(uniqueId);

      if (documentId.length > 300) {
        return {
          success: false,
          reason: "invalid"
        };
      }

      const winRef = firestore.doc(
        db,
        "demoWallets",
        user.uid,
        "wins",
        documentId
      );

      const existing = await firestore.getDocFromServer(winRef);

      if (existing.exists()) {
        return {
          success: false,
          reason: "duplicate"
        };
      }

      await firestore.setDoc(winRef, {
        gameId,
        game: GAME_NAMES[gameId],
        gamePoints: POINTS_PER_WIN,
        earnedPoints: 0,
        rewardType: "game_only",
        day: getTodayKey(),
        timestamp: firestore.serverTimestamp()
      });

      return {
        success: true,
        gamePoints: POINTS_PER_WIN,
        earnedPoints: 0
      };
    } catch (error) {
      if (error.code === "permission-denied") {
        return {
          success: false,
          reason: "duplicate_or_permission_denied"
        };
      }

      console.error("Cloud win error:", error);

      return {
        success: false,
        reason: error.code || "cloud_error"
      };
    }
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

    const wallet = getLocalWallet();
    const uniqueId = `${gameId}:${winId}`;

    if (wallet.history.some(entry => entry.id === uniqueId)) {
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

    if (!saveLocalWallet(wallet)) {
      return {
        success: false,
        reason: "storage"
      };
    }

    recordCloudGameWin(gameId, winId).then(result => {
      if (!result.success) {
        console.warn(
          "Cloud game points were not recorded:",
          result.reason
        );
      }
    });

    notify();

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

  window.addEventListener(
    "chefdesk:customer-updated",
    disconnectWallet
  );

  window.ChefDeskLoyalty = {
    getWallet,
    getLocalWallet,
    addWin,
    addGamePoints,
    recordCloudGameWin,
    connectWallet,
    disconnectWallet,
    getSyncStatus,
    createWinId,
    getTodayPoints,
    getRemainingPoints,
    DAILY_LIMIT,
    POINTS_PER_WIN
  };
})();
