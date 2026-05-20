// log.js - Handles workout session logging and progression feedback

let currentUser = null;
let loadedExercises = [];
let currentProgram = null;

(async () => {
  const {
    data: { session },
  } = await db.auth.getSession();
  if (!session) {
    window.location.href = "../index.html";
    return;
  }
  currentUser = session.user;

  // Set today's date
  document.getElementById("log-date").valueAsDate = new Date();

  await populateProgramSelect();
})();

document.getElementById("logout-btn").addEventListener("click", async () => {
  await db.auth.signOut();
  window.location.href = "../index.html";
});

async function populateProgramSelect() {
  const { data: programs } = await db
    .from("programs")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("is_active", { ascending: false });

  const sel = document.getElementById("log-program-select");
  programs?.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name + (p.is_active ? " ★" : "");
    sel.appendChild(opt);
  });

  // Store scheme info
  sel.addEventListener("change", async () => {
    const { data: prog } = await db
      .from("programs")
      .select("*")
      .eq("id", sel.value)
      .single();
    currentProgram = prog;
    await populateDaySelect(sel.value);
  });
}

async function populateDaySelect(programId) {
  const { data: days } = await db
    .from("program_days")
    .select("*")
    .eq("program_id", programId)
    .order("day_number");

  const sel = document.getElementById("log-day-select");
  sel.innerHTML = '<option value="">-- Select Day --</option>';
  days?.forEach((d) => {
    const opt = document.createElement("option");
    opt.value = d.id;
    opt.textContent = d.name;
    sel.appendChild(opt);
  });
  sel.disabled = false;
}

document
  .getElementById("load-session-btn")
  .addEventListener("click", async () => {
    const programId = document.getElementById("log-program-select").value;
    const dayId = document.getElementById("log-day-select").value;

    if (!programId || !dayId) {
      document.getElementById("log-error").textContent =
        "Please select a program and day.";
      return;
    }
    document.getElementById("log-error").textContent = "";

    const { data: exercises } = await db
      .from("program_exercises")
      .select("*")
      .eq("day_id", dayId)
      .order("created_at");

    if (!exercises || exercises.length === 0) {
      document.getElementById("log-error").textContent =
        "No exercises found for this day. Add them in Programs first.";
      return;
    }

    // Fetch last 2 sessions per exercise (set_number=1 gives one row per session)
    // prevLog drives progression calculation; prevPrevLog enables deload detection
    for (let ex of exercises) {
      const { data: prevLogs } = await db
        .from("workout_logs")
        .select("*")
        .eq("user_id", currentUser.id)
        .eq("exercise_name", ex.name)
        .eq("set_number", 1)
        .order("logged_at", { ascending: false })
        .limit(2);
      ex.prevLog = prevLogs?.[0] || null;
      ex.prevPrevLog = prevLogs?.[1] || null;
    }

    loadedExercises = exercises;

    const { data: day } = await db
      .from("program_days")
      .select("name")
      .eq("id", dayId)
      .single();
    document.getElementById("session-label").textContent =
      `${currentProgram?.name} — ${day?.name}`;
    document.getElementById("session-scheme").textContent =
      currentProgram?.progression_scheme || "";

    renderExerciseLogCards(exercises);
    checkDeload(exercises);

    document.getElementById("log-area").classList.remove("hidden");
    document.getElementById("log-success").classList.add("hidden");
  });

