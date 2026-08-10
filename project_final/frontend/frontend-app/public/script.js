/* =========================================
   GLOBAL VARIABLES
========================================= */
const BASE_URL =
  window.API_BASE_URL || localStorage.getItem("apiBaseUrl") || "http://127.0.0.1:9000";
let poMode = "AICTE";
let courseEntryMode = "existing";
let savedDashboardSubjects = [];
let dashboardSubjectCatalog = {};
window.__pageResetKeys = ["mappingResult", "mappingId", "reportMetaCustomization", "facultyData"];

const DASHBOARD_YEAR_SEM_MAP = {
  FE: [1, 2],
  SE: [3, 4],
  TE: [5, 6],
  BE: [7, 8]
};

const DASHBOARD_SCHEMA_YEAR_MAP = {
  C: ["FE", "SE", "TE", "BE"],
  NEP: ["FE", "SE"]
};

const DASHBOARD_SUBJECTS_DATA = {
  C: {
    1: [
      "FEC101 Engineering Mathematics-I",
      "FEC102 Engineering Physics-I",
      "FEC103 Engineering Chemistry-I",
      "FEC104 Engineering Mechanics",
      "FEC105 Basic Electrical Engineering"
    ],
    2: [
      "FEC201 Engineering Mathematics-II",
      "FEC202 Engineering Physics-II",
      "FEC203 Engineering Chemistry-II",
      "FEC204 Engineering Graphics",
      "FEC205 C Programming",
      "FEC206 Professional Communication and Ethics-I"
    ],
    3: [
      "CSC301 Engineering Mathematics III",
      "CSC302 Discrete Structures",
      "CSC303 Data Structure",
      "CSC304 Digital Logic",
      "CSC305 Computer Graphics"
    ],
    4: [
      "CSC401 Engineering Mathematics IV",
      "CSC402 Analysis of Algorithm",
      "CSC403 Database Management System",
      "CSC404 Operating System",
      "CSC405 Microprocessor"
    ],
    5: [
    "CSC501 Theoretical Computer Science",
    "CSC502 Software Engineering",
    "CSC503 Computer Network",
    "CSC504 Data Warehousing & Mining",
    "CSDLO5011 Probabilistic Graphical Models",
    "CSDLO5012 Internet Programming",
    "CSDLO5013 Advance Database Management System"
  ],

  // ✅ SEM 6 UPDATED
  6: [
    "CSC601 System Programming & Compiler Construction",
    "CSC602 Cryptography & System Security",
    "CSC603 Mobile Computing",
    "CSC604 Artificial Intelligence",
    "CSDLO6011 Internet of Things",
    "CSDLO6012 Digital Signal & Image Processing",
    "CSDLO6013 Quantitative Analysis"
  ],

  // ✅ SEM 7 UPDATED
  7: [
    "CSC701 Machine Learning",
    "CSC702 Big Data Analytics",
    "CSDC7011 Machine Vision",
    "CSDC7012 Quantum Computing",
    "CSDC7013 Natural Language Processing",
    "SDC7021 Augmented and Virtual Reality",
    "CSDC7022 Block Chain",
    "CSDC7023 Information Retrieval",
    "ILO7011 Product Lifecycle Management",
    "ILO7012 Reliability Engineering",
    "ILO7013 Management Information System",
    "ILO7014 Design of Experiments",
    "ILO7015 Operation Research",
    "ILO7016 Cyber Security and Laws",
    "ILO7017 Disaster Management & Mitigation Measures",
    "ILO7018 Energy Audit and Management",
    "ILO7019 Development Engineering"
  ],

  // ✅ SEM 8 UPDATED
  8: [
    "CSC801 Distributed Computing",
    "CSDC8011 Deep Learning",
    "CSDC8012 Digital Forensic",
    "CSDC8013 Applied Data Science",
    "CSDC8021 Optimization in Machine Learning",
    "CSDC8022 High Performance Computing",
    "CSDC8023 Social Media Analytics",
    "ILO8021 Project Management",
    "ILO8022 Finance Management",
    "ILO8023 Entrepreneurship Development and Management",
    "ILO8024 Human Resource Management",
    "ILO8025 Professional Ethics and CSR",
    "ILO8026 Research Methodology",
    "ILO8027 IPR and Patenting",
    "ILO8028 Digital Business Management",
    "ILO8029 Environmental Management"
  ]
  },
  NEP: {
    FE: {
      1: [
        "BSC101 Applied Mathematics-I",
        "BSC102 Applied Physics-I",
        "BSC103 Applied Chemistry-I",
        "ESC101 Engineering Mechanics",
        "ESC102 Basic Electrical Engineering"
      ],
      2: [
        "BSC201 Applied Mathematics-II",
        "BSC202 Applied Physics-II",
        "BSC203 Applied Chemistry-II",
        "ESC201 Engineering Graphics",
        "ESC202 C Programming",
        "HSMC201 Professional Communication"
      ]
    },
    SE: {
      3: [
        "2113111 Mathematics for Computer Engineering",
        "2113112 Discrete Structures",
        "2113113 Data Structures",
        "2113114 Digital Logic",
        "2113115 Computer Graphics"
      ],
      4: [
        "2114111 Computational Theory",
        "2114112 Database Management System",
        "2114113 Operating System",
        "2114114 DBMS Lab",
        "2114115 OS Lab"
      ]
    }
  }
};

