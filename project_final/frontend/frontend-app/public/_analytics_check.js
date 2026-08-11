

const BASE_URL =
  window.API_BASE_URL || localStorage.getItem("apiBaseUrl") || "https://ai-nlp-co-po-mapper.onrender.com";

const YEAR_SEM_MAP = {
  FE: [1, 2],
  SE: [3, 4],
  TE: [5, 6],
  BE: [7, 8]
};

const SCHEMA_YEAR_MAP = {
  C: ["FE", "SE", "TE", "BE"],
  NEP: ["FE", "SE"]
};

let chart1 = null;
let chart2 = null;

document.querySelector(".profile h3").textContent =
  localStorage.getItem("facultyName") || "Faculty";

function logout(){
  localStorage.removeItem("loggedIn");
  window.location.href = "login.html";
}

function updateAnalyticsStatus(message){
  const status = document.getElementById("analyticsStatus");
  if(status){
    status.textContent = message;
  }
}

function resetSelect(selectId, placeholder){
  const select = document.getElementById(selectId);
  if(select){
    select.innerHTML = `<option value="">${placeholder}</option>`;
  }
}

function populateSelect(selectId, options, placeholder){
  const select = document.getElementById(selectId);
  if(!select){
    return;
  }

  select.innerHTML = `<option value="">${placeholder}</option>`;

  options.forEach(option => {
    select.innerHTML += `<option value="${option.value}">${option.label}</option>`;
  });
}

function loadAnalyticsSemesters(){
  const year = document.getElementById("year").value;
  const semester = document.getElementById("semester");

  semester.innerHTML = '<option value="">Select Semester</option>';
  resetSelect("subject2", "Select Subject");

  if(!year){
    return;
  }

  (YEAR_SEM_MAP[year] || []).forEach(value => {
    semester.innerHTML += `<option value="${value}">Semester ${value}</option>`;
  });
}

function populateAnalyticsYears(){
  const schema = document.getElementById("schema").value;
  const year = document.getElementById("year");
  const semester = document.getElementById("semester");

  year.innerHTML = '<option value="">Select Year</option>';
  semester.innerHTML = '<option value="">Select Semester</option>';
  resetSelect("subject2", "Select Subject");

  if(!schema){
    return;
  }

  (SCHEMA_YEAR_MAP[schema] || []).forEach(value => {
    year.innerHTML += `<option value="${value}">${value}</option>`;
  });
}

async function loadUniversitySubjects(university){
  resetSelect("subject", "Loading subjects...");

  try{
    const url = new URL(`${BASE_URL}/university-subjects`);
    url.searchParams.set("university", university);

    const res = await fetch(url.toString());
    const data = await res.json();
    const subjects = Array.isArray(data.subjects) ? data.subjects : [];

    if(subjects.length === 0){
      resetSelect("subject", "No subjects found");
      updateAnalyticsStatus(`No subjects found for ${university}.`);
      return;
    }

    populateSelect("subject", subjects, "Select Subject");
    updateAnalyticsStatus(`Loaded ${subjects.length} subject option(s) for ${university}.`);
  }catch(error){
    console.error("Unable to load university subjects", error);
    resetSelect("subject", "Unable to load subjects");
    updateAnalyticsStatus("Unable to load subjects from the backend.");
  }
}

async function loadAnalyticsMumbaiSubjects(){
  const schema = document.getElementById("schema").value;
  const year = document.getElementById("year").value;
  const semester = document.getElementById("semester").value;

  resetSelect("subject2", "Loading subjects...");

  if(!schema || !year || !semester){
    resetSelect("subject2", "Select Subject");
    return;
  }

  try{
    const url = new URL(`${BASE_URL}/subject-catalog`);
    url.searchParams.set("schema", schema);
    url.searchParams.set("year", year);
    url.searchParams.set("semester", semester);

    const res = await fetch(url.toString());
    const data = await res.json();
    const subjects = Array.isArray(data.subjects) ? data.subjects : [];

    if(subjects.length === 0){
      resetSelect("subject2", "No subjects found");
      updateAnalyticsStatus("No Mumbai University subjects found for the selected filters.");
      return;
    }

    populateSelect(
      "subject2",
      subjects.map(subject => ({
        value: subject.subject_name,
        label: subject.label || `${subject.subject_code} ${subject.subject_name}`.trim()
      })),
      "Select Subject"
    );

    updateAnalyticsStatus(`Loaded ${subjects.length} Mumbai University subject option(s).`);
  }catch(error){
    console.error("Unable to load Mumbai University subjects", error);
    resetSelect("subject2", "Unable to load subjects");
    updateAnalyticsStatus("Unable to load Mumbai University subjects from the backend.");
  }
}

function handleAnalyticsFilterChange(){
  loadAnalyticsSemesters();
}