function renderExerciseLogCards(exercises) {
  const container = document.getElementById("exercise-log-list");
  container.innerHTML = exercises
    .map((ex, idx) => {
      const nextTarget = calculateNextTarget(ex, ex.prevLog);

      return `
    <div class="exercise-log-card" data-idx="${idx}">
      <div class="exercise-log-header">
        <div>
          <div class="exercise-log-name">${ex.name}</div>
          <div class="target-info">
            Target: ${ex.target_sets} × ${ex.target_reps || "?"} reps
            ${ex.target_weight ? `@ ${ex.target_weight} lbs` : ""}
            ${ex.pct_1rm ? `(${ex.pct_1rm}% 1RM)` : ""}
            ${ex.rpe ? `RPE ${ex.rpe}` : ""}
          </div>
          ${ex.prevLog ? `<div class="target-info" style="margin-top:0.2rem">Last: ${ex.prevLog.sets}×${ex.prevLog.reps} @ ${ex.prevLog.weight} lbs</div>` : ""}
        </div>
        <div class="next-target">${nextTarget}</div>
      </div>
      <div class="set-col-header">
        <span></span><span>Reps</span><span>Weight (lbs)</span><span>RPE</span><span></span>
      </div>
      ${renderSetInputs(ex, idx)}
      <div class="progression-note hidden" id="prog-note-${idx}"></div>
    </div>
  `;
    })
    .join("");

  // Live progression feedback on input
  container.querySelectorAll("input").forEach((inp) => {
    inp.addEventListener("change", () => updateProgressionFeedback());
  });
}

function renderSetInputs(ex, idx) {
  return Array.from(
    { length: ex.target_sets },
    (_, s) => `
    <div class="sets-input-row">
      <span class="set-num">S${s + 1}</span>
      <input type="number" min="0" placeholder="reps"
             data-idx="${idx}" data-set="${s}" data-field="reps" />
      <input type="number" min="0" step="2.5" placeholder="lbs"
             data-idx="${idx}" data-set="${s}" data-field="weight" />
      <input type="number" min="1" max="10" step="0.5" placeholder="rpe"
             data-idx="${idx}" data-set="${s}" data-field="rpe" />
      <span></span>
    </div>
  `,
  ).join("");
}

// ── Deload Detection ────────────────────────────────────────

function checkDeload(exercises) {
  const banner = document.getElementById("deload-banner");

  const flagged = exercises.filter((ex) => {
    if (!ex.prevLog || !ex.prevPrevLog) return false;
    const targetReps = parseInt(ex.target_reps) || 5;
    return ex.prevLog.reps < targetReps && ex.prevPrevLog.reps < targetReps;
  });

  if (flagged.length === 0) {
    banner.classList.add("hidden");
    banner.innerHTML = "";
    return;
  }

  const names = flagged.map((ex) => `<strong>${ex.name}</strong>`).join(", ");
  banner.innerHTML = `
    <span class="deload-banner-icon">⚠</span>
    <div>
      Deload recommended — you've missed your rep target on ${names} for
      2 consecutive sessions. Consider reducing weight by 10–15% today to recover.
    </div>
  `;
  banner.classList.remove("hidden");
}

// ── Progression Calculation ─────────────────────────────────
// Supports: linear, double, percentage, rpe, undulating, custom

// Parses "8-12" into { min: 8, max: 12 }, or "5" into { min: 5, max: 5 }.
function parseRepRange(str) {
  if (!str) return { min: null, max: null };
  const parts = str.split("-").map((s) => parseInt(s.trim()));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return { min: parts[0], max: parts[1] };
  }
  const n = parseInt(str);
  return { min: n, max: n };
}

