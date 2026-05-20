// plan.js - Periodization planner: generates week-by-week training blocks

(async () => {
  const {
    data: { session },
  } = await db.auth.getSession();
  if (!session) {
    window.location.href = "../index.html";
    return;
  }
})();

document.getElementById("logout-btn").addEventListener("click", async () => {
  await db.auth.signOut();
  window.location.href = "../index.html";
});

document.getElementById("generate-btn").addEventListener("click", () => {
  const exercise = document.getElementById("plan-exercise").value.trim();
  const trainingMax = parseFloat(document.getElementById("plan-1rm").value);
  const weeks = parseInt(document.getElementById("plan-weeks").value);
  const type = document.getElementById("plan-type").value;
  const errEl = document.getElementById("plan-error");

  if (!exercise) {
    errEl.textContent = "Enter an exercise name.";
    return;
  }
  if (!trainingMax || trainingMax <= 0) {
    errEl.textContent = "Enter a valid training max.";
    return;
  }
  errEl.textContent = "";

  const plan =
    type === "wave"
      ? generateWaveLoading(trainingMax, weeks)
      : type === "step"
        ? generateStepLoading(trainingMax, weeks)
        : generateLinearBlock(trainingMax, weeks);

  renderPlan(plan, exercise, trainingMax, weeks, type);
  document.getElementById("plan-output").classList.remove("hidden");
  document.getElementById("plan-output").scrollIntoView({ behavior: "smooth" });
});

// ── Utilities ────────────────────────────────────────────────