function handleAnalyticsSchemaChange(){
  populateAnalyticsYears();
}

async function handleUniversityChange(){
  const university = document.getElementById("university").value;
  const mumbaiFields = document.getElementById("mumbaiFields");
  const generalSubjectField = document.getElementById("generalSubjectField");

  resetSelect("subject", "Select Subject");
  resetSelect("subject2", "Select Subject");
  resetSelect("semester", "Select Semester");
  document.getElementById("schema").value = "";
  document.getElementById("year").value = "";

  if(university === "Mumbai University"){
    mumbaiFields.style.display = "block";
    generalSubjectField.style.display = "none";
    updateAnalyticsStatus("Choose schema, year, semester, and subject for Mumbai University.");
    return;
  }

  mumbaiFields.style.display = "none";
  generalSubjectField.style.display = "block";

  if(!university){
    updateAnalyticsStatus("Choose a university to start loading available subjects.");
    return;
  }

  await loadUniversitySubjects(university);
}

function resolveAnalyticsSubject(){
  const university = document.getElementById("university").value;
  return university === "Mumbai University"
    ? document.getElementById("subject2").value
    : document.getElementById("subject").value;
}

function renderTable(results){
  const table = document.querySelector("#copoTable tbody");

  if(!Array.isArray(results) || results.length === 0){
    table.innerHTML = `
      <tr>
        <td colspan="4" style="text-align:center; color:#64748b; padding:24px;">
          No mapping results available for the selected filters.
        </td>
      </tr>
    `;
    return;
  }

  table.innerHTML = results.map(result => {
    const mapped = (Array.isArray(result.mapping) ? result.mapping : []).slice(0, 3).map(item => {
      const cls = item.level === 3 ? "po-high" : item.level === 2 ? "po-medium" : "po-low";
      return `<span class="po-badge ${cls}">${item.po_code} (${Number(item.final_score || 0).toFixed(2)}%)</span>`;
    }).join(" ");

    return `
      <tr>
        <td><strong>${result.co || "-"}</strong></td>
        <td>${result.objective || "-"}</td>
        <td>${result.bloom || "-"}</td>
        <td>${mapped || "-"}</td>
      </tr>
    `;
  }).join("");
}

function destroyCharts(){
  if(chart1){
    chart1.destroy();
    chart1 = null;
  }
  if(chart2){
    chart2.destroy();
    chart2 = null;
  }
}

function renderCharts(results){
  destroyCharts();

  const poCounts = {};
  const bloomCounts = {};

  results.forEach(result => {
    const best = Array.isArray(result.mapping) && result.mapping.length ? result.mapping[0] : null;
    if(best && best.po_code){
      poCounts[best.po_code] = (poCounts[best.po_code] || 0) + 1;
    }

    const bloom = result.bloom || "Unknown";
    bloomCounts[bloom] = (bloomCounts[bloom] || 0) + 1;
  });

  chart1 = new Chart(document.getElementById("poLevelChart"), {
    type: "bar",
    data: {
      labels: Object.keys(poCounts),
      datasets: [
        {
          label: "CO count",
          data: Object.values(poCounts),
          backgroundColor: ["#2563eb", "#0ea5e9", "#14b8a6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#64748b", "#f97316", "#10b981"],
          borderRadius: 8
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0
          }
        }
      }
    }
  });

  chart2 = new Chart(document.getElementById("bloomChart"), {
    type: "doughnut",
    data: {
      labels: Object.keys(bloomCounts),
      datasets: [
        {
          data: Object.values(bloomCounts),
          backgroundColor: ["#2563eb", "#0ea5e9", "#14b8a6", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6"]
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom"
        }
      }
    }
  });
}

async function fetchData(){
  const university = document.getElementById("university").value;
  const subject = resolveAnalyticsSubject();

  if(!university){
    alert("Select university");
    return;
  }

  if(!subject){
    alert("Select subject");
    return;
  }

  updateAnalyticsStatus("Analyzing selected subject...");

  try{
    const url = new URL(`${BASE_URL}/analyze`);
    url.searchParams.set("university", university);
    url.searchParams.set("subject", subject);

    const res = await fetch(url.toString());
    const data = await res.json();

    if(!res.ok || data.status === "error"){
      throw new Error(data.msg || "Analysis failed");
    }

    const results = Array.isArray(data.results) ? data.results : [];
    renderTable(results);
    renderCharts(results);
    updateAnalyticsStatus(`Loaded analytics for ${subject}. ${results.length} course outcome(s) analyzed.`);
  }catch(error){
    console.error("Analytics error:", error);
    renderTable([]);
    destroyCharts();
    updateAnalyticsStatus(error.message || "Unable to analyze the selected subject.");
    alert(error.message || "Unable to analyze the selected subject.");
  }
}

