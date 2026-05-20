// history.js - Manages the workout history page, including fetching and displaying past workout sessions

let currentUser = null;
let allSessions = [];
let progressionChartInstance = null;

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
      workout_logs ( id, exercise_name, set_number, reps, weight, rpe )
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

  if (exerciseName && filtered.length > 1) {
    renderProgressionChart(filtered, exerciseName);
  } else {
    hideProgressionChart();
  }
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
                `<tr data-log-id="${set.id}">
            <td>Set ${set.set_number}</td>
            <td data-field="reps">${set.reps ?? "—"}</td>
            <td data-field="weight">${set.weight != null ? set.weight + " lbs" : "—"}</td>
            <td data-field="rpe">${set.rpe ?? "—"}</td>
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

      const escapedNotes = (s.notes || "").replace(/"/g, "&quot;");

      return `
        <div class="session-card" data-session-id="${s.id}" onclick="this.querySelector('.session-detail').classList.toggle('open')">
          <div class="session-card-header">
            <div>
              <strong>${progName}</strong> · <span style="color:var(--text-muted)">${dayName}</span>
              <span class="session-notes-display" style="color:var(--text-muted);font-size:0.8rem">${s.notes ? " · " + s.notes : ""}</span>
            </div>
            <div style="display:flex;align-items:center;gap:0.75rem">
              <span style="font-family:var(--font-mono);font-size:0.8rem;color:var(--accent)">${Math.round(totalVolume).toLocaleString()} lbs total</span>
              <span class="session-date">${date}</span>
              <button class="btn-secondary small edit-btn" onclick="enterEditMode('${s.id}', event)">Edit</button>
              <button class="btn-primary small save-btn hidden" onclick="saveEdits('${s.id}', event)">Save</button>
              <button class="btn-secondary small cancel-btn hidden" onclick="cancelEdits('${s.id}', event)">Cancel</button>
            </div>
          </div>
          <div class="session-detail">
            ${detailHTML || '<p class="muted">No exercise data recorded.</p>'}
            <div class="edit-notes-row hidden" style="margin-top:0.75rem">
              <label style="font-size:0.75rem;color:var(--text-muted);display:block;margin-bottom:0.3rem">Session Notes</label>
              <input type="text" class="edit-notes-input" value="${escapedNotes}"
                style="width:100%;padding:0.4rem 0.6rem;background:var(--surface2);border:1px solid var(--border);border-radius:4px;color:var(--text);font-size:0.85rem;font-family:var(--font-sans)">
            </div>
          </div>
        </div>
      `;
    })
    .join("");
}

// ── Exercise Progression Chart ───────────────────────────────
// For each session, finds the best estimated 1RM for the filtered
// exercise using the Epley formula: w × (1 + r/30).

function renderProgressionChart(sessions, exerciseName) {
  const points = [];

  // Sessions arrive newest-first; reverse so chart reads left → right
  [...sessions].reverse().forEach((s) => {
    const relevantLogs = (s.workout_logs || []).filter((l) =>
      l.exercise_name?.toLowerCase().includes(exerciseName.toLowerCase()),
    );
    if (relevantLogs.length === 0) return;

    let bestEst1RM = 0;
    let bestWeight = 0;
    relevantLogs.forEach((l) => {
      if (!l.weight || !l.reps) return;
      const est1RM = l.weight * (1 + l.reps / 30);
      if (est1RM > bestEst1RM) {
        bestEst1RM = est1RM;
        bestWeight = l.weight;
      }
    });

    if (bestEst1RM > 0) {
      points.push({
        date: s.logged_at,
        est1RM: Math.round(bestEst1RM * 10) / 10,
        maxWeight: bestWeight,
      });
    }
  });

  if (points.length < 2) {
    hideProgressionChart();
    return;
  }

  const chartSection = document.getElementById("progression-chart-section");
  chartSection.classList.remove("hidden");
  document.getElementById("progression-chart-label").textContent =
    `${exerciseName.toUpperCase()} — PROGRESSION`;

  const labels = points.map((p) =>
    new Date(p.date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
  );

  if (progressionChartInstance) progressionChartInstance.destroy();

  progressionChartInstance = new Chart(
    document.getElementById("progression-chart"),
    {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Est. 1RM (Epley)",
            data: points.map((p) => p.est1RM),
            borderColor: "#d4a843",
            backgroundColor: "rgba(212,168,67,0.08)",
            tension: 0.3,
            pointRadius: 5,
            pointBackgroundColor: "#d4a843",
            fill: true,
          },
          {
            label: "Top Weight",
            data: points.map((p) => p.maxWeight),
            borderColor: "#27ae60",
            backgroundColor: "transparent",
            tension: 0.3,
            pointRadius: 4,
            pointBackgroundColor: "#27ae60",
            borderDash: [5, 4],
          },
        ],
      },
      options: {
        responsive: true,
        interaction: { mode: "index", intersect: false },
        plugins: {
          legend: {
            labels: {
              color: "#7a7570",
              font: { family: "DM Mono", size: 11 },
              boxWidth: 12,
            },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.dataset.label}: ${ctx.parsed.y} lbs`,
            },
          },
        },
        scales: {
          x: {
            ticks: { color: "#7a7570", font: { family: "DM Mono", size: 11 } },
            grid: { color: "#2e2e2e" },
          },
          y: {
            ticks: {
              color: "#7a7570",
              font: { family: "DM Mono", size: 11 },
              callback: (v) => v + " lbs",
            },
            grid: { color: "#2e2e2e" },
          },
        },
      },
    },
  );
}

