// dashboard.js - Handles dashboard UI/interactions for program overview and quick access

let currentUser = null;

(async () => {
  const {
    data: { session },
  } = await db.auth.getSession();
  if (!session) {
    window.location.href = "../index.html";
    return;
  }
  currentUser = session.user;

  document.getElementById("today-date").textContent =
    new Date().toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  await loadDashboard();
})();

document.getElementById("logout-btn").addEventListener("click", async () => {
  await db.auth.signOut();
  window.location.href = "../index.html";
});

async function loadDashboard() {
  // Active program
  const { data: program } = await db
    .from("programs")
    .select("*")
    .eq("user_id", currentUser.id)
    .eq("is_active", true)
    .single();

  if (program) {
    document.getElementById("active-program-name").textContent = program.name;
    document.getElementById("active-program-desc").textContent =
      program.description || `Scheme: ${program.progression_scheme}`;
  }

  // Session count
  const { data: sessions } = await db
    .from("workout_sessions")
    .select("id")
    .eq("user_id", currentUser.id);
  document.getElementById("stat-sessions").textContent = sessions?.length ?? 0;

  // Single query for all log data (fixes the previous duplicate fetch)
  const { data: logs } = await db
    .from("workout_logs")
    .select("exercise_name, weight, sets, reps, logged_at")
    .eq("user_id", currentUser.id);

  if (!logs || logs.length === 0) return;

  // Total volume: each row is one set, so volume = weight × reps per row
  let totalVolume = 0;
  const exerciseSet = new Set();
  const prMap = {};

  logs.forEach((l) => {
    totalVolume += (l.weight || 0) * (l.sets || 1) * (l.reps || 1);
    if (l.exercise_name) exerciseSet.add(l.exercise_name);
    if (l.weight && (!prMap[l.exercise_name] || l.weight > prMap[l.exercise_name])) {
      prMap[l.exercise_name] = l.weight;
    }
  });

  document.getElementById("stat-volume").textContent =
    Math.round(totalVolume).toLocaleString();
  document.getElementById("stat-exercises").textContent = exerciseSet.size;

  // PRs
  const prEl = document.getElementById("recent-prs");
  const prEntries = Object.entries(prMap).slice(0, 5);
  if (prEntries.length === 0) {
    prEl.innerHTML = '<p class="muted">Log some workouts to see your PRs.</p>';
  } else {
    prEl.innerHTML = prEntries
      .map(
        ([name, weight]) =>
          `<div style="display:flex;justify-content:space-between;padding:0.4rem 0;border-bottom:1px solid var(--border)">
          <span>${name}</span>
          <span style="font-family:var(--font-mono);color:var(--accent)">${weight} lbs</span>
        </div>`,
      )
      .join("");
  }

  renderVolumeChart(logs);
}

// ── Weekly Volume Chart ──────────────────────────────────────

function renderVolumeChart(logs) {
  // Group volume by the Monday of each week as the key
  const weekMap = {};
  logs.forEach((l) => {
    if (!l.logged_at || !l.weight || !l.reps) return;
    const date = new Date(l.logged_at);
    const dow = date.getDay();
    const monday = new Date(date);
    monday.setDate(date.getDate() - (dow === 0 ? 6 : dow - 1));
    const key = monday.toISOString().split("T")[0];
    weekMap[key] = (weekMap[key] || 0) + l.weight * (l.sets || 1) * l.reps;
  });

  const sorted = Object.entries(weekMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-8);

  if (sorted.length === 0) return;

  document.getElementById("volume-chart-section").style.display = "";

  const labels = sorted.map(([date]) => {
    const d = new Date(date + "T00:00:00"); // avoid UTC offset shifting the date
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  });
  const data = sorted.map(([, vol]) => Math.round(vol));

  new Chart(document.getElementById("volume-chart"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Volume (lbs)",
          data,
          backgroundColor: "rgba(212,168,67,0.35)",
          borderColor: "#d4a843",
          borderWidth: 1,
          borderRadius: 2,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${ctx.parsed.y.toLocaleString()} lbs`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: "#7a7570", font: { family: "DM Mono", size: 11 } },
          grid: { color: "#2e2e2e" },
        },
        y: {
          beginAtZero: true,
          ticks: {
            color: "#7a7570",
            font: { family: "DM Mono", size: 11 },
            callback: (v) => v.toLocaleString(),
          },
          grid: { color: "#2e2e2e" },
        },
      },
    },
  });
}
