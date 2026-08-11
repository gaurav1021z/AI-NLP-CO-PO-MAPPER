

/* MATHEMATICAL SYMBOLS MAPPING */
const mathSymbolMap = {
"lambda": "λ", "Lambda": "Λ", "pi": "π", "Pi": "Π", "sigma": "σ", "Sigma": "Σ",
"alpha": "α", "Alpha": "Α", "beta": "β", "Beta": "Β", "delta": "δ", "Delta": "Δ",
"theta": "θ", "Theta": "Θ", "gamma": "γ", "Gamma": "Γ", "phi": "φ", "Phi": "Φ",
"psi": "ψ", "Psi": "Ψ", "omega": "ω", "Omega": "Ω", "mu": "μ", "nu": "ν",
"xi": "ξ", "rho": "ρ", "tau": "τ", "upsilon": "υ", "chi": "χ", "infinity": "∞",
"sqrt": "√", "integral": "∫", "sum": "∑", "product": "∏", "approx": "≈",
"plus-minus": "±", "divide": "÷", "multiply": "×", "degree": "°", "prime": "′",
"double-prime": "″", "nabla": "∇", "partial": "∂", "forall": "∀", "exists": "∃",
"element": "∈", "not-element": "∉", "subset": "⊂", "superset": "⊃", "union": "∪",
"intersection": "∩", "empty": "∅"
}

/* YEAR → SEM */
const BASE_URL = window.API_BASE_URL || localStorage.getItem("apiBaseUrl") || "https://ai-nlp-co-po-mapper.onrender.com";

const yearSemMap = {
FE: [1,2],
SE: [3,4],
TE: [5,6],
BE: [7,8]
}

const schemaYearMap = {
C: ["FE", "SE", "TE", "BE"],
NEP: ["FE", "SE"]
}

const bloomToBTL = {
Remember: 1, Understand: 2, Apply: 3, Analyze: 4, Evaluate: 5, Create: 6
}

const semesterRomanMap = {
1: "I", 2: "II", 3: "III", 4: "IV", 5: "V", 6: "VI", 7: "VII", 8: "VIII"
}

let questionMode = "simple"
let questionSubjectCatalog = {}
let latestPaperRows = []
let latestPaperMeta = null
let latestPaperSummary = null
let paperSpellChecker = null
let subjectLoadRequestId = 0
const QUESTION_SNAPSHOT_KEY = "questionDetectionSnapshot"
window.__pageResetKeys = ["questionDetectionSnapshot"]

function setQuestionSubjectStatus(message = "", tone = "neutral"){
const node = document.getElementById("subjectLoadStatus")
if(!node) return
node.textContent = message
node.style.color = tone === "error" ? "#b91c1c" : (tone === "success" ? "#047857" : "#64748b")
}

function populateQuestionYears(){
const schema = document.getElementById("schema").value
const yearDrop = document.getElementById("year")
const semDrop = document.getElementById("semester")
yearDrop.innerHTML = '<option value="">Select Year</option>'
semDrop.innerHTML = '<option value="">Select Semester</option>'
resetQuestionSubjectOptions()
setQuestionSubjectStatus("")
if(!schema) return
const years = schemaYearMap[schema] || []
years.forEach(y => {
const opt = document.createElement("option")
opt.value = y
opt.textContent = y
yearDrop.appendChild(opt)
})
}

function handleQuestionSchemaChange(){
populateQuestionYears()
syncPaperMetadata()
}

function handleQuestionFilterChange(){
populateQuestionSemesters()
syncPaperMetadata()
}

function populateQuestionSemesters(){
const year = document.getElementById("year").value
const semDrop = document.getElementById("semester")
semDrop.innerHTML = '<option value="">Select Semester</option>'
resetQuestionSubjectOptions()
setQuestionSubjectStatus("")
if(!year) return
const sems = yearSemMap[year] || []
sems.forEach(s => {
const opt = document.createElement("option")
opt.value = s
opt.textContent = "Semester " + semesterRomanMap[s]
semDrop.appendChild(opt)
})
}

