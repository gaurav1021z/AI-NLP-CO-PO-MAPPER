

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
let analyticsMumbaiCatalog = {};
const ANALYTICS_PO_PALETTE = ["#2563eb", "#f97316", "#ec4899", "#14b8a6", "#8b5cf6", "#22c55e"];
const ANALYTICS_PO_BADGE_CLASSES = ["po-rank-1", "po-rank-2", "po-rank-3"];
window.__pageResetKeys = [];

document.getElementById("facultyName").textContent =
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

  if(selectId === "subject2"){
    analyticsMumbaiCatalog = {};
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

    analyticsMumbaiCatalog = {};

    populateSelect(
      "subject2",
      subjects.map(subject => {
        analyticsMumbaiCatalog[subject.subject_code] = subject;
        return {
          value: subject.subject_code,
          label: subject.label || `${subject.subject_code} ${subject.subject_name}`.trim()
        };
      }),
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

function resolveAnalyticsPayload(){
  const university = document.getElementById("university").value;

  if(university === "Mumbai University"){
    const subjectCode = document.getElementById("subject2").value;
    const selectedSubject = analyticsMumbaiCatalog[subjectCode] || {};
    return {
      university,
      subject: selectedSubject.subject_name || "",
      subjectCode,
      schema: document.getElementById("schema").value
    };
  }

  return {
    university,
    subject: document.getElementById("subject").value,
    subjectCode: "",
    schema: ""
  };
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
    const mapped = (Array.isArray(result.mapping) ? result.mapping : []).map((item, index) => {
      const cls = ANALYTICS_PO_BADGE_CLASSES[index % ANALYTICS_PO_BADGE_CLASSES.length];
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
  const poNote = document.getElementById("poChartNote");
  const bloomNote = document.getElementById("bloomChartNote");

  results.forEach(result => {
    const best = Array.isArray(result.mapping) && result.mapping.length ? result.mapping[0] : null;
    if(best && best.po_code){
      poCounts[best.po_code] = (poCounts[best.po_code] || 0) + 1;
    }

    const bloom = result.bloom || "Unknown";
    bloomCounts[bloom] = (bloomCounts[bloom] || 0) + 1;
  });

  const sortedPoEntries = Object.entries(poCounts).sort((a, b) => {
    const aNum = parseInt(String(a[0]).replace("PO", ""), 10);
    const bNum = parseInt(String(b[0]).replace("PO", ""), 10);
    return aNum - bNum;
  });
  const sortedBloomEntries = Object.entries(bloomCounts).sort((a, b) => a[0].localeCompare(b[0]));

  if(poNote){
    poNote.textContent = "X-axis: PO code. Y-axis: count of COs whose top match is that PO.";
  }

  if(bloomNote){
    bloomNote.textContent = "Slice size shows how many COs belong to each Bloom level.";
  }

  chart1 = new Chart(document.getElementById("poLevelChart"), {
    type: "bar",
    data: {
      labels: sortedPoEntries.map(entry => entry[0]),
      datasets: [
        {
          label: "CO count",
          data: sortedPoEntries.map(entry => entry[1]),
          backgroundColor: sortedPoEntries.map((_, index) => ANALYTICS_PO_PALETTE[index % ANALYTICS_PO_PALETTE.length]),
          borderRadius: 8
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: "Primary PO Mapping"
        },
        legend: {
          display: false
        },
        tooltip: {
          callbacks: {
            label(context) {
              return `${context.label}: ${context.parsed.y} CO`;
            }
          }
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: "Program Outcomes"
          }
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: "CO Count"
          },
          ticks: {
            precision: 0,
            stepSize: 1
          }
        }
      }
    }
  });

  chart2 = new Chart(document.getElementById("bloomChart"), {
    type: "doughnut",
    data: {
      labels: sortedBloomEntries.map(entry => entry[0]),
      datasets: [
        {
          data: sortedBloomEntries.map(entry => entry[1]),
          backgroundColor: sortedBloomEntries.map((_, index) => ANALYTICS_PO_PALETTE[index % ANALYTICS_PO_PALETTE.length])
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        title: {
          display: true,
          text: "Bloom Level Distribution"
        },
        legend: {
          position: "bottom",
          labels: {
            boxWidth: 14,
            font: {
              size: 12
            }
          }
        },
        tooltip: {
          callbacks: {
            label(context) {
              const total = context.dataset.data.reduce((sum, value) => sum + value, 0) || 1;
              const count = context.parsed;
              const percentage = ((count / total) * 100).toFixed(1);
              return `${context.label}: ${count} CO (${percentage}%)`;
            }
          }
        }
      }
    }
  });
}

function saveAnalyticsSnapshot(){
  return;
}

function restoreAnalyticsSnapshot(){
  return false;
}

async function fetchData(){
  const payload = resolveAnalyticsPayload();
  const university = payload.university;
  const subject = payload.subject;

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
    if(payload.subjectCode){
      url.searchParams.set("subject_code", payload.subjectCode);
    }
    if(payload.schema){
      url.searchParams.set("schema", payload.schema);
    }

    const res = await fetch(url.toString());
    const data = await res.json();

    if(!res.ok || data.status === "error"){
      throw new Error(data.msg || "Analysis failed");
    }

    const results = Array.isArray(data.results) ? data.results : [];
    renderTable(results);
    renderCharts(results);
    updateAnalyticsStatus(`Loaded analytics for ${data.subject || subject}. ${results.length} course outcome(s) analyzed.`);
  }catch(error){
    console.error("Analytics error:", error);
    renderTable([]);
    destroyCharts();
    updateAnalyticsStatus(error.message || "Unable to analyze the selected subject.");
    alert(error.message || "Unable to analyze the selected subject.");
  }
}

handleUniversityChange();
renderTable([]);
destroyCharts();


