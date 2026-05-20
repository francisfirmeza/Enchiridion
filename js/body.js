// body.js - Bodyweight logging and trend visualization

let currentUser = null;
let bwChartInstance = null;

(async () => {
  const {
    data: { session },
  } = await db.auth.getSession();
  if (!session) {
    window.location.href = "../index.html";
    return;
  }
  currentUser = session.user;
  document.getElementById("bw-date").valueAsDate = new Date();
  await loadEntries();
})();

document.getElementById("logout-btn").addEventListener("click", async () => {
  await db.auth.signOut();
  window.location.href = "../index.html";
});

document.getElementById("bw-save-btn").addEventListener("click", async () => {
  const date = document.getElementById("bw-date").value;
  const weight = parseFloat(document.getElementById("bw-weight").value);
  const notes = document.getElementById("bw-notes").value.trim();
  const errEl = document.getElementById("bw-error");

  if (!date) { errEl.textContent = "Select a date."; return; }
  if (!weight || weight <= 0) { errEl.textContent = "Enter a valid weight."; return; }
  errEl.textContent = "";

  const { error } = await db.from("bodyweight_logs").insert({
    user_id: currentUser.id,
    weight,
    logged_at: date,
    notes: notes || null,
  });

  if (error) { errEl.textContent = error.message; return; }

  document.getElementById("bw-weight").value = "";
  document.getElementById("bw-notes").value = "";
  await loadEntries();
});

// ── Data Loading ─────────────────────────────────────────────

async function loadEntries() {
  const { data: entries, error } = await db
    .from("bodyweight_logs")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("logged_at", { ascending: true });

  if (error) {
    document.getElementById("bw-error").textContent = error.message;
    return;
  }

  if (!entries || entries.length === 0) return;

  renderStats(entries);
  renderChart(entries);
  renderTable(entries);
}

// ── Stats ────────────────────────────────────────────────────

function renderStats(entries) {
  const statsEl = document.getElementById("bw-stats");
  statsEl.style.display = "";

  const latest = entries[entries.length - 1].weight;
  document.getElementById("stat-current").textContent = latest.toFixed(1);
  document.getElementById("stat-entries").textContent = entries.length;

  // 30-day change: compare latest to the entry closest to 30 days ago
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const baseline = entries.find((e) => new Date(e.logged_at) >= cutoff);
  if (baseline && baseline.weight !== latest) {
    const delta = latest - baseline.weight;
    const sign = delta > 0 ? "+" : "";
    const el = document.getElementById("stat-change");
    el.textContent = `${sign}${delta.toFixed(1)}`;
    el.style.color = delta <= 0 ? "var(--accent3)" : "var(--accent2)";
  } else {
    document.getElementById("stat-change").textContent = "—";
  }
}

// ── Chart ────────────────────────────────────────────────────
// Plots raw bodyweight entries and a 7-day centred moving average.

function movingAverage(values, window = 7) {
  const half = Math.floor(window / 2);
  return values.map((_, i) => {
    const start = Math.max(0, i - half);
    const end = Math.min(values.length, i + half + 1);
    const slice = values.slice(start, end);
    return slice.reduce((s, v) => s + v, 0) / slice.length;
  });
}

function renderChart(entries) {
  document.getElementById("bw-chart-section").classList.remove("hidden");

  const labels = entries.map((e) =>
    new Date(e.logged_at + "T00:00:00").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),
  );
  const weights = entries.map((e) => e.weight);
  const avg = movingAverage(weights);

  if (bwChartInstance) bwChartInstance.destroy();

  bwChartInstance = new Chart(document.getElementById("bw-chart"), {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Weight (lbs)",
          data: weights,
          borderColor: "#d4a843",
          backgroundColor: "rgba(212,168,67,0.08)",
          tension: 0.2,
          pointRadius: 3,
          pointBackgroundColor: "#d4a843",
          fill: true,
        },
        {
          label: "7-Day Avg",
          data: avg,
          borderColor: "rgba(212,168,67,0.5)",
          backgroundColor: "transparent",
          tension: 0.4,
          pointRadius: 0,
          borderDash: [5, 4],
          borderWidth: 1.5,
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
            label: (ctx) =>
              ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)} lbs`,
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
  });
}

// ── Table ────────────────────────────────────────────────────

function renderTable(entries) {
  document.getElementById("bw-table-section").classList.remove("hidden");

  // Show newest first in the table
  const sorted = [...entries].reverse().slice(0, 30);

  document.getElementById("bw-tbody").innerHTML = sorted
    .map((e) => {
      const date = new Date(e.logged_at + "T00:00:00").toLocaleDateString(
        "en-US",
        { weekday: "short", month: "short", day: "numeric", year: "numeric" },
      );
      return `
        <tr>
          <td>${date}</td>
          <td style="font-family:var(--font-mono);color:var(--accent)">${e.weight.toFixed(1)} lbs</td>
          <td style="color:var(--text-muted)">${e.notes || "—"}</td>
          <td>
            <button class="btn-danger" onclick="deleteEntry('${e.id}')">✕</button>
          </td>
        </tr>
      `;
    })
    .join("");
}

window.deleteEntry = async (id) => {
  await db.from("bodyweight_logs").delete().eq("id", id);
  await loadEntries();
};
