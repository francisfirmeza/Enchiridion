const supabaseUrl = "https://dycoodprngjtzculnzwo.supabase.co";
const supabaseKey = "sb_publishable_X6dRRdO5fzd3rnz4oRS8Tg_eQwmEy5J";
const client = window.supabase.createClient(supabaseUrl, supabaseKey);

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

// Form submission to tblLifts
document.addEventListener("DOMContentLoaded", () => {
    loadExercises();

    document
    .getElementById("workout-form")
    .addEventListener("submit", async (e) => {
      e.preventDefault();

      const exercise = parseInt(document.getElementById("exercise").value);
      const weight = document.getElementById("weight").value;
      const sets = document.getElementById("sets").value;
      const reps = document.getElementById("reps").value;

      if (!exercise) {
        alert("Please select an exercise");
        return;
      }

      const { data, error } = await client
        .from("tblLifts")
        .insert({ Exercise: exercise, Weight: weight, Sets: sets, Reps: reps });

      if (error) {
        console.error("Error:", error.message);
      } else {
        console.log("Saved", data);
      }
    });
});