const ROMAN_SEMESTERS = {
  I: 1,
  II: 2,
  III: 3,
  IV: 4,
  V: 5,
  VI: 6,
  VII: 7,
  VIII: 8
};


/* =========================================
   TOGGLE PO MODE
========================================= */
function togglePO(show){
  const poPanel = document.getElementById("poPanel");
  const poBox = document.getElementById("poInput");
  const extractRadio = document.getElementById("extractModeRadio");

  if(poPanel){
    poPanel.style.display = show ? "block" : "none";
  }else if(poBox){
    poBox.style.display = show ? "block" : "none";
  }

  poMode = show ? "CUSTOM" : "AICTE";

  if(extractRadio){
    extractRadio.checked = false;
  }
  toggleExtractPanel(false);
}


function normalizeSemesterNumber(value){
  const raw = String(value || "").trim();

  if(!raw){
    return "";
  }

  const digitMatch = raw.match(/(\d+)/);
  if(digitMatch){
    return digitMatch[1];
  }

  const romanMatch = raw.toUpperCase().match(/\b(I|II|III|IV|V|VI|VII|VIII)\b/);
  if(romanMatch){
    return String(ROMAN_SEMESTERS[romanMatch[1]] || "");
  }

  return "";
}


function formatSemesterLabel(value){
  const raw = String(value || "").trim();
  if(!raw){
    return "";
  }
  if(/^sem/i.test(raw)){
    return raw;
  }
  return `Semester ${raw}`;
}


function parseSubjectDetails(subjectLabel, semesterValue){
  const cleaned = String(subjectLabel || "").trim();
  let courseCode = "";
  let courseName = cleaned;

  const parts = cleaned.match(/^([A-Za-z0-9-]{3,})\s+(.+)$/);
  if(parts && (/\d/.test(parts[1]) || /^[A-Z]{3,}[A-Z0-9-]*$/.test(parts[1]))){
    courseCode = parts[1];
    courseName = parts[2].trim();
  }

  return {
    course_name: courseName || cleaned,
    course_code: courseCode,
    semester: formatSemesterLabel(semesterValue),
    subject: courseName || cleaned
  };
}


function resetCoursePreview(){
  const previewIds = [
    "previewCourseName",
    "previewCourseCode",
    "previewSemester",
    "previewSubject"
  ];

  previewIds.forEach(id => {
    const node = document.getElementById(id);
    if(node){
      node.textContent = "-";
    }
  });
}


function updateCoursePreview(details){
  const values = {
    previewCourseName: details.course_name || "-",
    previewCourseCode: details.course_code || "-",
    previewSemester: details.semester || "-",
    previewSubject: details.subject || "-"
  };

  Object.entries(values).forEach(([id, value]) => {
    const node = document.getElementById(id);
    if(node){
      node.textContent = value;
    }
  });
}


function setCourseEntryMode(mode){
  const previousMode = courseEntryMode;
  let selectedDetails = null;

  if(mode === "manual" && previousMode === "existing"){
    const select = document.getElementById("dashboardSubjectSelect");
    if(select && select.value){
      selectedDetails = dashboardSubjectCatalog[select.value] || null;
    }
  }

  courseEntryMode = mode === "manual" ? "manual" : "existing";

  const existingPanel = document.getElementById("existingSubjectPanel");
  const manualPanel = document.getElementById("manualSubjectPanel");
  const existingBtn = document.getElementById("existingModeBtn");
  const manualBtn = document.getElementById("manualModeBtn");

  if(existingPanel){
    existingPanel.style.display = courseEntryMode === "existing" ? "block" : "none";
  }
  if(manualPanel){
    manualPanel.style.display = courseEntryMode === "manual" ? "block" : "none";
  }
  if(existingBtn){
    existingBtn.classList.toggle("active", courseEntryMode === "existing");
  }
  if(manualBtn){
    manualBtn.classList.toggle("active", courseEntryMode === "manual");
  }

  if(courseEntryMode === "manual" && selectedDetails){
      const manualCourseName = document.getElementById("manualCourseName");
      const manualCourseCode = document.getElementById("manualCourseCode");
      const manualSemester = document.getElementById("manualSemester");
      const manualSubject = document.getElementById("manualSubject");

      if(manualCourseName) manualCourseName.value = selectedDetails.course_name || "";
      if(manualCourseCode) manualCourseCode.value = selectedDetails.course_code || "";
      if(manualSemester) manualSemester.value = selectedDetails.semester || "";
      if(manualSubject) manualSubject.value = selectedDetails.subject || "";
  }
}