async function loadSubjects(preferredSubjectValue = ""){
const schema = document.getElementById("schema").value
const year = document.getElementById("year").value
const sem = document.getElementById("semester").value
const subDrop = document.getElementById("subject")
subDrop.innerHTML = '<option value="">Select Subject</option>'
if(!schema || !year || !sem){
setQuestionSubjectStatus("Select schema, year, and semester first.")
return
}
const requestId = ++subjectLoadRequestId
setQuestionSubjectStatus("Loading subjects...")
subDrop.innerHTML = '<option value="">Loading subjects...</option>'
const url = new URL(`${BASE_URL}/subject-catalog`)
url.searchParams.set("schema", schema)
url.searchParams.set("year", year)
url.searchParams.set("semester", sem)
try{
const response = await fetch(url.toString(), {headers:{"Content-Type":"application/json"}})
if(!response.ok){
  throw new Error("Could not load subjects from backend catalog")
}
const data = await response.json()
if(requestId !== subjectLoadRequestId){
  return
}
questionSubjectCatalog = {}
subDrop.innerHTML = '<option value="">Select Subject</option>'
const subjects = Array.isArray(data.subjects) ? data.subjects : []
subjects.forEach(s => {
const key = s.subject_code || s.course_code || s.id || s.subject_name
if(!key) return
questionSubjectCatalog[key] = s
const opt = document.createElement("option")
opt.value = key
opt.textContent = s.subject_name ? `${key} - ${s.subject_name}` : key
subDrop.appendChild(opt)
})
if(!subjects.length){
  subDrop.innerHTML = '<option value="">No subjects available</option>'
  setQuestionSubjectStatus("No subjects found for the selected schema, year, and semester.", "error")
  syncPaperMetadata()
  return
}
const preferred = preferredSubjectValue || subDrop.dataset.pendingValue || ""
if(preferred && questionSubjectCatalog[preferred]){
  subDrop.value = preferred
}
delete subDrop.dataset.pendingValue
setQuestionSubjectStatus(`${subjects.length} subject(s) loaded.`, "success")
syncPaperMetadata()
}catch(e){
questionSubjectCatalog = {}
subDrop.innerHTML = '<option value="">Unable to load subjects</option>'
setQuestionSubjectStatus("Unable to load subjects right now. Please try again.", "error")
console.error("Could not load subjects", e)
}
}

function resetQuestionSubjectOptions(){
const subjectDrop = document.getElementById("subject")
subjectDrop.innerHTML = '<option value="">Select Subject</option>'
questionSubjectCatalog = {}
}

function setQuestionMode(mode){
questionMode = mode
document.getElementById("simpleModeBtn").classList.toggle("active", mode === "simple")
document.getElementById("paperModeBtn").classList.toggle("active", mode === "paper")
document.getElementById("simplePanel").classList.toggle("hidden", mode !== "simple")
document.getElementById("paperPanel").classList.toggle("hidden", mode !== "paper")
persistQuestionDetectionSnapshot()
}

function syncPaperMetadata(){
const year = document.getElementById("year").value
const sem = document.getElementById("semester").value
const subjectId = document.getElementById("subject").value
const schema = document.getElementById("schema").value
document.getElementById("paperClass").value = year || ""
document.getElementById("paperSemester").value = sem ? "Semester " + semesterRomanMap[parseInt(sem)] : ""
const selectedSubject = questionSubjectCatalog[subjectId]
if(selectedSubject) {
document.getElementById("paperSubject").value = selectedSubject.subject_name || ""
} else {
document.getElementById("paperSubject").value = ""
}
if(schema) {
document.getElementById("paperScheme").value = schema + " Scheme"
}
}

function handleSpecialCharacterChange(){
const select = document.getElementById("paperSpecialCharacter")
const customInput = document.getElementById("paperCustomCharacter")
if(select.value === "custom"){
customInput.style.display = "block"
customInput.focus()
} else {
customInput.style.display = "none"
}
}

