(function () {
  const pageName = (window.location.pathname.split("/").pop() || "").toLowerCase();

  const PAGE_FLOW = [
    { file: "dashboard.html", label: "Dashboard" },
    { file: "analytics.html", label: "Analytics" },
    { file: "aicte-pos.html", label: "AICTE POs" },
    { file: "attainment.html", label: "Attainment" },
    { file: "question-detection.html", label: "Question Detection" },
    { file: "addsubject.html", label: "Add Subject" }
  ];

  const PAGE_STATE_KEY = `pageState:${pageName}`;
  const EXTRA_RESET_KEYS = {
    "analytics.html": ["analyticsLastSnapshot"],
    "attainment.html": ["attainmentLastPreview"],
    "question-detection.html": ["questionDetectionSnapshot"],
    "result.html": ["reportMetaCustomization", "mappingResult", "mappingId", "facultyData"]
  };

  const CURRENT_INDEX = PAGE_FLOW.findIndex((item) => item.file === pageName);
  const isResultPage = pageName === "result.html";

  function injectStyles() {
    if (document.getElementById("pageNavStyles")) {
      return;
    }

    const style = document.createElement("style");
    style.id = "pageNavStyles";
    style.textContent = `
      body.page-nav-enabled{
        padding-bottom: 110px !important;
      }
      .page-refresh-btn{
        position: fixed;
        top: 18px;
        right: 20px;
        z-index: 9998;
        border: none;
        border-radius: 999px;
        background: linear-gradient(135deg, #0f766e 0%, #0ea5a4 100%);
        color: #fff;
        padding: 10px 16px;
        font-size: 13px;
        font-weight: 700;
        box-shadow: 0 14px 28px rgba(15, 118, 110, 0.22);
        cursor: pointer;
      }
      .page-refresh-btn:hover{
        transform: translateY(-1px);
      }
      .page-nav-fixed{
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 9997;
        pointer-events: none;
      }
      .page-nav-fixed .page-nav-inner{
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        padding: 18px 20px 22px;
        max-width: var(--page-nav-max-width, none);
        margin-left: var(--page-nav-left, 0);
        margin-right: var(--page-nav-right, 0);
      }
      .page-nav-btn{
        pointer-events: auto;
        min-width: 132px;
        border: none;
        border-radius: 999px;
        padding: 12px 18px;
        font-size: 14px;
        font-weight: 800;
        color: #fff;
        cursor: pointer;
        box-shadow: 0 18px 30px rgba(15, 23, 42, 0.18);
      }
      .page-nav-btn.prev{
        background: linear-gradient(135deg, #475569 0%, #334155 100%);
      }
      .page-nav-btn.next{
        background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
      }
      .page-nav-btn:disabled{
        opacity: 0.45;
        cursor: not-allowed;
        box-shadow: none;
      }
      @media (max-width: 720px){
        .page-refresh-btn{
          top: auto;
          right: 18px;
          bottom: 86px;
        }
        .page-nav-fixed .page-nav-inner{
          padding: 14px 14px 18px;
        }
        .page-nav-btn{
          min-width: 120px;
          font-size: 13px;
          padding: 12px 16px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function getPersistableFields() {
    return Array.from(document.querySelectorAll("input, textarea, select")).filter((field) => {
      if (!field) return false;
      if (!field.id && !field.name) return false;
      if (field.type === "file" || field.type === "password" || field.type === "hidden") return false;
      if (field.closest("#spellCheckModal")) return false;
      return true;
    });
  }

  function getFieldKey(field) {
    return field.id || field.name;
  }

  function serializePageState() {
    return {};
  }

  let isRestoringState = false;

  function applyPageState(state) {
    return;
  }

  function savePageState() {
    return;
  }

  function restorePageState() {
    localStorage.removeItem(PAGE_STATE_KEY);
  }

  function clearCurrentPageState() {
    localStorage.removeItem(PAGE_STATE_KEY);
    const dynamicKeys = Array.isArray(window.__pageResetKeys) ? window.__pageResetKeys : [];
    Array.from(new Set([...(EXTRA_RESET_KEYS[pageName] || []), ...dynamicKeys])).forEach((key) => {
      localStorage.removeItem(key);
    });

    if (typeof window.beforePageRefreshClear === "function") {
      try {
        window.beforePageRefreshClear();
      } catch (error) {
        console.warn("beforePageRefreshClear hook failed", error);
      }
    }

    window.location.reload();
  }

  function navigateTo(fileName) {
    savePageState();
    window.location.href = fileName;
  }

  function handleNextClick() {
    if (isResultPage && typeof window.downloadPDF === "function") {
      savePageState();
      window.downloadPDF();
      return;
    }

    const nextPage = PAGE_FLOW[CURRENT_INDEX + 1];
    if (nextPage) {
      navigateTo(nextPage.file);
    }
  }

  function handlePreviousClick() {
    if (isResultPage) {
      navigateTo("dashboard.html");
      return;
    }

    const prevPage = PAGE_FLOW[CURRENT_INDEX - 1];
    if (prevPage) {
      navigateTo(prevPage.file);
    }
  }

  function injectRefreshButton() {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "page-refresh-btn";
    button.textContent = "Refresh / Start New";
    button.onclick = clearCurrentPageState;
    document.body.appendChild(button);
  }

  function injectBottomNavigation() {
    const shell = document.createElement("div");
    shell.className = "page-nav-fixed";

    const prevPage = isResultPage ? { file: "dashboard.html", label: "Dashboard" } : PAGE_FLOW[CURRENT_INDEX - 1];
    const nextPage = isResultPage ? null : PAGE_FLOW[CURRENT_INDEX + 1];

    shell.innerHTML = `
      <div class="page-nav-inner">
        <button type="button" class="page-nav-btn prev" ${!prevPage ? "disabled" : ""}>
          Previous
        </button>
        <button type="button" class="page-nav-btn next" ${!nextPage && !isResultPage ? "disabled" : ""}>
          ${isResultPage ? "Next / Print PDF" : "Next"}
        </button>
      </div>
    `;

    const prevButton = shell.querySelector(".page-nav-btn.prev");
    const nextButton = shell.querySelector(".page-nav-btn.next");

    prevButton?.addEventListener("click", handlePreviousClick);
    nextButton?.addEventListener("click", handleNextClick);

    document.body.appendChild(shell);
  }

  function updateNavigationLayout() {
    const contentArea = document.querySelector("main.content, .content, .main");
    const navInner = document.querySelector(".page-nav-fixed .page-nav-inner");
    const refreshButton = document.querySelector(".page-refresh-btn");

    if (!contentArea || !navInner) {
      return;
    }

    const rect = contentArea.getBoundingClientRect();
    const left = Math.max(14, Math.round(rect.left));
    const right = Math.max(14, Math.round(window.innerWidth - rect.right));
    const width = Math.max(280, Math.round(rect.width));

    navInner.style.setProperty("--page-nav-left", `${left + 10}px`);
    navInner.style.setProperty("--page-nav-right", `${right + 10}px`);
    navInner.style.setProperty("--page-nav-max-width", `${width}px`);

    if (refreshButton) {
      refreshButton.style.right = `${right + 10}px`;
    }
  }

  function initializePersistence() {
    restorePageState();
  }

  function bootstrap() {
    document.body.classList.add("page-nav-enabled");
    injectStyles();
    injectRefreshButton();
    injectBottomNavigation();
    initializePersistence();
    updateNavigationLayout();
    window.addEventListener("resize", updateNavigationLayout);
    [80, 300, 800].forEach((delay) => window.setTimeout(updateNavigationLayout, delay));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
  } else {
    bootstrap();
  }
})();
