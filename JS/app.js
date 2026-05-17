const supabaseUrl = "https://dycoodprngjtzculnzwo.supabase.co";
const supabaseKey = "sb_publishable_X6dRRdO5fzd3rnz4oRS8Tg_eQwmEy5J";
const client = window.supabase.createClient(supabaseUrl, supabaseKey);

async function loadPrograms() {
  const { data, error } = await client
    .from("tblPrograms")
    .select("program_id, program_type, program_name, program_description")
    .order("program_name", { ascending: true });

  const list = document.getElementById("programs-list");

  if (error) {
    console.error("Error loading programs:", error);
    list.innerHTML = "<li>Error loading programs</li>";
    return;
  }

  list.innerHTML = data
    .map(
      (program) => `
    <li>
      <h2>${program.program_name}</h2>
      <p><strong>Type:</strong> ${program.program_type}</p>
      <p>${program.program_description}</p>
    </li>
  `,
    )
    .join("");
}

// Fill exercise dropdown list from Supabase tblExercises
async function loadExercises() {
  const { data, error } = await client
    .from("tblExercises")
    .select("exercise_id, exercise_name")
    .order("exercise_name", { ascending: true });

  console.log("data:", data);
  console.log("error:", error);

  if (error) {
    console.error("Error loading exercises:", error);
    return;
  }

  const select = document.getElementById("exercise");
  data.forEach((exercise) => {
    const option = document.createElement("option");
    option.value = exercise.exercise_id; // Writes exercise_id as the value
    option.textContent = exercise.exercise_name; // Displays name to user
    select.appendChild(option);
  });
}

// Display workout log from tblLifts, joining with tblExercises for exercise names
async function loadWorkoutLog() {
  const { data, error } = await client
    .from("tblLifts")
    .select(
      `
      lift_id,
      tblExercises!Exercise (exercise_name),
      Weight,
      Sets,
      Reps,
      Date
    `,
    )
    .order("Date", { ascending: false });

  const tbody = document.getElementById("workout-log-body");

  if (error) {
    console.error("Error loading workouts:", error);
    tbody.innerHTML = "<tr><td colspan='5'>Error loading workouts</td></tr>";
    return;
  }

  tbody.innerHTML = data
    .map(
      (row) => `
      <tr>
        <td>${row.tblExercises.exercise_name}</td>
        <td>${row.Weight}</td>
        <td>${row.Sets}</td>
        <td>${row.Reps}</td>
        <td>${new Date(row.Date).toLocaleDateString()}</td>
        <td><button onclick="deleteWorkoutLog(${row.lift_id})">X</button></td>
       </tr>
    `,
    )
    .join("");
}

async function deleteWorkoutLog(lift_id) {
  const { error } = await client
    .from("tblLifts")
    .delete()
    .eq("lift_id", lift_id);

  console.log("lift_id being deleted:", lift_id);
  console.log("delete error:", error);

  if (error) {
    console.error("Error deleting workout:", error);
    return;
  }

  loadWorkoutLog(); // Refresh the workout log after deletion
}

// Form submission to tblLifts
document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("exercise")) {
    loadExercises();
  }

  if (document.getElementById("workout-log-body")) {
    loadWorkoutLog();
  }

  // Add this inside your DOMContentLoaded block:
  if (document.getElementById("programs-list")) {
    loadPrograms();
  }

  document
    .getElementById("workout-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();

      const exercise = parseInt(document.getElementById("exercise").value);
      const weight = document.getElementById("weight").value;
      const sets = document.getElementById("sets").value;
      const reps = document.getElementById("reps").value;
      const date = document.getElementById("date").value;

      if (!exercise) {
        alert("Please select an exercise");
        return;
      }

      const { data, error } = await client.from("tblLifts").insert({
        Exercise: exercise,
        Weight: weight,
        Sets: sets,
        Reps: reps,
        Date: date,
      });

      if (error) {
        console.error("Error:", error.message);
      } else {
        console.log("Saved", data);
      }
    });
});
