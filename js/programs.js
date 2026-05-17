// programs.js - Manages the display and interaction of programs in the UI

let currentUser = null;
let currentProgram = null;
let currentDay = null;

(async () => {
  const { data: { session } } = await db.auth.getSession();
  if (!session) { window.location.href = '../index.html'; return; }
  currentUser = session.user;
  await loadPrograms();
})();

document.getElementById('logout-btn').addEventListener('click', async () => {
  await db.auth.signOut();
  window.location.href = '../index.html';
});

// ── Program CRUD ────────────────────────────────────────────

document.getElementById('new-program-btn').addEventListener('click', () => {
  document.getElementById('program-modal').classList.remove('hidden');
});

document.getElementById('cancel-program-btn').addEventListener('click', () => {
  document.getElementById('program-modal').classList.add('hidden');
});

document.getElementById('save-program-btn').addEventListener('click', async () => {
  const name   = document.getElementById('prog-name').value.trim();
  const desc   = document.getElementById('prog-desc').value.trim();
  const scheme = document.getElementById('prog-scheme').value;
  const days   = parseInt(document.getElementById('prog-days').value);
  const errEl  = document.getElementById('prog-error');

  if (!name) { errEl.textContent = 'Program name is required.'; return; }

  const { data: prog, error } = await db.from('programs').insert({
    user_id: currentUser.id,
    name, description: desc, progression_scheme: scheme,
    is_active: false
  }).select().single();

  if (error) { errEl.textContent = error.message; return; }

  // Create days
  const dayInserts = Array.from({ length: days }, (_, i) => ({
    program_id: prog.id,
    user_id: currentUser.id,
    day_number: i + 1,
    name: `Day ${i + 1}`
  }));
  await db.from('program_days').insert(dayInserts);

  document.getElementById('program-modal').classList.add('hidden');
  document.getElementById('prog-name').value = '';
  document.getElementById('prog-desc').value = '';
  errEl.textContent = '';
  await loadPrograms();
});

async function loadPrograms() {
  const { data: programs, error } = await db
    .from('programs')
    .select('*')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false });

  const listEl = document.getElementById('programs-list');

  if (!programs || programs.length === 0) {
    listEl.innerHTML = '<p class="muted">No programs yet. Create one above.</p>';
    return;
  }

  listEl.innerHTML = programs.map(p => `
    <div class="program-card ${p.is_active ? 'is-active' : ''}" data-id="${p.id}">
      <div class="program-card-name">${p.name}</div>
      <div class="program-card-meta">${p.progression_scheme?.toUpperCase()} · ${p.description || ''}</div>
      <div class="program-card-actions">
        <button class="btn-primary small" onclick="openProgram('${p.id}')">View Days</button>
        <button class="btn-secondary" onclick="setActive('${p.id}', ${p.is_active})" style="font-size:0.78rem;padding:0.4rem 0.8rem">
          ${p.is_active ? '✓ Active' : 'Set Active'}
        </button>
        <button class="btn-danger" onclick="deleteProgram('${p.id}')">✕</button>
      </div>
    </div>
  `).join('');
}

window.setActive = async (id, currentlyActive) => {
  if (currentlyActive) return;
  await db.from('programs').update({ is_active: false }).eq('user_id', currentUser.id);
  await db.from('programs').update({ is_active: true }).eq('id', id);
  await loadPrograms();
};

window.deleteProgram = async (id) => {
  if (!confirm('Delete this program and all its data?')) return;
  await db.from('program_exercises').delete().eq('program_id', id);
  await db.from('program_days').delete().eq('program_id', id);
  await db.from('programs').delete().eq('id', id);
  await loadPrograms();
};

// ── Days View ───────────────────────────────────────────────

