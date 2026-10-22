
(function () {
  const CUSTOMER_KEY = "chefdesk_demo_customer";
  const REWARDS_KEY = "chefdesk_demo_rewards";

  const firebaseConfig = {
    apiKey: "AIzaSyDbEtb9S2Mnqx02EQl2rwhonE1kg8XbmIw",
    authDomain: "chefdesk-games.firebaseapp.com",
    databaseURL: "https://chefdesk-games-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "chefdesk-games",
    storageBucket: "chefdesk-games.firebasestorage.app",
    messagingSenderId: "171693424148",
    appId: "1:171693424148:web:daa340e425a9a692e97101",
    measurementId: "G-GPGVNQCB4T"
  };

  let authPromise = null;
  let loginPromise = null;

  function getAuthModules() {
    if (!authPromise) {
      authPromise = Promise.all([
        import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js")
      ]).then(([appModule, authModule]) => {
        const app = appModule.getApps().find(
          item => item.name === "chefdesk-customer-auth"
        ) || appModule.initializeApp(
          firebaseConfig,
          "chefdesk-customer-auth"
        );

        const auth = authModule.getAuth(app);

        return {
          auth,
          ...authModule
        };
      }).catch(error => {
        authPromise = null;
        throw error;
      });
    }

    return authPromise;
  }

  function getCustomer() {
    try {
      return JSON.parse(
        localStorage.getItem(CUSTOMER_KEY) || "null"
      );
    } catch {
      return null;
    }
  }

  function saveCustomer(user) {
    if (!user || !user.phoneNumber) {
      return null;
    }

    const phone = user.phoneNumber.replace(/^\+91/, "");

    if (!/^[6-9]\d{9}$/.test(phone)) {
      return null;
    }

    const customer = {
      uid: user.uid,
      phone,
      displayPhone: "+91 ••••••" + phone.slice(-4),
      verified: true
    };

    localStorage.setItem(
      CUSTOMER_KEY,
      JSON.stringify(customer)
    );

    return customer;
  }

  async function getVerifiedCustomer() {
    const { auth, onAuthStateChanged } = await getAuthModules();

    const user = await new Promise(resolve => {
      const unsubscribe = onAuthStateChanged(
        auth,
        currentUser => {
          unsubscribe();
          resolve(currentUser);
        },
        () => {
          unsubscribe();
          resolve(null);
        }
      );
    });

    if (!user || !user.phoneNumber) {
      return null;
    }

    return saveCustomer(user);
  }

  async function login(phone) {
    throw new Error(
      "Phone login now requires OTP verification. Use ChefDesk.requireLogin()."
    );
  }

  async function logout() {
    const { auth, signOut } = await getAuthModules();

    await signOut(auth);
    localStorage.removeItem(CUSTOMER_KEY);

    window.dispatchEvent(
      new Event("chefdesk:customer-updated")
    );
  }

  function getRewards() {
    const customer = getCustomer();

    if (!customer || !customer.verified) {
      return [];
    }

    try {
      const all = JSON.parse(
        localStorage.getItem(REWARDS_KEY) || "[]"
      );

      return all.filter(
        reward => reward.phone === customer.phone
      );
    } catch {
      return [];
    }
  }

  function addDemoReward(game, prize, visitCode) {
    const customer = getCustomer();

    if (!customer || !customer.verified) {
      throw new Error("Please verify your phone first.");
    }

    let all = [];

    try {
      all = JSON.parse(
        localStorage.getItem(REWARDS_KEY) || "[]"
      );
    } catch {
      all = [];
    }

    const existing = all.find(
      reward =>
        reward.phone === customer.phone &&
        reward.game === game &&
        reward.visitCode === visitCode
    );

    if (existing) {
      return existing;
    }

    const reward = {
      id: "DEMO-" + Date.now(),
      phone: customer.phone,
      game,
      prize,
      visitCode,
      status: "Demo only",
      createdAt: new Date().toISOString()
    };

    all.push(reward);

    localStorage.setItem(
      REWARDS_KEY,
      JSON.stringify(all)
    );

    return reward;
  }

  async function showLogin() {
    const {
      auth,
      RecaptchaVerifier,
      signInWithPhoneNumber
    } = await getAuthModules();

    return new Promise(resolve => {
      const overlay = document.createElement("div");
      overlay.className = "cd-login-overlay";

      overlay.innerHTML = `
        <div class="cd-login-box">
          <div class="cd-login-icon">📱</div>
          <h2>Welcome to ChefDesk!</h2>
          <p>Verify your phone number to access your games and rewards.</p>

          <form id="cd-login-form">
            <div class="cd-phone-field">
              <span>🇮🇳 +91</span>
              <input
                type="tel"
                id="cd-phone"
                inputmode="numeric"
                maxlength="10"
                autocomplete="tel-national"
                placeholder="10-digit number"
                required
              >
            </div>
            <button type="submit" id="cd-send-btn">
              Send OTP →
            </button>
          </form>

          <div id="cd-recaptcha"></div>

          <form id="cd-otp-form" style="display:none">
            <div class="cd-phone-field">
              <input
                type="text"
                id="cd-otp"
                inputmode="numeric"
                maxlength="6"
                placeholder="6-digit OTP"
                required
              >
            </div>
            <button type="submit" id="cd-verify-btn">
              Verify OTP →
            </button>
          </form>

          <p class="cd-login-error" id="cd-error"></p>
          <p class="cd-demo-note">
            Phone verification powered by Firebase.
          </p>
        </div>
      `;

      document.body.appendChild(overlay);

      const phoneForm = overlay.querySelector("#cd-login-form");
      const otpForm = overlay.querySelector("#cd-otp-form");
      const errorBox = overlay.querySelector("#cd-error");
      const sendButton = overlay.querySelector("#cd-send-btn");
      const verifyButton = overlay.querySelector("#cd-verify-btn");

      let confirmationResult = null;

      const verifier = new RecaptchaVerifier(
        auth,
        "cd-recaptcha",
        { size: "normal" }
      );

      phoneForm.addEventListener("submit", async event => {
        event.preventDefault();

        const phone = overlay.querySelector("#cd-phone").value.trim();

        if (!/^[6-9]\d{9}$/.test(phone)) {
          errorBox.textContent = "Enter a valid 10-digit phone number.";
          return;
        }

        sendButton.disabled = true;
        errorBox.textContent = "";

        try {
          confirmationResult = await signInWithPhoneNumber(
            auth,
            "+91" + phone,
            verifier
          );

          phoneForm.style.display = "none";
          otpForm.style.display = "block";
          errorBox.textContent = "Enter your verification code.";
        } catch (error) {
          console.error(error);
          errorBox.textContent = error.message;
          sendButton.disabled = false;
        }
      });

      otpForm.addEventListener("submit", async event => {
        event.preventDefault();

        if (!confirmationResult) {
          return;
        }

        verifyButton.disabled = true;
        errorBox.textContent = "";

        try {
          const result = await confirmationResult.confirm(
            overlay.querySelector("#cd-otp").value.trim()
          );

          const customer = saveCustomer(result.user);

          if (!customer) {
            throw new Error("Unable to create customer profile.");
          }

          overlay.remove();

          window.dispatchEvent(
            new Event("chefdesk:customer-updated")
          );

          resolve(customer);
        } catch (error) {
          console.error(error);
          errorBox.textContent = error.message;
          verifyButton.disabled = false;
        }
      });
    });
  }

  async function requireLogin() {
    if (loginPromise) {
      return loginPromise;
    }

    loginPromise = (async () => {
      const verified = await getVerifiedCustomer();

      if (verified) {
        return verified;
      }

      localStorage.removeItem(CUSTOMER_KEY);

      return showLogin();
    })();

    try {
      return await loginPromise;
    } finally {
      loginPromise = null;
    }
  }

  window.ChefDesk = {
    getCustomer,
    getVerifiedCustomer,
    login,
    logout,
    getRewards,
    addDemoReward,
    requireLogin
  };
})();