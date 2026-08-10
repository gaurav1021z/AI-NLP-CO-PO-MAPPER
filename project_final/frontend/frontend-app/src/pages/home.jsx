import { useState } from "react";
import axios from "axios";
import COPOMatrix from "../components/Heatmap";
import "./Home.css";

const API_BASE_URL =
  process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:9000";

export default function Home() {
  const [cos, setCos] = useState("");
  const [pos, setPos] = useState("");
  const [result, setResult] = useState(null);
  const [researchMode, setResearchMode] = useState(false);
  const [accuracy, setAccuracy] = useState(null);
  const [poMode, setPoMode] = useState("AICTE");

  // Faculty feedback memory
  const [facultyLevels, setFacultyLevels] = useState({});

  // ----------------------------
  // Generate Mapping
  // ----------------------------
  const generateMapping = async () => {
    try {
      const res = await axios.post(`${API_BASE_URL}/map`, {
        cos: cos.split("\n").map(c => c.trim()).filter(Boolean),
        pos:
          poMode === "CUSTOM"
            ? pos.split("\n").map(p => p.trim()).filter(Boolean)
            : [],
        mode: poMode
      });

      setResult(res.data);
      setAccuracy(null);
      setFacultyLevels({});
    } catch {
      alert("Backend not reachable");
    }
  };

  // ----------------------------
  // Save Faculty Feedback
  // ----------------------------
  const saveFacultyFeedback = async () => {
    if (!result) return alert("Generate mapping first!");

    for (const r of result.results) {
      for (const m of r.mapping) {
        const level = facultyLevels?.[r.co]?.[m.po_code];
        if (level) {
          await axios.post(`${API_BASE_URL}/feedback`, {
            co: r.co,
            po: m.po_code,
            faculty_level: level,
            ai_level: m.level
          });
        }
      }
    }

    alert("Faculty feedback saved successfully 👍");
  };

  // ----------------------------
  // Evaluate Accuracy
  // ----------------------------
  const evaluateAccuracy = async () => {
    if (!result) return;

    const predicted = {};
    const actual = {};

    result.results.forEach(r => {
      predicted[r.co] = {};
      actual[r.co] = {};

      r.mapping.forEach(m => {
        predicted[r.co][m.po_code] = m.level;
        if (facultyLevels?.[r.co]?.[m.po_code]) {
          actual[r.co][m.po_code] =
            facultyLevels[r.co][m.po_code];
        }
      });
    });

    const res = await axios.post(`${API_BASE_URL}/evaluate`, {
      predicted,
      actual
    });

    setAccuracy(res.data);
  };

  return (
    <div className="dashboard">
      <h1 className="title">AI–NLP CO–PO Mapping System</h1>

      {/* PO MODE */}
      <div className="controls">
        <label>
          <input
            type="radio"
            checked={poMode === "AICTE"}
            onChange={() => setPoMode("AICTE")}
          />{" "}
          AICTE POs
        </label>

        <label style={{ marginLeft: "20px" }}>
          <input
            type="radio"
            checked={poMode === "CUSTOM"}
            onChange={() => setPoMode("CUSTOM")}
          />{" "}
          Custom POs
        </label>
      </div>

      {/* INPUTS */}
      <div className="input-section">
        <textarea
          className="textarea"
          placeholder="Enter COs (one per line)"
          onChange={(e) => setCos(e.target.value)}
        />

        {poMode === "CUSTOM" && (
          <textarea
            className="textarea"
            placeholder="Enter POs (one per line)"
            onChange={(e) => setPos(e.target.value)}
          />
        )}
      </div>

      <button className="btn primary" onClick={generateMapping}>
        Generate Mapping
      </button>

      <label style={{ marginLeft: "20px" }}>
        <input
          type="checkbox"
          checked={researchMode}
          onChange={() => setResearchMode(!researchMode)}
        />{" "}
        Research Mode
      </label>

      {/* AI EXPLANATION */}
     {result && (
  <div className="ai-process-box">
    <h3>🧠 AI Mapping Process</h3>

    <ol>
      <li><b>CO Normalization:</b> Short inputs are converted into academic COs.</li>
      <li><b>Similarity:</b> TF-IDF cosine similarity and BERT cosine similarity are applied.</li>
      <li>
        <b>Hybrid Score:</b>
        <code>0.4×BERT + 0.25×TF-IDF + 0.2×Bloom + 0.15×Lexical</code>
      </li>
      <li><b>Top-3 PO Selection:</b> Highest similarity POs are selected.</li>
      <li><b>Level Assignment:</b> Level 1–3 based on score.</li>
      <li><b>Faculty Learning:</b> Feedback improves future predictions.</li>
    </ol>
  </div>
)}


      {/* RESULTS */}
      {result && (
        <div className="results">
          <h2>Results</h2>

          {result.results.map(r => (
            <div key={r.co}>
              <h3>{r.co} (Bloom: {r.bloom})</h3>
              <p>{r.objective}</p>

              <table className="mapping-table">
                <tbody>
                  {r.mapping.map(m => (
                    <tr key={m.po_code}>
                      <td>
                        <b>{m.po_code}</b><br />
                        <small>{m.po_text}</small><br />
                        <small className="reason">{m.reason}</small>
                      </td>

                      <td>
                        <b>{m.final_score}%</b>
                        <div>{m.confidence_label} confidence</div>
                        {researchMode && (
                          <div className="debug">
                            TF-IDF: {m.debug?.tfidf ?? 0}%<br />
                            BERT: {m.debug?.bert ?? m.debug?.semantic ?? 0}%<br />
                            Bloom: {m.debug?.bloom ?? 0}%<br />
                            Bloom Keywords: {(m.debug?.bloom_keywords || []).join(", ") || "None"}
                          </div>
                        )}
                      </td>

                      <td>Level {m.level}</td>

                      <td>
                        <select
                          value={
                            facultyLevels?.[r.co]?.[m.po_code] || ""
                          }
                          onChange={(e) =>
                            setFacultyLevels({
                              ...facultyLevels,
                              [r.co]: {
                                ...(facultyLevels[r.co] || {}),
                                [m.po_code]: parseInt(e.target.value)
                              }
                            })
                          }
                        >
                          <option value="">Faculty</option>
                          <option value="1">1</option>
                          <option value="2">2</option>
                          <option value="3">3</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}

          <div className="action-buttons">
            <button className="btn excel" onClick={saveFacultyFeedback}>
              Save Faculty Feedback
            </button>

            <button className="btn eval" onClick={evaluateAccuracy}>
              Evaluate Accuracy
            </button>
          </div>

          {accuracy && (
            <p className="accuracy">
              Accuracy: <b>{accuracy.accuracy}%</b>
              ({accuracy.correct}/{accuracy.total})
            </p>
          )}

          <COPOMatrix data={result.results} />
        </div>
      )}
    </div>
  );
}
