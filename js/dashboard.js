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
  // Load active program
  const { data: programs } = await db
    .from("programs")
    .select("*")
    .eq("user_id", currentUser.id)
    .eq("is_active", true)
    .single();

  if (programs) {
    document.getElementById("active-program-name").textContent = programs.name;
    document.getElementById("active-program-desc").textContent =
      programs.description || `Scheme: ${programs.progression_scheme}`;
  }

  // Load session stats
  const { data: sessions } = await db
    .from("workout_sessions")
    .select("id")
    .eq("user_id", currentUser.id);

  document.getElementById("stat-sessions").textContent = sessions?.length ?? 0;

  // Load total volume
  const { data: logs } = await db
    .from("workout_logs")
    .select("weight, sets, reps")
    .eq("user_id", currentUser.id);

  let totalVolume = 0;
  let exerciseSet = new Set();
  logs?.forEach((l) => {
    totalVolume += (l.weight || 0) * (l.sets || 1) * (l.reps || 1);
  });

  const { data: exLogs } = await db
    .from("workout_logs")
    .select("exercise_name")
    .eq("user_id", currentUser.id);
  exLogs?.forEach((l) => exerciseSet.add(l.exercise_name));

  document.getElementById("stat-volume").textContent =
    totalVolume.toLocaleString();
  document.getElementById("stat-exercises").textContent = exerciseSet.size;

  // Recent PRs (max weight per exercise)
  const prs = {};
  logs?.forEach((l) => {
    if (!prs[l.exercise_name] || l.weight > prs[l.exercise_name]) {
      prs[l.exercise_name] = l.weight;
    }
  });
  const { data: allLogs } = await db
    .from("workout_logs")
    .select("exercise_name, weight")
    .eq("user_id", currentUser.id);

  const prMap = {};
  allLogs?.forEach((l) => {
    if (!prMap[l.exercise_name] || l.weight > prMap[l.exercise_name])
      prMap[l.exercise_name] = l.weight;
  });

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
}
