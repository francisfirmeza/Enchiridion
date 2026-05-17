// history.js - Manages the workout history page, including fetching and displaying past workout sessions

let currentUser = null;
let allSessions = [];

(async () => {
  const {
    data: { session },
  } = await db.auth.getSession();
  if (!session) {
    window.location.href = "../index.html";
    return;
  }
  currentUser = session.user;

  await populateFilterPrograms();
  await loadHistory();
})();

document.getElementById("logout-btn").addEventListener("click", async () => {
  await db.auth.signOut();
  window.location.href = "../index.html";
});

async function populateFilterPrograms() {
  const { data: programs } = await db
    .from("programs")
    .select("id, name")
    .eq("user_id", currentUser.id);

  const sel = document.getElementById("history-program-filter");
  programs?.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name;
    sel.appendChild(opt);
  });
}

async function loadHistory(programId = "", exerciseName = "") {
  let query = db
    .from("workout_sessions")
    .select(
      `
      id, logged_at, notes,
      programs ( name ),
      program_days ( name ),
      workout_logs ( exercise_name, set_number, reps, weight, rpe )
    `,
    )
    .eq("user_id", currentUser.id)
    .order("logged_at", { ascending: false });

  if (programId) query = query.eq("program_id", programId);

  const { data: sessions } = await query;

  let filtered = sessions || [];
  if (exerciseName) {
    filtered = filtered.filter((s) =>
      s.workout_logs?.some((l) =>
        l.exercise_name?.toLowerCase().includes(exerciseName.toLowerCase()),
      ),
    );
  }

  allSessions = filtered;
  renderSessions(filtered);
}

function renderSessions(sessions) {
  const el = document.getElementById("sessions-list");
  if (!sessions || sessions.length === 0) {
    el.innerHTML = '<p class="muted">No sessions found.</p>';
    return;
  }

  el.innerHTML = sessions
    .map((s) => {
      const date = new Date(s.logged_at).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const progName = s.programs?.name || "Unknown";
      const dayName = s.program_days?.name || "";
      const logs = s.workout_logs || [];

      // Group logs by exercise
      const byExercise = {};
      logs.forEach((l) => {
        if (!byExercise[l.exercise_name]) byExercise[l.exercise_name] = [];
        byExercise[l.exercise_name].push(l);
      });

      const detailHTML = Object.entries(byExercise)
        .map(([name, sets]) => {
          const rows = sets
            .map(
              (set) =>
                `<tr>
          <td>Set ${set.set_number}</td>
          <td>${set.reps ?? "—"}</td>
          <td>${set.weight ? set.weight + " lbs" : "—"}</td>
          <td>${set.rpe || "—"}</td>
        </tr>`,
            )
            .join("");

          return `
        <div style="margin-bottom:1rem">
          <div style="font-weight:600;margin-bottom:0.4rem">${name}</div>
          <table class="log-table" style="font-size:0.8rem">
            <thead><tr><th>Set</th><th>Reps</th><th>Weight</th><th>RPE</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
      `;
        })
        .join("");

      const totalVolume = logs.reduce(
        (sum, l) => sum + (l.weight || 0) * (l.reps || 1),
        0,
      );

      return `
      <div class="session-card" onclick="this.querySelector('.session-detail').classList.toggle('open')">
        <div class="session-card-header">
          <div>
            <strong>${progName}</strong> · <span style="color:var(--text-muted)">${dayName}</span>
            ${s.notes ? `<span style="color:var(--text-muted);font-size:0.8rem"> · ${s.notes}</span>` : ""}
          </div>
          <div style="display:flex;align-items:center;gap:1rem">
            <span style="font-family:var(--font-mono);font-size:0.8rem;color:var(--accent)">${totalVolume.toLocaleString()} lbs total</span>
            <span class="session-date">${date}</span>
          </div>
        </div>
        <div class="session-detail">
          ${detailHTML || '<p class="muted">No exercise data recorded.</p>'}
        </div>
      </div>
    `;
    })
    .join("");
}

document
  .getElementById("apply-filter-btn")
  .addEventListener("click", async () => {
    const programId = document.getElementById("history-program-filter").value;
    const exerciseName = document
      .getElementById("history-exercise-filter")
      .value.trim();
    await loadHistory(programId, exerciseName);
  });