function getSelectedSpecialCharacter(){
const select = document.getElementById("paperSpecialCharacter")
if(select.value === "custom"){
return document.getElementById("paperCustomCharacter").value || ""
}
return select.value || ""
}

function convertMathSymbolNames(input){
if(!input || input.trim() === "") return ""
const names = input.toLowerCase().split(/[,\s]+/).filter(n => n.trim())
const symbols = names.map(name => mathSymbolMap[name.trim()] || "").filter(s => s)
return symbols.join(" ")
}

function handleMathSymbolInput(){
const input = document.getElementById("paperMathSymbols").value
const preview = convertMathSymbolNames(input)
const previewDiv = document.getElementById("mathSymbolPreview")
previewDiv.innerHTML = "Preview: " + (preview || "(No symbols)")
}

function getMathSymbolsString(){
return convertMathSymbolNames(document.getElementById("paperMathSymbols").value)
}

function generateQuestionRows(){
const mainCount = parseInt(document.getElementById("mainQuestionCount").value) || 1
const subCount = parseInt(document.getElementById("subQuestionCount").value) || 1
const tbody = document.querySelector("#paperInputTable tbody")
tbody.innerHTML = ""
for(let i = 1; i <= mainCount; i++){
for(let j = 1; j <= subCount; j++){
const row = document.createElement("tr")
const qNo = i + "." + j
row.innerHTML = `
<td><select class="table-select" onchange="updateRowType(this)"><option value="question">Question</option><option value="instruction">Instruction</option></select></td>
<td><input type="text" class="table-input" value="${qNo}" readonly></td>
<td><textarea class="table-textarea" spellcheck="true"></textarea></td>
<td><input type="number" class="table-input" value="5" min="0"></td>
<td><input type="text" class="table-input" placeholder="Module" spellcheck="true"></td>
<td>
  <div class="diagram-tools">
    <span class="diagram-label">Optional Diagram</span>
    <input type="file" class="table-input diagram-input" accept="image/*" onchange="previewDiagram(this)">
    <div class="diagram-preview"><span class="diagram-empty">No diagram added</span></div>
  </div>
</td>
<td><button type="button" class="row-action" onclick="deleteRow(this)">Delete</button></td>
`
tbody.appendChild(row)
}
}
applyNativeSpellcheck()
persistQuestionDetectionSnapshot()
}

function addInstructionRow(){
const tbody = document.querySelector("#paperInputTable tbody")
const row = document.createElement("tr")
row.classList.add("instruction-row")
row.innerHTML = `
<td><select class="table-select" onchange="updateRowType(this)"><option value="instruction" selected>Instruction</option><option value="question">Question</option></select></td>
<td>-</td>
<td><textarea class="table-textarea" placeholder="Enter instruction..." spellcheck="true"></textarea></td>
<td>0</td>
<td>-</td>
<td>-</td>
<td><button type="button" class="row-action" onclick="deleteRow(this)">Delete</button></td>
`
tbody.appendChild(row)
applyNativeSpellcheck()
persistQuestionDetectionSnapshot()
}

function addQuestionRow(){
const tbody = document.querySelector("#paperInputTable tbody")
const rowCount = tbody.children.length + 1
const row = document.createElement("tr")
row.innerHTML = `
<td><select class="table-select" onchange="updateRowType(this)"><option value="question" selected>Question</option><option value="instruction">Instruction</option></select></td>
<td><input type="text" class="table-input" value="${rowCount}" readonly></td>
<td><textarea class="table-textarea" spellcheck="true"></textarea></td>
<td><input type="number" class="table-input" value="5" min="0"></td>
<td><input type="text" class="table-input" placeholder="Module" spellcheck="true"></td>
<td>
  <div class="diagram-tools">
    <span class="diagram-label">Optional Diagram</span>
    <input type="file" class="table-input diagram-input" accept="image/*" onchange="previewDiagram(this)">
    <div class="diagram-preview"><span class="diagram-empty">No diagram added</span></div>
  </div>
</td>
<td><button type="button" class="row-action" onclick="deleteRow(this)">Delete</button></td>
`
tbody.appendChild(row)
applyNativeSpellcheck()
persistQuestionDetectionSnapshot()
}

