# Enchiridion

A focused strength training tracker. Log workouts, track progress, plan periodized training blocks, and monitor bodyweight — no app install required.

Built with vanilla HTML/CSS/JavaScript and [Supabase](https://supabase.com) as the backend.

---

## Features

- **Authentication** — email/password sign-up and login via Supabase Auth
- **Programs** — create training programs with named days and exercises; the exercise form adapts its highlighted fields based on the program's progression scheme
- **Workout Logging** — log sets session by session with live progression feedback
- **Five Progression Schemes** — linear, double, percentage-based, RPE, and undulating (see below)
- **Deload Detection** — automatically flags exercises where the rep target was missed in 2 consecutive sessions
- **History** — searchable session history with filtering by program or exercise name
- **Exercise Progression Chart** — plots estimated 1RM over time using the Epley formula (`w × (1 + r/30)`)
- **Periodization Planner** — generates week-by-week training blocks (linear block or wave loading)
- **Bodyweight Log** — daily weight entries with a 7-day moving average trend chart
- **Dashboard** — weekly volume bar chart, personal records, and session stats

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML, CSS, Vanilla JavaScript |
| Backend / Auth | [Supabase](https://supabase.com) (PostgreSQL + Auth) |
| Charts | [Chart.js](https://www.chartjs.org/) v4 |
| Fonts | Google Fonts (Bebas Neue, DM Sans, DM Mono) |

No build step, no framework, no dependencies to install.

---

## Project Structure

```
Enchiridion/
├── index.html              # Auth page (login / register)
├── css/
│   └── style.css           # All styles
├── js/
│   ├── supabase.js         # Supabase client (credentials go here)
│   ├── auth.js             # Login / register logic
│   ├── dashboard.js        # Dashboard stats and weekly volume chart
│   ├── programs.js         # Program / day / exercise CRUD + scheme-aware form hints
│   ├── log.js              # Session logging, progression logic, deload detection
│   ├── history.js          # Session history and 1RM progression chart
│   ├── plan.js             # Periodization planner algorithms
│   └── body.js             # Bodyweight log and trend chart
├── pages/
│   ├── dashboard.html
│   ├── programs.html
│   ├── log.html
│   ├── history.html
│   ├── plan.html
│   └── body.html
└── img/
    └── favicon.ico
```

---

## Progression Schemes

Each program has a scheme that determines how the app calculates the next session's target. When adding exercises, the form highlights the fields relevant to the active scheme and dims the rest.

| Scheme | How it works |
|---|---|
| **Linear** | Add 5 lbs when all target reps are completed; repeat the weight if not |
| **Double** | Work within a rep range (e.g. 8–12); once all sets hit the ceiling, add weight and reset to the floor |
| **Percentage** | Re-estimates 1RM each session via the Epley formula, then prescribes a set percentage of that estimate |
| **RPE** | Target a rate of perceived exertion; adjust weight by feel each session |
| **Undulating** | Vary intensity session to session; the app displays targets but progression is managed manually |

### Double Progression in detail

Set the rep range in the Target Reps field as `min-max` (e.g. `8-12`). Each session, the app checks every set individually:

- All sets at or above the ceiling → increase weight next session, reset to floor reps
- All sets at or above the floor, some below ceiling → keep building reps at this weight
- Any set below the floor → repeat the weight

### Deload Detection

When the rep target is missed in 2 consecutive sessions for the same exercise, a warning banner appears at the top of the log page recommending a 10–15% weight reduction.

---

## Periodization Planner

Generates a week-by-week training block given an exercise, a training max, and a block length (4–12 weeks).

**Linear Block** divides the block into three phases:

| Phase | Proportion | Intensity | Sets × Reps |
|---|---|---|---|
| Accumulation | ~38% | 65–72% | 4×8–10 |
| Intensification | ~38% | 75–82% | 4×5–6 |
| Realization | ~25% | 85–92% | 3×1–3 |

**Wave Loading** organizes training into repeating 3-week waves. Each wave starts slightly heavier than the last, creating a "2 steps forward, 1 step back" overload pattern. Volume decreases wave-by-wave as intensity rises.

**Step Loading** divides the block into 2–4 equal steps. Within each step, intensity and volume are constant — the body fully adapts to a given load before it jumps to the next level. The jump between steps is discrete (~5%), making overload clear and predictable.

| Step | Intensity | Sets × Reps |
|---|---|---|
| Step 1 | 70% | 4×6 |
| Step 2 | 75% | 4×5 |
| Step 3 | 80% | 3×4 |
| Step 4 | 85% | 3×3 |

All target weights are rounded to the nearest 2.5 lbs.

---

## Estimated 1RM — Epley Formula

Used in two places: the percentage progression scheme and the history page chart.

```
est. 1RM = weight × (1 + reps / 30)
```

For the progression chart, the best set per session (highest estimated 1RM) is used as the data point. This smooths out variation when set and rep schemes change between sessions, keeping the long-term strength trend readable.

---

## Author

Francis Firmeza
