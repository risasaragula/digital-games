
(function () {
  "use strict";

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

  // ----------------------------------
  // FIREBASE AUTH
  // ----------------------------------

  function getAuthModules() {
    if (!authPromise) {
      authPromise = Promise.all([
        import("https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js"),
        import("https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js")
      ])
        .then(([appModule, authModule]) => {
          const app =
            appModule.getApps().find(
              item => item.name === "chefdesk-customer-auth"
            ) ||
            appModule.initializeApp(
              firebaseConfig,
              "chefdesk-customer-auth"
            );

          const auth = authModule.getAuth(app);

          return {
            auth,
            ...authModule
          };
        })
        .catch(error => {
          authPromise = null;
          throw error;
        });
    }

    return authPromise;
  }

  // ----------------------------------
  // CUSTOMER STORAGE
  // ----------------------------------

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
    const {
      auth,
      onAuthStateChanged
    } = await getAuthModules();

    const user = await new Promise(resolve => {
      let unsubscribe = () => {};

      unsubscribe = onAuthStateChanged(
        auth,
        currentUser => {
          resolve(currentUser);
        },
        error => {
          console.error("Firebase auth state error:", error);
          resolve(null);
        }
      );
    });

    if (!user || !user.phoneNumber) {
      localStorage.removeItem(CUSTOMER_KEY);
      return null;
    }

    return saveCustomer(user);
  }

  async function login() {
    throw new Error(
      "Phone login requires OTP. Use ChefDesk.requireLogin()."
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

  // ----------------------------------
  // DEMO REWARDS
  // ----------------------------------

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

  // ----------------------------------
  // LOGIN MODAL STYLES
  // ----------------------------------

  function injectLoginStyles() {
    if (document.getElementById("cd-login-styles")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "cd-login-styles";

    style.textContent = `
      .cd-login-overlay {
        position: fixed;
        inset: 0;
        z-index: 99999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 15px;
        background: rgba(10, 35, 25, 0.75);
        overflow-y: auto;
      }

      .cd-login-box {
        position: relative;
        width: 100%;
        max-width: 460px;
        max-height: calc(100dvh - 30px);
        overflow-y: auto;
        padding: 36px 30px;
        border-radius: 24px;
        background: #fffcf5;
        color: #214b38;
        text-align: center;
        box-shadow: 0 25px 70px rgba(0, 0, 0, 0.22);
        font-family: Arial, sans-serif;
      }

      .cd-login-close {
        position: absolute;
        top: 13px;
        right: 15px;
        width: 34px;
        height: 34px;
        border: 0;
        border-radius: 50%;
        background: #edf2e9;
        color: #214b38;
        font-size: 23px;
        cursor: pointer;
      }

      .cd-login-icon {
        margin-bottom: 14px;
        font-size: 38px;
      }

      .cd-login-box h2 {
        margin: 0 0 12px;
        color: #214b38;
        font-family: Georgia, serif;
        font-size: clamp(26px, 5vw, 34px);
      }

      .cd-login-description {
        margin-bottom: 24px;
        color: #718575;
        font-size: 14px;
        line-height: 1.7;
      }

      .cd-phone-field {
        display: flex;
        align-items: center;
        width: 100%;
        min-height: 54px;
        margin-bottom: 14px;
        overflow: hidden;
        border: 1px solid #d7e1d5;
        border-radius: 12px;
        background: white;
      }

      .cd-phone-prefix {
        flex-shrink: 0;
        padding: 0 12px;
        color: #214b38;
        font-size: 13px;
        font-weight: 700;
      }

      .cd-phone-field input {
        width: 100%;
        min-width: 0;
        height: 54px;
        padding: 0 14px;
        border: 0;
        outline: none;
        background: transparent;
        color: #214b38;
        font-size: 17px;
      }

      .cd-login-box button.cd-primary {
        width: 100%;
        min-height: 52px;
        padding: 12px;
        border: 0;
        border-radius: 12px;
        background: #214b38;
        color: white;
        font-size: 15px;
        font-weight: 700;
        cursor: pointer;
      }

      .cd-login-box button.cd-primary:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .cd-recaptcha-container {
        display: flex;
        justify-content: center;
        margin: 15px 0;
        min-height: 78px;
      }

      .cd-recaptcha-container[hidden] {
        display: none !important;
      }

      .cd-login-error {
        min-height: 20px;
        margin: 14px 0 0;
        color: #b74c39;
        font-size: 13px;
        line-height: 1.5;
        overflow-wrap: anywhere;
      }

      .cd-login-info {
        margin: 12px 0;
        color: #718575;
        font-size: 13px;
        line-height: 1.6;
      }

      .cd-demo-note {
        margin-top: 20px;
        color: #718575;
        font-size: 12px;
      }

      .cd-back-btn {
        display: block;
        margin: 14px auto 0;
        padding: 8px;
        border: 0;
        background: transparent;
        color: #214b38;
        font-size: 13px;
        font-weight: 700;
        cursor: pointer;
      }

      @media (max-width: 480px) {
        .cd-login-box {
          padding: 32px 18px;
          border-radius: 20px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  // ----------------------------------
  // OTP LOGIN
  // ----------------------------------

  async function showLogin() {
    const {
      auth,
      RecaptchaVerifier,
      signInWithPhoneNumber
    } = await getAuthModules();

    injectLoginStyles();

    return new Promise(resolve => {
      const overlay = document.createElement("div");
      overlay.className = "cd-login-overlay";

      overlay.innerHTML = `
        <div
          class="cd-login-box"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cd-login-title"
        >
          <button
            type="button"
            class="cd-login-close"
            id="cd-close"
            aria-label="Close login"
          >×</button>

          <div class="cd-login-icon">📱</div>

          <h2 id="cd-login-title">
            Welcome to ChefDesk!
          </h2>

          <p class="cd-login-description">
            Verify your phone number to access your
            games and rewards.
          </p>

          <form id="cd-login-form">
            <div class="cd-phone-field">
              <span class="cd-phone-prefix">🇮🇳 +91</span>

              <input
                type="tel"
                id="cd-phone"
                inputmode="numeric"
                maxlength="10"
                autocomplete="tel-national"
                placeholder="10-digit mobile number"
                required
              >
            </div>

            <button
              type="submit"
              class="cd-primary"
              id="cd-send-btn"
            >
              Send OTP →
            </button>
          </form>

          <div
            class="cd-recaptcha-container"
            id="cd-recaptcha-container"
          >
            <div id="cd-recaptcha"></div>
          </div>

          <form id="cd-otp-form" hidden>
            <p class="cd-login-info">
              Enter the 6-digit verification code.
            </p>

            <div class="cd-phone-field">
              <input
                type="text"
                id="cd-otp"
                inputmode="numeric"
                maxlength="6"
                autocomplete="one-time-code"
                placeholder="6-digit OTP"
                required
              >
            </div>

            <button
              type="submit"
              class="cd-primary"
              id="cd-verify-btn"
            >
              Verify OTP →
            </button>

            <button
              type="button"
              class="cd-back-btn"
              id="cd-back-btn"
            >
              ← Change phone number
            </button>
          </form>

          <p
            class="cd-login-error"
            id="cd-error"
            role="alert"
          ></p>

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
      const phoneInput = overlay.querySelector("#cd-phone");
      const otpInput = overlay.querySelector("#cd-otp");
      const recaptchaContainer = overlay.querySelector(
        "#cd-recaptcha-container"
      );

      let confirmationResult = null;
      let verifier = null;
      let closed = false;

      function cleanup() {
        if (closed) return;

        closed = true;

        if (verifier) {
          try {
            verifier.clear();
          } catch (error) {
            console.warn("reCAPTCHA cleanup:", error);
          }

          verifier = null;
        }

        overlay.remove();
      }

      function finish(customer) {
        cleanup();
        resolve(customer);
      }

      function showError(message) {
        errorBox.textContent = message;
      }

      async function setupRecaptcha() {
        const target = overlay.querySelector("#cd-recaptcha");
        target.replaceChildren();

        verifier = new RecaptchaVerifier(
          auth,
          target,
          {
            size: "normal"
          }
        );

        await verifier.render();
      }

      function showPhoneStep() {
        confirmationResult = null;

        phoneForm.hidden = false;
        otpForm.hidden = true;
        recaptchaContainer.hidden = false;

        sendButton.disabled = false;
        verifyButton.disabled = false;

        otpInput.value = "";
        showError("");
      }

      function showOtpStep() {
        phoneForm.hidden = true;
        otpForm.hidden = false;

        // The OTP has already been requested.
        // Hide reCAPTCHA while the user enters the code.
        recaptchaContainer.hidden = true;

        showError("");
        otpInput.focus();
      }

      document
        .getElementById("cd-close")
        .addEventListener("click", () => {
          finish(null);
        });

      overlay
        .querySelector("#cd-back-btn")
        .addEventListener("click", async () => {
          showPhoneStep();

          if (verifier) {
            try {
              verifier.clear();
            } catch (error) {
              console.warn(error);
            }

            verifier = null;
          }

          try {
            await setupRecaptcha();
          } catch (error) {
            console.error(error);
            showError("Unable to reload reCAPTCHA. Refresh the page.");
          }
        });

      phoneForm.addEventListener("submit", async event => {
        event.preventDefault();

        const phone = phoneInput.value.trim();

        if (!/^[6-9]\d{9}$/.test(phone)) {
          showError("Enter a valid 10-digit Indian mobile number.");
          return;
        }

        sendButton.disabled = true;
        showError("");

        try {
          if (!verifier) {
            await setupRecaptcha();
          }

          confirmationResult = await signInWithPhoneNumber(
            auth,
            "+91" + phone,
            verifier
          );

          if (closed) return;

          showOtpStep();
        } catch (error) {
          console.error("Firebase OTP send error:", error);

          if (closed) return;

          showError(
            error.code === "auth/billing-not-enabled"
              ? "Real SMS requires Firebase billing. Use your configured Firebase test number."
              : error.message || "Unable to send OTP."
          );

          sendButton.disabled = false;
        }
      });

      otpForm.addEventListener("submit", async event => {
        event.preventDefault();

        if (!confirmationResult) {
          showError("Please request an OTP first.");
          return;
        }

        const otp = otpInput.value.trim();

        if (!/^\d{6}$/.test(otp)) {
          showError("Enter a valid 6-digit verification code.");
          return;
        }

        verifyButton.disabled = true;
        showError("");

        try {
          const result = await confirmationResult.confirm(otp);

          if (closed) return;

          const customer = saveCustomer(result.user);

          if (!customer) {
            throw new Error(
              "Unable to create your customer profile."
            );
          }

          window.dispatchEvent(
            new Event("chefdesk:customer-updated")
          );

          finish(customer);
        } catch (error) {
          console.error("Firebase OTP verification error:", error);

          if (closed) return;

          showError(
            error.code === "auth/invalid-verification-code"
              ? "Incorrect OTP. Please check the code and try again."
              : error.message || "OTP verification failed."
          );

          verifyButton.disabled = false;
        }
      });

      setupRecaptcha().catch(error => {
        console.error("reCAPTCHA initialization error:", error);
        showError(
          "Unable to load reCAPTCHA. Check localhost and refresh."
        );
      });
    });
  }

  // ----------------------------------
  // PUBLIC LOGIN API
  // ----------------------------------

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