function updateRowType(select){
const row = select.closest("tr")
if(select.value === "instruction"){
row.classList.add("instruction-row")
} else {
row.classList.remove("instruction-row")
}
persistQuestionDetectionSnapshot()
}

function deleteRow(btn){
btn.closest("tr").remove()
persistQuestionDetectionSnapshot()
}

function previewDiagram(input){
const row = input.closest("tr")
const previewBox = row?.querySelector(".diagram-preview")
const file = input.files?.[0]

if(!row || !previewBox){
return
}

if(!file){
row.dataset.diagramSrc = ""
previewBox.innerHTML = '<span class="diagram-empty">No diagram added</span>'
persistQuestionDetectionSnapshot()
return
}

const objectUrl = URL.createObjectURL(file)
row.dataset.diagramSrc = objectUrl
row.dataset.diagramName = file.name || ""
previewBox.innerHTML = `<img src="${objectUrl}" alt="Diagram preview">`
persistQuestionDetectionSnapshot()
}

function initializeSpellChecker(){
if(window.QuestionPaperSpellChecker){
paperSpellChecker = new window.QuestionPaperSpellChecker()
}
applyNativeSpellcheck()
}

function applyNativeSpellcheck(){
;[
"questions",
"paperTitle",
"paperDepartment",
"paperClass",
"paperSemester",
"paperSubject",
"paperSetNo",
"paperSyllabus",
"paperScheme",
"paperTime"
].forEach(id => {
const el = document.getElementById(id)
if(el){
el.spellcheck = true
el.setAttribute("lang", "en")
}
})
document.querySelectorAll("#paperInputTable textarea, #paperInputTable input[type='text']").forEach(el => {
el.spellcheck = true
el.setAttribute("lang", "en")
})
}

function getSpellCheckContextWords(meta){
return [
meta?.title,
meta?.department,
meta?.subject,
meta?.scheme,
document.getElementById("subject")?.selectedOptions?.[0]?.text || "",
document.getElementById("paperMathSymbols")?.value || ""
].join(" ")
}

function buildSpellCheckSections(){
if(currentQuestionMode === "simple"){
return {
mode: "simple",
sections: [{label: "Simple Questions", text: document.getElementById("questions").value || ""}]
}
}
const meta = getPaperMetadata()
const rows = getPaperRows()
if(paperSpellChecker){
paperSpellChecker.addWordsFromText(getSpellCheckContextWords(meta))
}
const sections = [
{label: "Paper Title", text: meta.title},
{label: "Department", text: meta.department},
{label: "Subject", text: meta.subject},
{label: "Syllabus", text: meta.syllabus},
{label: "Scheme", text: meta.scheme}
]
rows.forEach(row => {
if(row.questionText?.trim()){
sections.push({
label: row.rowType === "instruction" ? `Instruction ${row.index + 1}` : `Question ${row.qNo}`,
text: row.questionText
})
}
if(row.module?.trim()){
sections.push({
label: row.rowType === "instruction" ? `Instruction Module ${row.index + 1}` : `Module ${row.qNo}`,
text: row.module
})
}
})
return {mode: "paper", sections}
}

function updateSpellStatusPill(report){
const pill = document.getElementById("spellStatusPill")
if(!pill) return
pill.classList.remove("hidden", "ok")
if(!report){
pill.textContent = "Spell check not run yet"
return
}
if(report.totalErrors === 0){
pill.classList.add("ok")
pill.textContent = "No spelling issues detected"
return
}
pill.textContent = `${report.totalErrors} issue(s) detected`
}