function getBuiltInSubjects(schema, year, semester){
  if(!schema || !year || !semester){
    return [];
  }

  if(schema === "C"){
    return DASHBOARD_SUBJECTS_DATA.C?.[Number(semester)] || [];
  }

  if(schema === "NEP"){
    return DASHBOARD_SUBJECTS_DATA.NEP?.[year]?.[Number(semester)] || [];
  }

  return [];
}


async function fetchSubjectCatalog(schema, year, semester){
  const url = new URL(`${BASE_URL}/subject-catalog`);
  url.searchParams.set("schema", schema);
  url.searchParams.set("year", year);
  url.searchParams.set("semester", semester);

  const res = await fetch(url.toString());
  if(!res.ok){
    throw new Error("Unable to load subject catalog");
  }

  const data = await res.json();
  return Array.isArray(data.subjects) ? data.subjects : [];
}


async function loadSavedDashboardSubjects(){
  const select = document.getElementById("dashboardSubjectSelect");

  if(!select){
    return;
  }

  try{
    const res = await fetch(`${BASE_URL}/subjects`);
    const data = await res.json();
    savedDashboardSubjects = Array.isArray(data) ? data : [];
  }catch(error){
    console.error("Unable to load saved subjects", error);
    savedDashboardSubjects = [];
  }
}


function populateDashboardYears(){
  const schema = document.getElementById("dashboardSchema")?.value || "";
  const yearSelect = document.getElementById("dashboardYear");
  const semesterSelect = document.getElementById("dashboardSemester");
  const subjectSelect = document.getElementById("dashboardSubjectSelect");

  if(!yearSelect || !semesterSelect || !subjectSelect){
    return;
  }

  yearSelect.innerHTML = '<option value="">Select Year</option>';
  semesterSelect.innerHTML = '<option value="">Select Semester</option>';
  subjectSelect.innerHTML = '<option value="">Select Subject</option>';
  dashboardSubjectCatalog = {};
  resetCoursePreview();

  if(!schema){
    return;
  }

  (DASHBOARD_SCHEMA_YEAR_MAP[schema] || []).forEach(year => {
    yearSelect.innerHTML += `<option value="${year}">${year}</option>`;
  });
}


function renderLastResultCard(){
  const card = document.getElementById("resumeResultCard");
  const text = document.getElementById("resumeResultText");

  if(!card || !text){
    return;
  }

  try{
    const raw = localStorage.getItem("mappingResult");
    if(!raw){
      card.classList.remove("show");
      return;
    }

    const data = JSON.parse(raw);
    const courseName = data?.course_name || "Selected course";
    const subject = data?.subject || "Selected subject";
    const generatedAt = data?.generated_at ? new Date(data.generated_at) : null;
    const generatedText = generatedAt && !Number.isNaN(generatedAt.getTime())
      ? generatedAt.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
      : "recently";

    text.textContent = `${courseName} - ${subject}. Last mapping generated ${generatedText}.`;
    card.classList.add("show");
  }catch(error){
    console.warn("Unable to read last mapping result", error);
    card.classList.remove("show");
  }
}

function openLastResult(){
  if(localStorage.getItem("mappingResult")){
    window.location.href = "result.html";
  }else{
    alert("No saved result found yet.");
  }
}

function dismissLastResult(){
  const card = document.getElementById("resumeResultCard");
  if(card){
    card.classList.remove("show");
  }
}


function handleDashboardSchemaChange(){
  populateDashboardYears();
}


