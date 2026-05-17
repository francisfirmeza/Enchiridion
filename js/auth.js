// auth.js - Handles user authentication (login/register) and session management

(async () => {
  // If already logged in, redirect to dashboard
  const {
    data: { session },
  } = await db.auth.getSession();
  if (session) window.location.href = "pages/dashboard.html";
})();

// Tab switching
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".tab-btn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    document
      .querySelectorAll(".auth-form")
      .forEach((f) => f.classList.add("hidden"));
    document
      .getElementById(`${btn.dataset.tab}-form`)
      .classList.remove("hidden");
  });
});

// Login
document.getElementById("login-btn").addEventListener("click", async () => {
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;
  const errEl = document.getElementById("login-error");

  if (!email || !password) {
    errEl.textContent = "Please fill in all fields.";
    return;
  }

  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) {
    errEl.textContent = error.message;
    return;
  }
  window.location.href = "pages/dashboard.html";
});

// Register
document.getElementById("register-btn").addEventListener("click", async () => {
  const email = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-password").value;
  const errEl = document.getElementById("reg-error");

  if (!email || !password) {
    errEl.textContent = "Please fill in all fields.";
    return;
  }
  if (password.length < 6) {
    errEl.textContent = "Password must be at least 6 characters.";
    return;
  }

  const { error } = await db.auth.signUp({ email, password });
  if (error) {
    errEl.textContent = error.message;
    return;
  }
  errEl.style.color = "var(--accent3)";
  errEl.textContent =
    "Account created! Check your email to confirm, then sign in.";
});