function calculateNextTarget(ex, prevLog) {
  if (!prevLog) return "First session — establish baseline";
  const scheme = currentProgram?.progression_scheme || "linear";

  const prevWeight = prevLog.weight || 0;
  const prevReps = prevLog.reps || 0;

  if (scheme === "linear") {
    const targetReps = parseInt(ex.target_reps) || prevReps;
    if (prevReps >= targetReps) {
      return `Next target: ${prevWeight + 5} lbs`;
    }
    return `Repeat: ${prevWeight} lbs (reps not met)`;
  }

  if (scheme === "double") {
    const { min, max } = parseRepRange(ex.target_reps);
    if (!min || !max) return `Set a rep range (e.g. 8-12) to use double progression`;
    if (prevReps >= max) {
      return `Increase weight: ${prevWeight + 5} lbs × ${min} reps`;
    }
    return `Add reps: ${prevWeight} lbs × aim for ${prevReps + 1}+ (ceiling: ${max})`;
  }

  if (scheme === "percentage" && ex.pct_1rm) {
    // Epley formula: 1RM = w × (1 + r/30)
    const est1RM = prevWeight * (1 + prevReps / 30);
    const nextW = Math.round((est1RM * ex.pct_1rm) / 100 / 2.5) * 2.5;
    return `Next target: ${nextW} lbs (${ex.pct_1rm}% 1RM ≈ ${Math.round(est1RM)} lbs)`;
  }

  if (scheme === "rpe" && ex.rpe) {
    return `Target RPE ${ex.rpe} — adjust weight to feel`;
  }

  if (scheme === "undulating") {
    // Rotate: strength (≤5 reps) → hypertrophy (6-10) → volume (>10) → strength
    const est1RM = prevWeight * (1 + prevReps / 30);
    const r2_5 = (v) => Math.round(v / 2.5) * 2.5;
    if (prevReps <= 5) {
      return `Hypertrophy day: ${r2_5(est1RM * 0.75)} lbs × 8 reps`;
    } else if (prevReps <= 10) {
      return `Volume day: ${r2_5(est1RM * 0.65)} lbs × 12 reps`;
    } else {
      return `Strength day: ${r2_5(est1RM * 0.85)} lbs × 4 reps`;
    }
  }

  return `Previous: ${prevWeight} lbs × ${prevReps}`;
}

function updateProgressionFeedback() {
  loadedExercises.forEach((ex, idx) => {
    const card = document.querySelector(
      `[data-idx="${idx}"].exercise-log-card`,
    );
    if (!card) return;

    const inputs = card.querySelectorAll('input[data-field="reps"]');
    const weightInputs = card.querySelectorAll('input[data-field="weight"]');

    let totalReps = 0,
      setCount = 0,
      lastWeight = 0;
    inputs.forEach((inp, i) => {
      const r = parseInt(inp.value);
      const w = parseFloat(weightInputs[i]?.value);
      if (!isNaN(r)) {
        totalReps += r;
        setCount++;
      }
      if (!isNaN(w)) lastWeight = w;
    });

    if (setCount === 0) return;

    const scheme = currentProgram?.progression_scheme || "linear";
    const noteEl = document.getElementById(`prog-note-${idx}`);
    let nextMsg = "";
    let success = false;

    if (scheme === "double") {
      // Double progression: check each set individually against the rep range
      const { min, max } = parseRepRange(ex.target_reps);
      if (!min || !max) return;

      const setRepsArr = [];
      inputs.forEach((inp) => {
        const r = parseInt(inp.value);
        if (!isNaN(r)) setRepsArr.push(r);
      });
      if (setRepsArr.length === 0) return;

      const allAtCeiling = setRepsArr.every((r) => r >= max);
      const allAboveFloor = setRepsArr.every((r) => r >= min);

      if (allAtCeiling) {
        nextMsg = `✓ All sets at ${max}+ reps — add weight next session: ${lastWeight + 5} lbs × ${min}`;
        success = true;
      } else if (allAboveFloor) {
        const lowestSet = Math.min(...setRepsArr);
        nextMsg = `✓ Floor met — ${max - lowestSet} more rep(s) on weakest set before adding weight`;
        success = true;
      } else {
        const failCount = setRepsArr.filter((r) => r < min).length;
        nextMsg = `✗ ${failCount} set(s) below ${min} reps — repeat ${lastWeight} lbs`;
        success = false;
      }
    } else if (scheme === "undulating") {
      if (lastWeight === 0 || setCount === 0) return;
      const avgReps = totalReps / setCount;
      const est1RM = lastWeight * (1 + avgReps / 30);
      const r2_5 = (v) => Math.round(v / 2.5) * 2.5;
      if (avgReps <= 5) {
        nextMsg = `Next: Hypertrophy — ${r2_5(est1RM * 0.75)} lbs × 8 reps`;
      } else if (avgReps <= 10) {
        nextMsg = `Next: Volume — ${r2_5(est1RM * 0.65)} lbs × 12 reps`;
      } else {
        nextMsg = `Next: Strength — ${r2_5(est1RM * 0.85)} lbs × 4 reps`;
      }
      success = true;
    } else {
      const targetRepsPerSet = parseInt(ex.target_reps) || 5;
      const targetTotal = targetRepsPerSet * ex.target_sets;

      if (totalReps >= targetTotal) {
        if (scheme === "linear") {
          nextMsg = `✓ All reps hit! Next session: ${lastWeight + 5} lbs`;
        } else if (scheme === "percentage" && ex.pct_1rm) {
          const est1RM = lastWeight * (1 + targetRepsPerSet / 30);
          const nextW = Math.round((est1RM * ex.pct_1rm) / 100 / 2.5) * 2.5;
          nextMsg = `✓ Good set! Est 1RM: ${Math.round(est1RM)} lbs → Next ${ex.pct_1rm}%: ${nextW} lbs`;
        } else {
          nextMsg = `✓ Target reps met!`;
        }
        success = true;
      } else {
        nextMsg = `✗ ${totalReps}/${targetTotal} reps — repeat this weight next session`;
        success = false;
      }
    }

    noteEl.textContent = nextMsg;
    noteEl.className = `progression-note ${success ? "success" : "fail"}`;
    noteEl.classList.remove("hidden");
  });
}