function loadDashboardSemesters(){
  const year = document.getElementById("dashboardYear")?.value || "";
  const semesterSelect = document.getElementById("dashboardSemester");
  const subjectSelect = document.getElementById("dashboardSubjectSelect");

  if(!semesterSelect || !subjectSelect){
    return;
  }

  semesterSelect.innerHTML = '<option value="">Select Semester</option>';
  subjectSelect.innerHTML = '<option value="">Select Subject</option>';
  dashboardSubjectCatalog = {};
  resetCoursePreview();

  if(!year){
    return;
  }

  (DASHBOARD_YEAR_SEM_MAP[year] || []).forEach(semester => {
    semesterSelect.innerHTML += `<option value="${semester}">Semester ${semester}</option>`;
  });
}


async function loadDashboardSubjects(){
  const schema = document.getElementById("dashboardSchema")?.value || "";
  const year = document.getElementById("dashboardYear")?.value || "";
  const semester = document.getElementById("dashboardSemester")?.value || "";
  const subjectSelect = document.getElementById("dashboardSubjectSelect");

  if(!subjectSelect){
    return;
  }

  subjectSelect.innerHTML = '<option value="">Select Subject</option>';
  dashboardSubjectCatalog = {};
  resetCoursePreview();

  if(!schema || !year || !semester){
    return;
  }

  let builtInSubjects = [];

  try{
    builtInSubjects = await fetchSubjectCatalog(schema, year, semester);
  }catch(error){
    console.error("Unable to load official subject catalog, using fallback list.", error);
    builtInSubjects = getBuiltInSubjects(schema, year, semester).map(subjectLabel => {
      const details = parseSubjectDetails(subjectLabel, semester);
      return {
        subject_code: details.course_code,
        subject_name: details.subject,
        semester: Number(semester),
        year: year,
        label: subjectLabel
      };
    });
  }

  const relevantSavedSubjects = savedDashboardSubjects.filter(subject => {
    return normalizeSemesterNumber(subject.semester) === String(semester);
  });
  const seen = new Set();

  builtInSubjects.forEach((subjectItem, index) => {
    const key = `builtin-${index}`;
    const subjectLabel = subjectItem.label || `${subjectItem.subject_code || ""} ${subjectItem.subject_name || ""}`.trim();
    const details = {
      course_name: subjectItem.subject_name || parseSubjectDetails(subjectLabel, semester).course_name,
      course_code: subjectItem.subject_code || parseSubjectDetails(subjectLabel, semester).course_code,
      semester: formatSemesterLabel(subjectItem.semester || semester),
      subject: subjectItem.subject_name || parseSubjectDetails(subjectLabel, semester).subject
    };
    const dedupeKey = `${details.course_name.toLowerCase()}-${details.semester.toLowerCase()}`;

    if(seen.has(dedupeKey)){
      return;
    }

    seen.add(dedupeKey);
    dashboardSubjectCatalog[key] = details;
    subjectSelect.innerHTML += `<option value="${key}">${subjectLabel}</option>`;
  });

  relevantSavedSubjects.forEach(subject => {
    const key = `saved-${subject._id}`;
    const parsedSemester = normalizeSemesterNumber(subject.semester) || semester;
    const details = parseSubjectDetails(subject.subjectName || "", parsedSemester);
    details.semester = subject.semester || formatSemesterLabel(parsedSemester);
    const dedupeKey = `${details.course_name.toLowerCase()}-${details.semester.toLowerCase()}`;

    if(seen.has(dedupeKey)){
      return;
    }

    seen.add(dedupeKey);
    dashboardSubjectCatalog[key] = details;
    subjectSelect.innerHTML += `<option value="${key}">${subject.subjectName} (Saved)</option>`;
  });
}


function handleDashboardSubjectChange(){
  const select = document.getElementById("dashboardSubjectSelect");

  if(!select || !select.value){
    resetCoursePreview();
    return;
  }

  const details = dashboardSubjectCatalog[select.value];

  if(!details){
    resetCoursePreview();
    return;
  }

  updateCoursePreview(details);
}


function getCurrentCourseDetails(){
  if(courseEntryMode === "manual"){
    return {
      course_name: document.getElementById("manualCourseName")?.value.trim() || "",
      course_code: document.getElementById("manualCourseCode")?.value.trim() || "",
      semester: document.getElementById("manualSemester")?.value.trim() || "",
      subject: document.getElementById("manualSubject")?.value.trim() || ""
    };
  }

  const select = document.getElementById("dashboardSubjectSelect");
  if(!select || !select.value){
    return null;
  }

  return dashboardSubjectCatalog[select.value] || null;
}


document.addEventListener("DOMContentLoaded", async () => {
  const schemaSelect = document.getElementById("dashboardSchema");

  if(!schemaSelect){
    return;
  }

  await loadSavedDashboardSubjects();
  setCourseEntryMode("existing");
  togglePO(false);
  toggleExtractPanel(false);
  populateDashboardYears();
  resetCoursePreview();
  renderLastResultCard();
});

