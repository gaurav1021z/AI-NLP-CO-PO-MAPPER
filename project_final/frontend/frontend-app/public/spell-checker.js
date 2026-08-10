class QuestionPaperSpellChecker {
  constructor() {
    this.dictionary = new Set(this.loadDictionary());
    this.commonMisspellings = this.loadCommonMisspellings();
    this.whitelist = new Set(this.loadWhitelist());
  }

  loadDictionary() {
    return [
      "a", "about", "above", "acquire", "across", "addition", "after", "again", "against", "algorithm",
      "algorithms", "all", "analysis", "analyze", "and", "answer", "application", "applications",
      "apply", "architecture", "array", "assembler", "assemblers", "assignment", "attempt", "available", "basic",
      "be", "because", "before", "begin", "binary", "both", "buffer", "build", "by", "calculate",
      "can", "case", "character", "class", "clock", "code", "compiler", "compilers", "complete", "complex",
      "concept", "concepts", "condition", "consistency", "construct", "context", "control", "convert", "cpu",
      "create", "critical", "cycle", "data", "database", "databases", "deadlock", "deadlocks", "define",
      "delta", "demonstrate", "department", "describe", "design", "detail", "detect", "diagram", "different",
      "digital", "discuss", "distributed", "does", "draw", "during", "dynamic", "each", "efficient", "element",
      "engineering", "environment", "evaluate", "evidence", "exam", "examination", "example", "execute", "execution",
      "explain", "expression", "file", "files", "flow", "for", "forensic", "forensics", "formula", "from",
      "function", "functions", "gain", "generate", "given", "goal", "graph", "graphics", "handle", "hardware",
      "have", "heap", "how", "identify", "image", "images", "implement", "important", "in", "incident",
      "incidents", "include", "index", "instruction", "integral", "interface", "investigation", "investigations",
      "is", "issue", "its", "java", "javascript", "knowledge", "lambda", "language", "large", "learn", "level",
      "linear", "linker", "linkers", "list", "loader", "loaders", "machine", "management", "marks", "mathematics",
      "matrix", "memory", "middleware", "module", "modules", "multiple", "network", "networks", "neural", "no",
      "node", "normalization", "number", "objective", "of", "one", "operating", "operation", "operations", "or",
      "order", "organization", "output", "paper", "parameter", "part", "parts", "phase", "pi", "pointer",
      "practice", "precise", "predict", "prepare", "preprocessor", "problem", "problems", "process", "processing",
      "processor", "program", "programming", "proof", "protocol", "provide", "python", "question", "questions",
      "queue", "ram", "rate", "receive", "recursion", "reference", "register", "related", "representation",
      "required", "response", "results", "review", "role", "router", "routing", "safety", "same", "scheme",
      "score", "security", "semester", "semantic", "sequence", "server", "show", "sigma", "similarity", "simple",
      "situation", "size", "solve", "sorting", "special", "spell", "sql", "stack", "state", "statement",
      "statements", "steps", "storage", "structure", "structures", "student", "students", "study", "subject",
      "sum", "support", "switch", "synchronization", "system", "systems", "table", "technique", "techniques",
      "technical", "test", "text", "that", "the", "their", "theta", "thread", "threads", "three", "time", "to",
      "topic", "topics", "training", "tree", "two", "understand", "understanding", "unit", "until", "use",
      "used", "using", "validation", "value", "vector", "verify", "virtual", "virus", "what", "when", "which",
      "while", "with", "word", "work", "write", "year"
    ];
  }

  loadCommonMisspellings() {
    return {
      "adn": "and",
      "algorithim": "algorithm",
      "algoritm": "algorithm",
      "analaysis": "analysis",
      "anaylze": "analyze",
      "anwser": "answer",
      "architechture": "architecture",
      "assingment": "assignment",
      "beggining": "beginning",
      "beteween": "between",
      "caluclate": "calculate",
      "charachter": "character",
      "comparision": "comparison",
      "concpet": "concept",
      "conditon": "condition",
      "definately": "definitely",
      "defination": "definition",
      "descibe": "describe",
      "desicion": "decision",
      "detaills": "details",
      "differnt": "different",
      "enviornment": "environment",
      "examintion": "examination",
      "excution": "execution",
      "expalin": "explain",
      "functoin": "function",
      "funtion": "function",
      "goverment": "government",
      "grahics": "graphics",
      "grapics": "graphics",
      "immediatly": "immediately",
      "importent": "important",
      "introudce": "introduce",
      "langauge": "language",
      "lavel": "level",
      "linkar": "linker",
      "managment": "management",
      "mathematic": "mathematics",
      "meory": "memory",
      "moduel": "module",
      "moudle": "module",
      "neccessary": "necessary",
      "occured": "occurred",
      "opertaing": "operating",
      "paramter": "parameter",
      "practise": "practice",
      "preform": "perform",
      "processer": "processor",
      "programing": "programming",
      "quesiton": "question",
      "questoin": "question",
      "recieve": "receive",
      "relevent": "relevant",
      "requried": "required",
      "responce": "response",
      "schedulling": "scheduling",
      "seperate": "separate",
      "similiar": "similar",
      "statment": "statement",
      "stucture": "structure",
      "struture": "structure",
      "sumbit": "submit",
      "synchronisation": "synchronization",
      "teh": "the",
      "temprary": "temporary",
      "thier": "their",
      "traning": "training",
      "untill": "until",
      "variabel": "variable",
      "wierd": "weird",
      "writting": "writing"
    };
  }

  loadWhitelist() {
    return [
      "AI", "AICTE", "API", "BTL", "CO", "COPO", "CSS", "CPU", "CSDC", "DBMS", "DNS", "DOS",
      "DNN", "HTML", "HTTP", "IA", "IP", "JSON", "JWT", "KVL", "KCL", "ML", "MongoDB",
      "MSBTE", "NEP", "NLP", "NBA", "OCR", "PDF", "PO", "PSO", "Python", "RAM", "RMI", "RPC",
      "SQL", "SPCC", "TCP", "TCS", "UI", "UML", "URL", "UTC", "Watumull", "XGBoost", "assembler",
      "assemblers", "autocorrection", "backend", "compiler", "compilers", "cosine", "deadlock",
      "deadlocks", "forensic", "forensics", "frontend", "linker", "linkers", "loader", "loaders",
      "middleware", "multiprogramming", "normalization", "preprocessor", "router", "routers",
      "scheduling", "schema", "sem", "softmax", "uvicorn", "vector", "watumull"
    ];
  }

  normalize(word) {
    return String(word || "").toLowerCase().trim();
  }

  addWords(words) {
    (words || []).forEach((word) => {
      const clean = this.normalize(word);
      if (clean) {
        this.dictionary.add(clean);
        this.whitelist.add(word);
      }
    });
  }

  addWordsFromText(text) {
    this.extractWords(text).forEach((word) => {
      if (word.length > 2) {
        this.addWords([word]);
      }
    });
  }

  extractWords(text) {
    return String(text || "").match(/\b[A-Za-z][A-Za-z'-]{2,}\b/g) || [];
  }

  isRomanNumeral(word) {
    return /^[ivxlcdm]+$/i.test(word || "") && String(word).length <= 6;
  }

  shouldSkipWord(word) {
    if (!word || word.length < 3) return true;
    if (/[0-9]/.test(word)) return true;
    if (this.isRomanNumeral(word)) return true;
    if (/^[A-Z]{2,}$/.test(word)) return true;
    if (word.includes("_")) return true;
    if (this.whitelist.has(word) || this.whitelist.has(word.toUpperCase()) || this.whitelist.has(word.toLowerCase())) {
      return true;
    }
    return false;
  }

  isValidWord(word) {
    const normalized = this.normalize(word);
    return this.dictionary.has(normalized) || this.whitelist.has(word) || this.whitelist.has(normalized);
  }

  levenshteinDistance(a, b) {
    const track = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));
    for (let i = 0; i <= a.length; i += 1) track[0][i] = i;
    for (let j = 0; j <= b.length; j += 1) track[j][0] = j;
    for (let j = 1; j <= b.length; j += 1) {
      for (let i = 1; i <= a.length; i += 1) {
        const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
        track[j][i] = Math.min(
          track[j][i - 1] + 1,
          track[j - 1][i] + 1,
          track[j - 1][i - 1] + indicator
        );
      }
    }
    return track[b.length][a.length];
  }

  findClosestMatch(word) {
    const normalized = this.normalize(word);
    if (!normalized || normalized.length < 4) return null;
    let closestMatch = null;
    let minDistance = normalized.length > 7 ? 2 : 1;

    for (const dictWord of this.dictionary) {
      if (dictWord[0] !== normalized[0]) continue;
      if (Math.abs(dictWord.length - normalized.length) > 2) continue;
      const distance = this.levenshteinDistance(normalized, dictWord);
      if (distance <= minDistance) {
        minDistance = distance;
        closestMatch = dictWord;
      }
    }

    return closestMatch;
  }

  preserveCase(original, replacement) {
    if (!replacement) return replacement;
    if (original === original.toUpperCase()) return replacement.toUpperCase();
    if (original[0] === original[0].toUpperCase()) {
      return replacement.charAt(0).toUpperCase() + replacement.slice(1);
    }
    return replacement;
  }

  getSuggestion(word) {
    const normalized = this.normalize(word);
    if (this.commonMisspellings[normalized]) {
      return {
        suggestion: this.commonMisspellings[normalized],
        confidence: "high",
        autoCorrect: true
      };
    }
    const closest = this.findClosestMatch(normalized);
    if (!closest) return null;
    return {
      suggestion: closest,
      confidence: "medium",
      autoCorrect: false
    };
  }

  checkText(text, label = "Text") {
    const errors = [];
    const seen = new Set();

    this.extractWords(text).forEach((word) => {
      const normalized = this.normalize(word);
      if (seen.has(normalized) || this.shouldSkipWord(word) || this.isValidWord(word)) {
        return;
      }
      seen.add(normalized);
      const match = this.getSuggestion(word);
      if (match) {
        errors.push({
          section: label,
          word,
          suggestion: match.suggestion,
          confidence: match.confidence,
          corrected: match.autoCorrect
        });
      }
    });

    return errors;
  }

  autocorrectText(text) {
    let correctedText = String(text || "");
    Object.entries(this.commonMisspellings).forEach(([wrong, correct]) => {
      const regex = new RegExp(`\\b${wrong}\\b`, "gi");
      correctedText = correctedText.replace(regex, (match) => this.preserveCase(match, correct));
    });
    return correctedText;
  }

  generateReport(sections) {
    const entries = Array.isArray(sections) ? sections : [{ label: "Text", text: String(sections || "") }];
    const sectionReports = [];
    const allErrors = [];
    let totalWords = 0;

    entries.forEach(({ label, text }) => {
      const words = this.extractWords(text);
      totalWords += words.length;
      const errors = this.checkText(text, label);
      sectionReports.push({
        label,
        words: words.length,
        errors
      });
      allErrors.push(...errors);
    });

    return {
      totalErrors: allErrors.length,
      correctedErrors: allErrors.filter((item) => item.corrected).length,
      uncertainErrors: allErrors.filter((item) => !item.corrected).length,
      errorRate: totalWords ? ((allErrors.length / totalWords) * 100).toFixed(2) : "0.00",
      totalWords,
      sections: sectionReports,
      errors: allErrors,
      timestamp: new Date().toLocaleString()
    };
  }
}

window.QuestionPaperSpellChecker = QuestionPaperSpellChecker;