window.openProgram = async (programId) => {
  const { data: prog } = await db.from('programs').select('*').eq('id', programId).single();
  const { data: days } = await db.from('program_days').select('*').eq('program_id', programId).order('day_number');
  currentProgram = prog;

  document.getElementById('programs-list').classList.add('hidden');
  document.getElementById('new-program-btn').classList.add('hidden');
  document.getElementById('program-detail').classList.remove('hidden');
  document.getElementById('detail-program-name').textContent = prog.name;
  document.getElementById('detail-scheme').textContent = prog.progression_scheme;

  const grid = document.getElementById('days-grid');

  // Count exercises per day
  const { data: exercises } = await db
    .from('program_exercises')
    .select('day_id')
    .eq('program_id', programId);

  const countByDay = {};
  exercises?.forEach(e => { countByDay[e.day_id] = (countByDay[e.day_id] || 0) + 1; });

  grid.innerHTML = days.map(d => `
    <div class="day-card" onclick="openDay('${d.id}', '${d.name}')">
      <div class="day-number">${d.day_number}</div>
      <div class="day-name">${d.name}</div>
      <div class="day-exercise-count">${countByDay[d.id] || 0} exercises</div>
    </div>
  `).join('');
};

document.getElementById('back-to-programs').addEventListener('click', () => {
  document.getElementById('program-detail').classList.add('hidden');
  document.getElementById('programs-list').classList.remove('hidden');
  document.getElementById('new-program-btn').classList.remove('hidden');
  document.getElementById('day-detail').classList.add('hidden');
});

// ── Exercises View ──────────────────────────────────────────

window.openDay = async (dayId, dayName) => {
  const { data: day } = await db.from('program_days').select('*').eq('id', dayId).single();
  currentDay = day;
  document.getElementById('days-grid').classList.add('hidden');
  document.getElementById('day-detail').classList.remove('hidden');
  document.getElementById('detail-day-name').textContent = dayName;
  await loadExercises(dayId);
};

document.getElementById('back-to-days').addEventListener('click', () => {
  document.getElementById('day-detail').classList.add('hidden');
  document.getElementById('days-grid').classList.remove('hidden');
  openProgram(currentProgram.id);
});

document.getElementById('add-exercise-btn').addEventListener('click', () => {
  document.getElementById('add-exercise-form').classList.toggle('hidden');
});

document.getElementById('cancel-ex-btn').addEventListener('click', () => {
  document.getElementById('add-exercise-form').classList.add('hidden');
});

document.getElementById('save-exercise-btn').addEventListener('click', async () => {
  const name   = document.getElementById('ex-name').value.trim();
  const sets   = parseInt(document.getElementById('ex-sets').value) || 3;
  const reps   = document.getElementById('ex-reps').value.trim();
  const weight = parseFloat(document.getElementById('ex-weight').value) || null;
  const pct    = parseFloat(document.getElementById('ex-pct').value) || null;
  const rpe    = parseFloat(document.getElementById('ex-rpe').value) || null;
  const errEl  = document.getElementById('ex-error');

  if (!name) { errEl.textContent = 'Exercise name required.'; return; }

  const { error } = await db.from('program_exercises').insert({
    program_id: currentProgram.id,
    day_id:     currentDay.id,
    user_id:    currentUser.id,
    name, target_sets: sets, target_reps: reps,
    target_weight: weight, pct_1rm: pct, rpe
  });

  if (error) { errEl.textContent = error.message; return; }

  ['ex-name','ex-reps','ex-weight','ex-pct','ex-rpe'].forEach(id => document.getElementById(id).value = '');
  document.getElementById('ex-sets').value = 3;
  errEl.textContent = '';
  document.getElementById('add-exercise-form').classList.add('hidden');
  await loadExercises(currentDay.id);
});

async function loadExercises(dayId) {
  const { data: exercises } = await db
    .from('program_exercises')
    .select('*')
    .eq('day_id', dayId)
    .order('created_at');

  const tbody = document.getElementById('exercises-body');
  if (!exercises || exercises.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="muted">No exercises yet.</td></tr>';
    return;
  }

  tbody.innerHTML = exercises.map(e => `
    <tr>
      <td>${e.name}</td>
      <td>${e.target_sets}</td>
      <td>${e.target_reps || '—'}</td>
      <td>${e.target_weight ? e.target_weight + ' lbs' : '—'}</td>
      <td>${e.pct_1rm ? e.pct_1rm + '%' : '—'}</td>
      <td>${e.rpe || '—'}</td>
      <td><button class="btn-danger" onclick="deleteExercise('${e.id}')">✕</button></td>
    </tr>
  `).join('');
}

window.deleteExercise = async (id) => {
  await db.from('program_exercises').delete().eq('id', id);
  await loadExercises(currentDay.id);
};