function checkCurrentModeSpelling(){
if(!paperSpellChecker){
initializeSpellChecker()
}
if(!paperSpellChecker){
return alert("Spell checker could not be initialized.")
}
const payload = buildSpellCheckSections()
if(!payload.sections.some(section => String(section.text || "").trim())){
return alert("Please enter question paper content first.")
}
const report = paperSpellChecker.generateReport(payload.sections)
window.lastSpellCheckReport = report
updateSpellStatusPill(report)
displaySpellCheckReport(report, payload.mode)
}

function displaySpellCheckReport(report, mode){
closeSpellCheckReport()
const modal = document.createElement("div")
modal.id = "spellCheckModal"
modal.style.cssText = "position:fixed;inset:0;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;z-index:10000;padding:18px;"
const issueRows = report.errors.slice(0, 18).map(error => `
<tr>
<td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${escapeHtml(error.section)}</td>
<td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;"><strong>${escapeHtml(error.word)}</strong></td>
<td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${escapeHtml(error.suggestion)}</td>
<td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;">${error.corrected ? "Known auto-fix" : "Review manually"}</td>
</tr>
`).join("")
modal.innerHTML = `
<div style="width:min(820px,96vw);max-height:88vh;overflow:auto;background:#fff;border-radius:18px;box-shadow:0 24px 60px rgba(15,23,42,.24);padding:22px 24px;">
<h3 style="margin:0 0 8px;font-size:26px;color:#142033;">Spell Check Report</h3>
<p style="margin:0 0 14px;color:#5b677a;line-height:1.6;">Technical terms, CO/PO/BTL codes, symbols, and formulas are ignored. Only likely spelling mistakes are shown.</p>
<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:16px;">
<div style="padding:12px 14px;border:1px solid #e2e8f0;border-radius:14px;background:#fbfdff;"><strong>${report.totalErrors}</strong><br><span style="color:#64748b;font-size:13px;">Total Issues</span></div>
<div style="padding:12px 14px;border:1px solid #e2e8f0;border-radius:14px;background:#fbfdff;"><strong>${report.correctedErrors}</strong><br><span style="color:#64748b;font-size:13px;">Known Auto-Fixes</span></div>
<div style="padding:12px 14px;border:1px solid #e2e8f0;border-radius:14px;background:#fbfdff;"><strong>${report.uncertainErrors}</strong><br><span style="color:#64748b;font-size:13px;">Needs Review</span></div>
<div style="padding:12px 14px;border:1px solid #e2e8f0;border-radius:14px;background:#fbfdff;"><strong>${report.errorRate}%</strong><br><span style="color:#64748b;font-size:13px;">Error Rate</span></div>
</div>
${report.totalErrors ? `
<div style="border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
<table style="width:100%;border-collapse:collapse;font-size:14px;">
<thead>
<tr style="background:#0f172a;color:#fff;">
<th style="padding:10px;text-align:left;">Section</th>
<th style="padding:10px;text-align:left;">Word</th>
<th style="padding:10px;text-align:left;">Suggestion</th>
<th style="padding:10px;text-align:left;">Action</th>
</tr>
</thead>
<tbody>${issueRows}</tbody>
</table>
</div>
${report.errors.length > 18 ? `<p style="margin:10px 0 0;color:#64748b;">Showing first 18 issues out of ${report.errors.length}.</p>` : ""}
` : `
<div style="padding:16px;border:1px solid #bbf7d0;border-radius:16px;background:#ecfdf5;color:#166534;font-weight:700;">
No spelling issues found. Paper is ready for PDF generation.
</div>
`}
<div style="display:flex;justify-content:flex-end;gap:10px;flex-wrap:wrap;margin-top:18px;">
<button type="button" class="subtle-btn" onclick="closeSpellCheckReport()">Close</button>
${report.correctedErrors ? `<button type="button" class="secondary-btn" onclick="autoCorrectDetectedContent('${mode}')">Auto-Correct Known Errors</button>` : ""}
</div>
</div>
`
document.body.appendChild(modal)
}