function hideProgressionChart() {
  document.getElementById("progression-chart-section").classList.add("hidden");
  if (progressionChartInstance) {
    progressionChartInstance.destroy();
    progressionChartInstance = null;
  }
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

// ── Inline Edit ──────────────────────────────────────────────

function enterEditMode(sessionId, evt) {
  evt.stopPropagation();
  const card = document.querySelector(`[data-session-id="${sessionId}"]`);

  card.querySelector(".session-detail").classList.add("open");

  card.querySelectorAll("tr[data-log-id]").forEach((row) => {
    ["reps", "weight", "rpe"].forEach((field) => {
      const cell = row.querySelector(`[data-field="${field}"]`);
      const text = cell.textContent.trim();
      const raw = field === "weight" ? text.replace(" lbs", "") : text;
      const val = raw === "—" ? "" : raw;
      const attrs =
        field === "weight"
          ? 'step="2.5"'
          : field === "rpe"
            ? 'step="0.5" max="10"'
            : "";
      cell.innerHTML = `<input type="number" min="0" ${attrs} value="${val}" class="edit-log-input">`;
    });
  });

  card.querySelector(".edit-notes-row").classList.remove("hidden");
  card.querySelector(".edit-btn").classList.add("hidden");
  card.querySelector(".save-btn").classList.remove("hidden");
  card.querySelector(".cancel-btn").classList.remove("hidden");
}

async function saveEdits(sessionId, evt) {
  evt.stopPropagation();
  const card = document.querySelector(`[data-session-id="${sessionId}"]`);
  const saveBtn = card.querySelector(".save-btn");
  saveBtn.textContent = "Saving…";
  saveBtn.disabled = true;

  const updates = [];
  card.querySelectorAll("tr[data-log-id]").forEach((row) => {
    const repsVal = row.querySelector('[data-field="reps"] input')?.value;
    const weightVal = row.querySelector('[data-field="weight"] input')?.value;
    const rpeVal = row.querySelector('[data-field="rpe"] input')?.value;
    updates.push({
      id: row.dataset.logId,
      reps: repsVal !== "" ? parseInt(repsVal) : null,
      weight: weightVal !== "" ? parseFloat(weightVal) : null,
      rpe: rpeVal !== "" ? parseFloat(rpeVal) : null,
    });
  });

  const notes = card.querySelector(".edit-notes-input")?.value.trim() ?? null;

  let hasError = false;

  for (const u of updates) {
    const { error } = await db
      .from("workout_logs")
      .update({ reps: u.reps, weight: u.weight, rpe: u.rpe })
      .eq("id", u.id)
      .eq("user_id", currentUser.id);
    if (error) {
      hasError = true;
      break;
    }
  }

  if (!hasError) {
    const { error } = await db
      .from("workout_sessions")
      .update({ notes: notes || null })
      .eq("id", sessionId)
      .eq("user_id", currentUser.id);
    if (error) hasError = true;
  }

  if (hasError) {
    saveBtn.textContent = "Save";
    saveBtn.disabled = false;
    alert("Error saving changes — please try again.");
    return;
  }

  const programId = document.getElementById("history-program-filter").value;
  const exerciseName = document
    .getElementById("history-exercise-filter")
    .value.trim();
  await loadHistory(programId, exerciseName);
}

function cancelEdits(sessionId, evt) {
  evt.stopPropagation();
  renderSessions(allSessions);
}