// ── Save Session ────────────────────────────────────────────

document
  .getElementById("finish-session-btn")
  .addEventListener("click", async () => {
    const programId = document.getElementById("log-program-select").value;
    const dayId = document.getElementById("log-day-select").value;
    const dateVal = document.getElementById("log-date").value;
    const notes = document.getElementById("log-notes").value.trim();
    const errEl = document.getElementById("log-error");

    // Create session record
    const { data: session, error: sErr } = await db
      .from("workout_sessions")
      .insert({
        user_id: currentUser.id,
        program_id: programId,
        day_id: dayId,
        logged_at: dateVal,
        notes,
      })
      .select()
      .single();

    if (sErr) {
      errEl.textContent = sErr.message;
      return;
    }

    // Collect all set inputs
    const logs = [];
    document.querySelectorAll(".exercise-log-card").forEach((card, idx) => {
      const ex = loadedExercises[idx];
      const setInputs = card.querySelectorAll(".sets-input-row");
      let setNum = 1;

      setInputs.forEach((row) => {
        const reps = parseInt(row.querySelector('[data-field="reps"]')?.value);
        const weight = parseFloat(
          row.querySelector('[data-field="weight"]')?.value,
        );
        const rpe = parseFloat(row.querySelector('[data-field="rpe"]')?.value);

        if (!isNaN(reps) || !isNaN(weight)) {
          logs.push({
            session_id: session.id,
            user_id: currentUser.id,
            program_id: programId,
            exercise_id: ex.id,
            exercise_name: ex.name,
            set_number: setNum++,
            sets: ex.target_sets,
            reps: isNaN(reps) ? null : reps,
            weight: isNaN(weight) ? null : weight,
            rpe: isNaN(rpe) ? null : rpe,
            logged_at: dateVal,
          });
        }
      });
    });

    if (logs.length === 0) {
      errEl.textContent = "No data entered yet.";
      return;
    }

    const { error: lErr } = await db.from("workout_logs").insert(logs);
    if (lErr) {
      errEl.textContent = lErr.message;
      return;
    }

    errEl.textContent = "";
    document.getElementById("log-success").classList.remove("hidden");
    document.getElementById("exercise-log-list").innerHTML = "";
    document.getElementById("log-area").classList.add("hidden");
  });