function round2_5(val) {
  return Math.round(val / 2.5) * 2.5;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// ── Linear Block Periodization ───────────────────────────────
// Splits the block into three phases:
//   Accumulation  (~38%): high volume, moderate intensity (65–72%)
//   Intensification (~38%): moderate volume, high intensity (75–82%)
//   Realization   (~25%): low volume, peak intensity (85–92%)

function generateLinearBlock(trainingMax, totalWeeks) {
  const accWeeks = Math.floor(totalWeeks * 0.375);
  const intWeeks = Math.floor(totalWeeks * 0.375);
  const realWeeks = totalWeeks - accWeeks - intWeeks;
  const plan = [];

  for (let i = 0; i < accWeeks; i++) {
    const t = accWeeks > 1 ? i / (accWeeks - 1) : 0;
    const pct = lerp(65, 72, t);
    plan.push({
      phase: "Accumulation",
      sets: 4,
      reps: i < Math.ceil(accWeeks / 2) ? 10 : 8,
      pct: Math.round(pct * 2) / 2,
      weight: round2_5((trainingMax * pct) / 100),
    });
  }

  for (let i = 0; i < intWeeks; i++) {
    const t = intWeeks > 1 ? i / (intWeeks - 1) : 0;
    const pct = lerp(75, 82, t);
    plan.push({
      phase: "Intensification",
      sets: 4,
      reps: i < Math.ceil(intWeeks / 2) ? 6 : 5,
      pct: Math.round(pct * 2) / 2,
      weight: round2_5((trainingMax * pct) / 100),
    });
  }

  for (let i = 0; i < realWeeks; i++) {
    const t = realWeeks > 1 ? i / (realWeeks - 1) : 0;
    const pct = lerp(85, 92, t);
    const reps = [3, 2, 1][Math.min(i, 2)];
    plan.push({
      phase: "Realization",
      sets: 3,
      reps,
      pct: Math.round(pct * 2) / 2,
      weight: round2_5((trainingMax * pct) / 100),
    });
  }

  return plan.map((w, i) => ({ ...w, week: i + 1 }));
}

// ── Wave Loading Periodization ───────────────────────────────
// Organizes training into 3-week waves. Each wave starts at a
// slightly higher intensity than the last, creating a "2 steps
// forward, 1 step back" overload pattern.
//   Wave 1: 68 / 73 / 78%
//   Wave 2: 72 / 77 / 82%
//   Wave 3: 76 / 81 / 86%
//   …
// Volume (sets × reps) decreases wave-by-wave as intensity rises.

function generateWaveLoading(trainingMax, totalWeeks) {
  const plan = [];
  const waveCount = Math.ceil(totalWeeks / 3);

  const waveVolume = [
    { sets: 5, reps: [6, 5, 4] },
    { sets: 4, reps: [5, 4, 3] },
    { sets: 4, reps: [4, 3, 2] },
    { sets: 3, reps: [3, 2, 1] },
  ];

  for (let w = 0; w < waveCount; w++) {
    const baseIntensity = 68 + w * 4;
    const vol = waveVolume[Math.min(w, waveVolume.length - 1)];
    const wavePcts = [baseIntensity, baseIntensity + 5, baseIntensity + 10];
    const waveWeeks = Math.min(3, totalWeeks - plan.length);

    for (let d = 0; d < waveWeeks; d++) {
      const pct = wavePcts[d];
      plan.push({
        week: plan.length + 1,
        phase: `Wave ${w + 1}`,
        sets: vol.sets,
        reps: vol.reps[d],
        pct,
        weight: round2_5((trainingMax * pct) / 100),
      });
    }
  }

  return plan;
}

// ── Step Loading Periodization ───────────────────────────────
// Divides the block into 2–4 equal steps. Within each step,
// intensity and volume are constant — the body fully adapts to
// a load before it jumps to the next step. The jump between
// steps is discrete (~5%), making overload clear and predictable.
//   Step 1: 70% · 4×6
//   Step 2: 75% · 4×5
//   Step 3: 80% · 3×4
//   Step 4: 85% · 3×3

function generateStepLoading(trainingMax, totalWeeks) {
  const numSteps = totalWeeks <= 4 ? 2 : totalWeeks <= 6 ? 3 : 4;
  const baseWeeks = Math.floor(totalWeeks / numSteps);
  const remainder = totalWeeks - baseWeeks * numSteps;

  const stepDefs = [
    { pct: 70, sets: 4, reps: 6 },
    { pct: 75, sets: 4, reps: 5 },
    { pct: 80, sets: 3, reps: 4 },
    { pct: 85, sets: 3, reps: 3 },
  ];

  const plan = [];

  for (let s = 0; s < numSteps; s++) {
    const def = stepDefs[s];
    const stepWeeks = baseWeeks + (s === numSteps - 1 ? remainder : 0);

    for (let w = 0; w < stepWeeks; w++) {
      plan.push({
        week: plan.length + 1,
        phase: `Step ${s + 1}`,
        sets: def.sets,
        reps: def.reps,
        pct: def.pct,
        weight: round2_5((trainingMax * def.pct) / 100),
      });
    }
  }

  return plan;
}

// ── Rendering ────────────────────────────────────────────────

function phaseClass(phase, pct) {
  if (pct < 75) return "phase-acc";
  if (pct < 85) return "phase-int";
  return "phase-real";
}

function intensityBar(pct) {
  const fill = Math.min(100, Math.max(0, ((pct - 60) / 40) * 100));
  const color =
    pct < 75
      ? "var(--accent3)"
      : pct < 85
        ? "var(--accent)"
        : "var(--accent2)";
  return `
    <div class="intensity-bar">
      <div class="intensity-fill" style="width:${fill}%;background:${color}"></div>
    </div>
    <span style="font-family:var(--font-mono);font-size:0.72rem;color:var(--text-muted);margin-left:0.5rem">${pct}%</span>
  `;
}

function renderPlan(plan, exercise, trainingMax, weeks, type) {
  // Table label
  const typeLabel = { linear: "LINEAR BLOCK", wave: "WAVE LOADING", step: "STEP LOADING" };
  document.getElementById("plan-table-label").textContent =
    `${exercise.toUpperCase()} — ${weeks}-WEEK ${typeLabel[type] || "LINEAR BLOCK"}`;

  // Summary stats
  const totalVolume = plan.reduce((s, w) => s + w.sets * w.reps, 0);
  const peakWeight = Math.max(...plan.map((w) => w.weight));
  const peakPct = Math.max(...plan.map((w) => w.pct));
  const phases = [...new Set(plan.map((w) => w.phase))];

  document.getElementById("plan-summary").innerHTML = [
    { label: "Peak Intensity", value: `${peakPct}%` },
    { label: "Peak Weight", value: `${peakWeight} lbs` },
    { label: "Total Reps (excl. weight)", value: totalVolume.toLocaleString() },
    { label: type === "step" ? "Steps" : type === "wave" ? "Waves" : "Phases", value: phases.length },
  ]
    .map(
      ({ label, value }) => `
    <div class="plan-stat">
      <span class="stat-num" style="font-size:1.8rem">${value}</span>
      <span class="stat-label">${label}</span>
    </div>
  `,
    )
    .join("");

  // Week rows
  document.getElementById("plan-tbody").innerHTML = plan
    .map(
      (w) => `
    <tr>
      <td style="font-family:var(--font-mono)">${w.week}</td>
      <td><span class="phase-badge ${phaseClass(w.phase, w.pct)}">${w.phase}</span></td>
      <td style="font-family:var(--font-mono)">${w.sets} × ${w.reps}</td>
      <td style="font-family:var(--font-mono)">${w.pct}%</td>
      <td style="font-family:var(--font-mono);color:var(--accent)">${w.weight} lbs</td>
      <td style="font-family:var(--font-mono);color:var(--text-muted)">${w.sets * w.reps} reps</td>
      <td><div style="display:flex;align-items:center">${intensityBar(w.pct)}</div></td>
    </tr>
  `,
    )
    .join("");

  // Guidance text
  const guidanceMap = {
    linear: `<p><strong style="color:var(--text)">Accumulation</strong> — Build your work capacity with higher reps and moderate weight.
       Focus on technique and consistency. Rest 2–3 minutes between sets.</p>
       <p style="margin-top:0.75rem"><strong style="color:var(--text)">Intensification</strong> — Shift toward heavier loads and fewer reps.
       Your body converts the volume base into strength. Rest 3–4 minutes between sets.</p>
       <p style="margin-top:0.75rem"><strong style="color:var(--text)">Realization</strong> — Express the strength you've built.
       Keep volume low, prioritize recovery, and hit your targets. Rest 4–5 minutes between sets.</p>
       <p style="margin-top:0.75rem;color:var(--text-muted);font-size:0.82rem">
       Weights are based on your stated training max of <strong>${trainingMax} lbs</strong>.
       If a target weight feels too easy or too hard, adjust your training max and regenerate.</p>`,

    wave: `<p><strong style="color:var(--text)">Wave structure</strong> — Each 3-week wave ratchets up in intensity.
       The first week of each new wave is slightly heavier than the first week of the previous wave —
       this "2 steps forward, 1 step back" pattern allows recovery while driving long-term progress.</p>
       <p style="margin-top:0.75rem"><strong style="color:var(--text)">Within a wave</strong> — weight increases and reps decrease
       each week. By the final week of a wave, you should feel near your limit for those reps.</p>
       <p style="margin-top:0.75rem;color:var(--text-muted);font-size:0.82rem">
       Weights are based on your stated training max of <strong>${trainingMax} lbs</strong>.
       Adjust by ±5–10 lbs per set based on daily feel — wave loading rewards auto-regulation.</p>`,

    step: `<p><strong style="color:var(--text)">How step loading works</strong> — Unlike linear progression,
       intensity stays constant for the entire duration of each step. You repeat the same weight week
       after week, allowing full adaptation before the load jumps to the next level. The jump between
       steps is discrete (~5%), making overload clear and predictable.</p>
       <p style="margin-top:0.75rem"><strong style="color:var(--text)">Step 1</strong> — The weight should feel manageable.
       Focus on bar speed and dialling in technique at this load.</p>
       <p style="margin-top:0.75rem"><strong style="color:var(--text)">Step 2</strong> — Now challenging. Maintain rep quality and avoid grinding.
       Your body is adapting to the previous step's load.</p>
       <p style="margin-top:0.75rem"><strong style="color:var(--text)">Step 3</strong> — Heavy territory. Prioritise sleep and recovery between sessions.</p>
       <p style="margin-top:0.75rem"><strong style="color:var(--text)">Step 4</strong> — Peak intensity. Keep sessions short and focused; volume is intentionally low.</p>
       <p style="margin-top:0.75rem;color:var(--text-muted);font-size:0.82rem">
       Weights are based on your stated training max of <strong>${trainingMax} lbs</strong>.
       If a step feels too light in week 1, your training max may be understated — adjust and regenerate.</p>`,
  };

  const guidance = guidanceMap[type] || guidanceMap.linear;

  document.getElementById("plan-guidance").innerHTML = guidance;
}