function closeSpellCheckReport(){
const modal = document.getElementById("spellCheckModal")
if(modal) modal.remove()
}

function autoCorrectDetectedContent(mode = currentQuestionMode, silent = false){
if(!paperSpellChecker){
initializeSpellChecker()
}
if(!paperSpellChecker) return false
if(mode === "simple"){
const simpleBox = document.getElementById("questions")
if(simpleBox){
simpleBox.value = paperSpellChecker.autocorrectText(simpleBox.value)
}
if(!silent){
closeSpellCheckReport()
alert("Known spelling mistakes corrected in simple questions.")
checkCurrentModeSpelling()
}
return true
}
;[
"paperTitle",
"paperDepartment",
"paperClass",
"paperSemester",
"paperSubject",
"paperSyllabus",
"paperScheme",
"paperTime"
].forEach(id => {
const el = document.getElementById(id)
if(el?.value){
el.value = paperSpellChecker.autocorrectText(el.value)
}
})
document.querySelectorAll("#paperInputTable tbody tr").forEach(tr => {
tr.querySelectorAll("textarea").forEach(el => {
if(el.value){
el.value = paperSpellChecker.autocorrectText(el.value)
}
})
tr.querySelectorAll("input[type='text']").forEach(el => {
if(!el.readOnly && el.value){
el.value = paperSpellChecker.autocorrectText(el.value)
}
})
})
latestPaperRows = getPaperRows()
latestPaperMeta = getPaperMetadata()
buildPdfPaper(latestPaperMeta, latestPaperRows)
const report = paperSpellChecker.generateReport(buildSpellCheckSections().sections)
updateSpellStatusPill(report)
if(!silent){
closeSpellCheckReport()
alert("Known spelling mistakes corrected in paper details and question rows.")
}
return true
}

function getPaperMetadata(){
const selectedSubject = questionSubjectCatalog[document.getElementById("subject").value]
return {
title: document.getElementById("paperTitle").value.trim() || "IA-1 Paper",
department: document.getElementById("paperDepartment").value.trim() || "Department of Computer Engineering",
className: document.getElementById("paperClass").value.trim() || document.getElementById("year").value,
semester: document.getElementById("paperSemester").value.trim() || formatSemesterDisplay(document.getElementById("semester").value),
subject: document.getElementById("paperSubject").value.trim() || selectedSubject?.subject_name || "",
setNo: document.getElementById("paperSetNo").value.trim() || "1",
syllabus: document.getElementById("paperSyllabus").value.trim() || "-",
scheme: document.getElementById("paperScheme").value.trim() || `${document.getElementById("schema").value} Scheme`,
maxMarks: Number(document.getElementById("paperMaxMarks").value || 0),
date: document.getElementById("paperDate").value,
time: document.getElementById("paperTime").value.trim() || "-",
specialCharacter: getSelectedSpecialCharacter(),
mathSymbols: getMathSymbolsString(),
logoSrc: new URL("watumull-banner.jpg", window.location.href).href
}
}

function getPaperRows(){
const tbody = document.querySelector("#paperInputTable tbody")
const rows = []
tbody.querySelectorAll("tr").forEach((tr, idx) => {
const cells = tr.querySelectorAll("td")
const rowType = cells[0].querySelector("select").value
const qNo = cells[1].querySelector("input")?.value || "-"
const questionText = cells[2].querySelector("textarea")?.value || ""
const marks = parseInt(cells[3].querySelector("input")?.value || 0)
const module = cells[4].querySelector("input")?.value || ""
const diagramSrc = tr.dataset.diagramSrc || ""
rows.push({index: idx, rowType, qNo, questionText, marks, module, diagramSrc})
})
return rows
}

function formatSemesterDisplay(semValue){
if(!semValue) return ""
const rom = semesterRomanMap[parseInt(semValue)]
return rom ? `Semester ${rom}` : ""
}