function parseStructuredEntries(rawText, options = {}){
  const text = String(rawText || "").replace(/\r/g, "").trim();
  const mode = options.mode || "line";

  if(!text){
    return [];
  }

  const lines = text
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);

  if(lines.length === 0){
    return [];
  }

  const numberedPattern = mode === "co"
    ? /^\s*(?:co\s*)?(\d+)\s*[\.\):\-]?\s*(.+)?$/i
    : /^\s*(\d+)\s*[\.\):\-]?\s*(.+)?$/i;

  const hasNumberedStructure = lines.some(line => numberedPattern.test(line));

  if(hasNumberedStructure){
    const items = [];
    let current = "";

    lines.forEach(line => {
      const match = line.match(numberedPattern);

      if(match){
        if(current.trim()){
          items.push(current.trim().replace(/\s+/g, " "));
        }
        current = (match[2] || "").trim();
      }else{
        current = current ? `${current} ${line}` : line;
      }
    });

    if(current.trim()){
      items.push(current.trim().replace(/\s+/g, " "));
    }

    return items.filter(Boolean);
  }

  return lines.map(line => line.replace(/\s+/g, " ").trim()).filter(Boolean);
}


function toggleExtractPanel(forceOpen){
  const panel = document.getElementById("syllabusDropZone");
  const option = document.getElementById("extractModeOption");
  const radio = document.getElementById("extractModeRadio");

  if(!panel){
    return;
  }

  const shouldShow = typeof forceOpen === "boolean"
    ? forceOpen
    : panel.classList.contains("hidden");

  panel.classList.toggle("hidden", !shouldShow);
  if(option){
    option.classList.toggle("active", shouldShow);
  }
  if(radio){
    radio.checked = shouldShow;
  }

  if(shouldShow){
    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
}


function setSyllabusImageFile(file){
  const fileInput = document.getElementById("syllabusImageInput");
  const statusNode = document.getElementById("ocrStatus");
  const fileName = String(file?.name || "").toLowerCase();
  const isImage = !!file?.type && file.type.startsWith("image/");
  const isPdf = (!!file?.type && file.type.includes("pdf")) || fileName.endsWith(".pdf");

  if(!file || !fileInput){
    return false;
  }

  if(!isImage && !isPdf){
    alert("Please upload a syllabus image or PDF file only.");
    return false;
  }

  const transfer = new DataTransfer();
  transfer.items.add(file);
  fileInput.files = transfer.files;

  if(statusNode){
    statusNode.textContent = `${file.name} selected. Click Extract COs to fill the Course Outcomes box.`;
  }

  return true;
}


function handleSyllabusImageSelect(){
  const fileInput = document.getElementById("syllabusImageInput");
  const file = fileInput?.files?.[0];

  if(file){
    setSyllabusImageFile(file);
  }
}


function handleSyllabusDragOver(event){
  event.preventDefault();
  event.stopPropagation();
  document.getElementById("syllabusDropZone")?.classList.add("drag-over");
}


function handleSyllabusDragLeave(event){
  event.preventDefault();
  event.stopPropagation();
  document.getElementById("syllabusDropZone")?.classList.remove("drag-over");
}


function handleSyllabusDrop(event){
  event.preventDefault();
  event.stopPropagation();
  document.getElementById("syllabusDropZone")?.classList.remove("drag-over");

  const file = event.dataTransfer?.files?.[0];

  setSyllabusImageFile(file);
}


async function extractCourseOutcomesFromImage(){
  const fileInput = document.getElementById("syllabusImageInput");
  const coInput = document.getElementById("coInput");
  const statusNode = document.getElementById("ocrStatus");
  const button = document.getElementById("extractCoButton");

  if(!fileInput || !coInput){
    alert("Image upload or CO input box not found.");
    return;
  }

  const file = fileInput.files && fileInput.files[0];

  if(!file){
    alert("Please select a syllabus image or PDF first.");
    return;
  }

  const formData = new FormData();
  formData.append("file", file);

  if(statusNode){
    statusNode.textContent = "Reading syllabus file and extracting course outcomes...";
  }
  if(button){
    button.disabled = true;
    button.textContent = "Extracting...";
  }

  try{
    const res = await fetch(`${BASE_URL}/extract-course-outcomes-file`, {
      method: "POST",
      body: formData
    });

    const data = await res.json();

    if(!res.ok){
      throw new Error(data.detail || "Unable to extract COs from the selected file.");
    }

    const courseOutcomes = Array.isArray(data.course_outcomes)
      ? data.course_outcomes.filter(Boolean)
      : [];
    const sectionLabel = String(data.section_label || "Course Outcomes").trim() || "Course Outcomes";

    if(courseOutcomes.length === 0){
      console.warn("OCR raw text:", data.raw_text || "");
      if(statusNode){
        statusNode.textContent = "The file was read, but a clear Course Outcomes / Course Objectives section was not found. Try uploading a cleaner section area or use manual entry.";
      }
      alert("No clear Course Outcomes / Course Objectives section was detected in this syllabus file.");
      return;
    }

    const formattedOutcomes = courseOutcomes
      .map((co, index) => `${index + 1}. ${String(co || "").trim()}`)
      .filter(Boolean)
      .join("\n");

    const currentText = coInput.value.trim();
    const shouldReplace = !currentText || confirm("Replace current CO text with extracted COs? Click Cancel to append instead.");

    coInput.value = shouldReplace
      ? formattedOutcomes
      : `${currentText}\n${formattedOutcomes}`;

    if(statusNode){
      statusNode.textContent = `Extracted ${courseOutcomes.length} point(s) from the ${sectionLabel} section in the uploaded ${data.source_type || "file"}.`;
    }

    coInput.focus();
  }catch(error){
    console.error(error);
    if(statusNode){
      statusNode.textContent = error.message;
    }
    alert(error.message);
  }finally{
    if(button){
      button.disabled = false;
      button.textContent = "Extract COs";
    }
  }
}


/* =========================================
   🔥 GENERATE MAPPING (FINAL)
========================================= */
async function generateMapping(){

  const coInput = document.getElementById("coInput");

  if(!coInput){
    alert("CO input not found");
    return;
  }

  const cos = parseStructuredEntries(coInput.value, {mode:"co"});

  if(cos.length === 0){
    alert("Enter at least one CO");
    return;
  }

  const courseDetails = getCurrentCourseDetails();

  if(!courseDetails){
    alert("Select a subject first or switch to manual entry.");
    return;
  }

  if(!courseDetails.course_name || !courseDetails.semester || !courseDetails.subject){
    alert("Please complete the course details before generating mapping.");
    return;
  }

  let pos = [];

  if(poMode === "CUSTOM"){
    const poInput = document.getElementById("poInput");

    if(poInput){
      pos = parseStructuredEntries(poInput.value, {mode:"po"});
    }
  }

  const payload = {
    cos: cos,
    pos: pos,
    mode: poMode,
    faculty_name: localStorage.getItem("facultyName") || "",
    course_outcomes_input_raw: coInput.value || "",
    custom_pos_input_raw: document.getElementById("poInput")?.value || "",
    generated_at: new Date().toISOString(),

    // 🔥 COURSE DETAILS
    course_name: courseDetails.course_name,
    course_code: courseDetails.course_code || "",
    semester: courseDetails.semester,
    subject: courseDetails.subject
  };

  try{

    const res = await fetch(`${BASE_URL}/map`,{
      method:"POST", 
      headers:{ "Content-Type":"application/json"},
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => ({}));

    console.log("MAP RESPONSE:", data);

    if(!res.ok){
      throw new Error(data.detail || data.msg || `Backend error ${res.status}`);
    }

    if(!data.id){
      alert(data.detail || data.msg || "Error: Mapping ID not received. Please restart backend and try again.");
      console.log("ful response:", data);
      return;
    }

    // 🔥 SAVE EVERYTHING
    const enrichedData = {
      ...data,
      faculty_name: data.faculty_name || payload.faculty_name,
      course_name: data.course_name || payload.course_name,
      course_code: data.course_code || payload.course_code,
      semester: data.semester || payload.semester,
      subject: data.subject || payload.subject,
      course_outcomes: Array.isArray(data.course_outcomes) ? data.course_outcomes : cos,
      custom_pos: Array.isArray(data.custom_pos) ? data.custom_pos : pos,
      course_outcomes_input_raw: data.course_outcomes_input_raw || payload.course_outcomes_input_raw,
      custom_pos_input_raw: data.custom_pos_input_raw || payload.custom_pos_input_raw,
      generated_at: data.generated_at || payload.generated_at
    };

    localStorage.setItem("mappingId", data.id);
    localStorage.setItem("mappingResult", JSON.stringify(enrichedData));

    window.location.href="result.html";

  }catch(err){
    console.error(err);
    alert("Backend error: " + (err.message || "Please restart backend and try again."));
  }

}


/* =========================================
   LOGIN
========================================= */
function loginUser(){

  const email=document.getElementById("email").value;
  const pass=document.getElementById("password").value;

  if(!email || !pass){
    alert("Fill all fields");
    return;
  }

  fetch(`${BASE_URL}/login`,{
    method:"POST",
    headers:{ "Content-Type":"application/json"},
    body:JSON.stringify({email,password:pass})
  })
  .then(res=>res.json())
  .then(data=>{

    if(data.status==="success"){

      localStorage.setItem("loggedIn","true");
      localStorage.setItem("facultyName",data.name);
      localStorage.setItem("facultyEmail",email);

      window.location.href="dashboard.html";

    }else{
      alert(data.msg || "Login failed");
    }

  })
  .catch(()=>{
    alert("Backend not reachable!");
  });

}


/* =========================================
   SIGNUP
========================================= */
function signupUser(){

  const name=document.getElementById("signupName").value;
  const email=document.getElementById("signupEmail").value;
  const pass=document.getElementById("signupPassword").value;

  if(!name || !email || !pass){
    alert("Fill all fields");
    return;
  }

  fetch(`${BASE_URL}/signup`,{
    method:"POST",
    headers:{ "Content-Type":"application/json"},
    body:JSON.stringify({
      name:name,
      email:email,
      department:"Computer Engineering",
      password:pass
    })
  })
  .then(res=>res.json())
  .then(data=>{

    if(data.status==="success"){
      alert("Signup successful");
      window.location.href="login.html";
    }else{
      alert(data.msg || "Signup failed");
    }

  })
  .catch(()=>{
    alert("Backend not reachable!");
  });

}


/* =========================================
   RESULT PAGE LOAD (DB BASED)
========================================= */
document.addEventListener("DOMContentLoaded", async () => {

  const tbody = document.getElementById("justificationBody");
  const matrixTable = document.getElementById("matrixTable");

  if(!tbody || !matrixTable) return;

  const id = localStorage.getItem("mappingId");

  if(!id){
    alert("No mapping ID found ❌");
    return;
  }

  const res = await fetch(`${BASE_URL}/get-mapping/${id}`);
  const data = await res.json();

  console.log("LOADED DATA:", data);

  tbody.innerHTML="";
  matrixTable.innerHTML="";


  /* =========================================
     JUSTIFICATION TABLE
  ========================================= */

  data.results.forEach(co=>{

    co.mapping.forEach(m=>{
      const selectedJustification = m.justification || m.reason || "-";

      const row=`
      <tr>
        <td>${co.co}</td>
        <td>${m.po_code}</td>
        <td>${co.bloom}</td>
        <td>${m.level}</td>
        <td>${m.final_score}%</td>

        <td>
          <div class="reason-cell">

            <span>${selectedJustification}</span>

            <span class="edit-icon"
            onclick="openEditForm('${co.co}','${m.po_code}',\`${selectedJustification}\`)">
            ✏️
            </span>

          </div>
        </td>

      </tr>
      `;

      tbody.innerHTML+=row;

    });

  });


  /* =========================================
     MATRIX TABLE
  ========================================= */

  const poList = Array.from(
    new Set(
      [
        ...(data.po_catalog || []).map(po => po.code),
        ...data.results.flatMap(co => co.mapping.map(m => m.po_code))
      ]
    )
  ).sort((a, b) => {
    const aNumber = parseInt(String(a).replace("PO", ""), 10);
    const bNumber = parseInt(String(b).replace("PO", ""), 10);
    return aNumber - bNumber;
  });

  let header="<tr><th>CO \\ PO</th>";

  poList.forEach(po=>{
    header+=`<th>${po}</th>`;
  });

  header+="</tr>";

  matrixTable.innerHTML=header;


  data.results.forEach(co=>{

    let row=`<tr><th>${co.co}</th>`;

    poList.forEach(po=>{

      const match=co.mapping.find(m=>m.po_code===po);

      if(match){

        row+=`
        <td>
          <div class="matrix-cell">

            <div class="ai-level">
              AI: ${match.level}
            </div>

            <select class="teacher-select">
              <option value="">--</option>
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
            </select>

          </div>
        </td>
        `;

      }else{
        row+=`<td>-</td>`;
      }

    });

    row+="</tr>";

    matrixTable.innerHTML+=row;

  });

});


/* =========================================
   UPDATE JUSTIFICATION
========================================= */
function openEditForm(co, po, currentJustification){
  const nextJustification = window.prompt("Edit justification", currentJustification);

  if(nextJustification === null){
    return;
  }

  const id = localStorage.getItem("mappingId");

  fetch(`${BASE_URL}/update-justification`,{
    method:"POST",
    headers:{
      "Content-Type":"application/json"
    },
    body:JSON.stringify({
      id:id,
      co:co,
      po:po,
      justification:nextJustification,
      reason:nextJustification
    })
  })
  .then(res=>res.json())
  .then(()=>{
    alert("Updated Successfully");
    location.reload();
  });
}

function submitEdit(){

  const id = localStorage.getItem("mappingId");
  const co = document.getElementById("editCO").value;
  const po = document.getElementById("editPO").value;
  const justification = document.getElementById("editReason").value;

  fetch(`${BASE_URL}/update-justification`,{
    method:"POST",
    headers:{
      "Content-Type":"application/json"
    },
    body:JSON.stringify({
      id:id,
      co:co,
      po:po,
      justification:justification,
      reason:justification
    })
  })
  .then(res=>res.json())
  .then(()=>{
    alert("Updated Successfully ✅");
    location.reload();
  });

}


/* =========================================
   GRAPH
========================================= */
function generateGraph(){

const stored = localStorage.getItem("mappingResult");

if(!stored){
alert("No data available");
return;
}

const data = JSON.parse(stored);

let poScores = {};

data.results.forEach(co=>{
co.mapping.forEach(m=>{
if(!poScores[m.po_code]){
poScores[m.po_code]=0;
}
poScores[m.po_code]+=m.level;
});
});

const labels = Object.keys(poScores);
const values = Object.values(poScores);

const ctx = document.getElementById("chartCanvas").getContext("2d");

if(window.myChart){
window.myChart.destroy();
}

window.myChart = new Chart(ctx,{
type:"bar",
data:{
labels:labels,
datasets:[{
label:"CO-PO Mapping Strength",
data:values
}]
}
});

}


/* =========================================
   DOWNLOAD PDF
========================================= */
function downloadPDF(){

const stored = localStorage.getItem("mappingResult");
if(!stored){
alert("No data");
return;
}

const data = JSON.parse(stored);

let html = "";

/* 🔥 CO wise sections */
data.results.forEach(co=>{

html += `
<div class="co-section">

<h2>${co.co} (Bloom: ${co.bloom})</h2>

<table border="1" style="width:100%; border-collapse:collapse">

<tr>
<th>PO</th>
<th>Level</th>
<th>Confidence</th>
<th>Justification</th>
</tr>
`;

co.mapping.forEach(m=>{

html += `
<tr>
<td>${m.po_code}</td>
<td>${m.level}</td>
<td>${m.final_score}%</td>
<td>${m.justification || m.reason || "-"}</td>
</tr>
`;

});

html += `</table></div>`;
});

let pdfDiv = document.getElementById("pdfContent");
if(!pdfDiv){
  pdfDiv = document.createElement("div");
  pdfDiv.id = "pdfContent";
  pdfDiv.style.display = "none";
  document.body.appendChild(pdfDiv);
}
pdfDiv.innerHTML = html;
pdfDiv.style.display = "block";

/* 🔥 GRAPH ADD */
const canvas = document.getElementById("chartCanvas");

if(canvas){
const img = canvas.toDataURL("image/png");

pdfDiv.innerHTML += `
<div class="co-section">
<h2>Analytics Graph</h2>
<img src="${img}" style="width:100%">
</div>
`;
}

/* 🔥 PDF OPTIONS (IMPORTANT FIX) */
const opt = {
margin: 0.5,
filename: "CO_PO_Report.pdf",
image: { type: 'jpeg', quality: 1 },
html2canvas: {
scale: 3,
scrollY: 0
},
jsPDF: {
unit: 'mm',
format: 'a4',
orientation: 'portrait'
},
pagebreak: { mode: ['css','legacy'] }
};

html2pdf().set(opt).from(pdfDiv).save();

pdfDiv.style.display = "none";

}
/* save faculty rating (IMPORTANT FIX) */
function saveFacultyRatings(){

  const id = localStorage.getItem("mappingId");

  if(!id){
    alert("Mapping ID missing ❌");
    return;
  }

  const selects = document.querySelectorAll(".teacher-select");

  let ratings = [];

  selects.forEach(s=>{
    ratings.push(s.value || "0");
  });

  fetch(`${BASE_URL}/save-faculty`,{
    method:"POST",
    headers:{
      "Content-Type":"application/json"
    },
    body:JSON.stringify({
      id:id,
      ratings:ratings
    })
  })
  .then(res=>res.json())
  .then(()=>{
    alert("Faculty Ratings Saved ✅");
  })
}

/* =========================================
   LOGOUT
========================================= */
function logout(){
  localStorage.clear();
  window.location.href="login.html";
}
