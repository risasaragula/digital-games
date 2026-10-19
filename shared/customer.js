(function () {
  const CUSTOMER_KEY = "chefdesk_demo_customer";
  const REWARDS_KEY = "chefdesk_demo_rewards";
  function getCustomer() {
    try {
      return JSON.parse(
        localStorage.getItem(CUSTOMER_KEY) || "null"
      );
    } catch {
      return null;
    }
  }
  function login(phone) {
    const cleaned = String(phone).trim();
    if (!/^[6-9]\d{9}$/.test(cleaned)) {
      throw new Error(
        "Please enter a valid 10-digit mobile number."
      );
    }
    const customer = {
      phone: cleaned,
      displayPhone: "+91 ••••••" + cleaned.slice(-4)
    };
    localStorage.setItem(
      CUSTOMER_KEY,
      JSON.stringify(customer)
    );
    return customer;
  }
  function logout() {
    localStorage.removeItem(CUSTOMER_KEY);
  }
  function getRewards() {
    const customer = getCustomer();
    if (!customer) return [];
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
    if (!customer) {
      throw new Error("Please sign in first.");
    }
    const all = JSON.parse(
      localStorage.getItem(REWARDS_KEY) || "[]"
    );
    const existing = all.find(
      reward =>
        reward.phone === customer.phone &&
        reward.game === game &&
        reward.visitCode === visitCode
    );
    if (existing) return existing;
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
  function requireLogin() {
    const existing = getCustomer();
    if (existing) {
      return Promise.resolve(existing);
    }
    return new Promise(resolve => {
      const overlay = document.createElement("div");
      overlay.className = "cd-login-overlay";
      overlay.innerHTML = `
        <div class="cd-login-box">
          <div class="cd-login-icon">📱</div>
          <h2>Welcome to ChefDesk!</h2>
          <p>
            Enter your phone number once to
            connect your games and rewards.
          </p>
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
            <button type="submit">
              Continue →
            </button>
          </form>
          <p class="cd-login-error" id="cd-error"></p>
          <p class="cd-demo-note">
            Demo mode: no OTP verification yet.
          </p>
        </div>
      `;
      document.body.appendChild(overlay);
      overlay.querySelector("#cd-login-form")
        .addEventListener("submit", event => {
          event.preventDefault();
          const phone = overlay
            .querySelector("#cd-phone").value;
          try {
            const customer = login(phone);
            overlay.remove();
            resolve(customer);
          } catch (error) {
            overlay.querySelector("#cd-error")
              .textContent = error.message;
          }
        });
    });
  }
  window.ChefDesk = {
    getCustomer,
    login,
    logout,
    getRewards,
    addDemoReward,
    requireLogin
  };
})();