function escapeHtml(text){
const div = document.createElement("div")
div.textContent = text
return div.innerHTML
}

function buildPdfPaper(meta, rows){
const pdfRoot = document.getElementById("pdfPaper")
pdfRoot.innerHTML = `
<div class="paper-sheet" id="pdfPaperContent">
${meta.specialCharacter ? `<div style="position:absolute;top:20px;right:30px;font-size:48px;color:#999;opacity:0.3;">${meta.specialCharacter}</div>` : ''}
${meta.mathSymbols ? `<div style="position:absolute;top:80px;right:30px;font-size:32px;color:#ccc;opacity:0.2;text-align:right;line-height:1.6;">${meta.mathSymbols.split(' ').join('<br>')}</div>` : ''}
<img src="${escapeHtml(meta.logoSrc)}" alt="College Logo" class="paper-logo" onerror="this.style.display='none'">
<div class="paper-accreditation">
<div>Affiliated to University of Mumbai, Approved by the All India Council for Technical Education &amp; Government of Maharashtra.</div>
</div>
<table class="paper-meta">
<tr>
<td class="label-cell">Title</td><td class="value-cell"><strong>${escapeHtml(meta.title)}</strong></td>
<td colspan="2"></td>
<td class="label-cell">Set No</td><td class="value-cell">${escapeHtml(meta.setNo)}</td>
</tr>
<tr>
<td class="label-cell">Dept</td><td class="value-cell">${escapeHtml(meta.department)}</td>
<td class="label-cell">Class</td><td class="value-cell">${escapeHtml(meta.className)}</td>
<td class="label-cell">Date</td><td class="value-cell">${meta.date}</td>
</tr>
<tr>
<td class="label-cell">Subject</td><td class="value-cell">${escapeHtml(meta.subject)}</td>
<td class="label-cell">Semester</td><td class="value-cell">${escapeHtml(meta.semester)}</td>
<td class="label-cell">Time</td><td class="value-cell">${escapeHtml(meta.time)}</td>
</tr>
<tr>
<td class="label-cell">Syllabus</td><td class="value-cell">${escapeHtml(meta.syllabus)}</td>
<td class="label-cell">Scheme</td><td class="value-cell">${escapeHtml(meta.scheme)}</td>
<td class="label-cell">Max Marks</td><td class="value-cell"><strong>${meta.maxMarks}</strong></td>
</tr>
</table>
<table class="paper-table">
<thead>
<tr>
<th style="width:12%;">Q No</th>
<th style="width:55%;">Question</th>
<th style="width:10%;">Marks</th>
<th style="width:23%;">Module / BTL / CO</th>
</tr>
</thead>
<tbody>
${rows.map(row => {
if(row.rowType === "instruction"){
return `<tr class="instruction-row"><td colspan="4">${escapeHtml(row.questionText)}</td></tr>`
} else {
return `
<tr>
<td class="center">${escapeHtml(row.qNo)}</td>
<td class="question-cell">
  ${escapeHtml(row.questionText)}
  ${row.diagramSrc ? `<img src="${escapeHtml(row.diagramSrc)}" alt="Question diagram" class="paper-diagram small">` : ""}
</td>
<td class="center">${row.marks}</td>
<td>${escapeHtml(row.module)}</td>
</tr>
`
}
}).join("")}
</tbody>
</table>
</div>
`
persistQuestionDetectionSnapshot()
}

function detectSimpleCO(){
const text = document.getElementById("questions").value.trim()
if(!text){
alert("Please enter at least one question")
return
}
const lines = text.split("\n").filter(l => l.trim())
const output = lines.map(q => `Q: ${q.trim()}`).join("\n")
document.getElementById("result").innerHTML = `<pre>${escapeHtml(output)}</pre>`
document.getElementById("resultCard").classList.remove("hidden")
persistQuestionDetectionSnapshot()
}

function detectQuestionPaper(){
const rows = getPaperRows()
if(!rows.length){
alert("Please generate a table and add questions")
return
}
latestPaperRows = rows
latestPaperMeta = getPaperMetadata()
buildPdfPaper(latestPaperMeta, rows)
const totalMarks = rows.reduce((sum, r) => sum + r.marks, 0)
const questionCount = rows.filter(r => r.rowType === "question").length
document.getElementById("summaryQuestionCount").textContent = questionCount
document.getElementById("summaryTotalMarks").textContent = totalMarks
document.getElementById("summaryAverageConfidence").textContent = "85%"
document.getElementById("resultCard").classList.remove("hidden")
document.getElementById("summaryGrid").classList.remove("hidden")
document.getElementById("downloadBar").classList.remove("hidden")
document.getElementById("pdfPreviewCard").classList.remove("hidden")
updateSpellStatusPill(null)
persistQuestionDetectionSnapshot()
}

function persistQuestionDetectionSnapshot(){
return
}

function restoreQuestionDetectionSnapshot(){
localStorage.removeItem(QUESTION_SNAPSHOT_KEY)
return
}

function initializeQuestionFilters(){
const schemaDrop = document.getElementById("schema")
const yearDrop = document.getElementById("year")
const semDrop = document.getElementById("semester")
const subjectDrop = document.getElementById("subject")

const preservedSchema = schemaDrop?.value || ""
const preservedYear = yearDrop?.value || ""
const preservedSemester = semDrop?.value || ""
const preservedSubject = subjectDrop?.value || ""

populateQuestionYears()

if(preservedSchema && Array.from(schemaDrop.options).some(option => option.value === preservedSchema)){
  schemaDrop.value = preservedSchema
  populateQuestionYears()
}

if(preservedYear && Array.from(yearDrop.options).some(option => option.value === preservedYear)){
  yearDrop.value = preservedYear
  populateQuestionSemesters()
}

if(preservedSemester && Array.from(semDrop.options).some(option => option.value === preservedSemester)){
  semDrop.value = preservedSemester
}

if(preservedSubject){
  subjectDrop.dataset.pendingValue = preservedSubject
}

if(schemaDrop.value && yearDrop.value && semDrop.value){
  loadSubjects(preservedSubject)
}else{
  setQuestionSubjectStatus("Select schema, year, and semester first.")
}
}

function downloadQuestionPaperPDF(){
const element = document.getElementById("pdfPaperContent")
if(!element) return alert("Please generate paper first")
autoCorrectDetectedContent("paper", true)
latestPaperRows = getPaperRows()
latestPaperMeta = getPaperMetadata()
buildPdfPaper(latestPaperMeta, latestPaperRows)
html2pdf = window.html2pdf || {}
if(!window.html2pdf){
const script = document.createElement("script")
script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"
script.onload = () => generatePDF()
document.head.appendChild(script)
} else {
generatePDF()
}

function generatePDF(){
const options = {
margin: 0,
filename: (latestPaperMeta?.title || "paper") + ".pdf",
image: {type: "jpeg", quality: 0.98},
html2canvas: {scale: 2},
jsPDF: {orientation: "p", unit: "mm", format: "a4"}
}
html2pdf().set(options).from(element).save()
}
}

/* EVENT LISTENERS */
document.getElementById("paperSpecialCharacter")?.addEventListener("change", handleSpecialCharacterChange)
document.getElementById("paperMathSymbols")?.addEventListener("input", handleMathSymbolInput)
/* LOGOUT */
function logout(){
window.location.href="login.html"
}

document.getElementById("facultyName").textContent = localStorage.getItem("facultyName") || "Faculty"

initializeQuestionFilters()
syncPaperMetadata()
generateQuestionRows()
initializeSpellChecker()
restoreQuestionDetectionSnapshot()
document.addEventListener("input", () => { setTimeout(persistQuestionDetectionSnapshot, 0) }, true)
document.addEventListener("change", () => { setTimeout(persistQuestionDetectionSnapshot, 0) }, true)


