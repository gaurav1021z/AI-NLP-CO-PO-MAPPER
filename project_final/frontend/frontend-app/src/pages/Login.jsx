import React, { useState } from "react";

const BASE_URL =
  window.API_BASE_URL ||
  localStorage.getItem("apiBaseUrl") ||
  process.env.REACT_APP_API_BASE_URL ||
  "http://127.0.0.1:9000";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const loginUser = async () => {
    if (!email || !password) {
      alert("Fill all fields");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch(`${BASE_URL}/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await res.json();

      if (data.status === "success") {
        localStorage.setItem("loggedIn", "true");
        localStorage.setItem("facultyName", data.name || "");
        localStorage.setItem("facultyEmail", email);

        window.location.href = "/dashboard";
      } else {
        alert(data.msg || "Login failed");
      }
    } catch (error) {
      console.error(error);
      alert("Backend not reachable!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.body}>
      <div style={styles.loginBox}>
        <h2 style={styles.title}>COPOlytics</h2>

        <p style={styles.subtitle}>Faculty Login</p>

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={styles.input}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={styles.input}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              loginUser();
            }
          }}
        />

        <button
          onClick={loginUser}
          disabled={loading}
          style={styles.button}
        >
          {loading ? "Logging in..." : "Login"}
        </button>

        <div style={styles.footer}>
          New here?{" "}
          <a href="/signup.html" style={styles.link}>
            Create Account
          </a>
        </div>
      </div>
    </div>
  );
}

const styles = {
  body: {
    margin: 0,
    minHeight: "100vh",
    fontFamily: "'Segoe UI', sans-serif",
    background: "linear-gradient(135deg, #1e3a8a, #0f172a)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  },

  loginBox: {
    background: "white",
    padding: "40px",
    width: "350px",
    borderRadius: "12px",
    boxShadow: "0 15px 40px rgba(0,0,0,0.2)",
    textAlign: "center",
  },

  title: {
    marginBottom: "5px",
    color: "#1e3a8a",
  },

  subtitle: {
    marginBottom: "25px",
    color: "#555",
  },

  input: {
    boxSizing: "border-box",
    width: "100%",
    padding: "12px",
    marginBottom: "15px",
    borderRadius: "8px",
    border: "1px solid #ddd",
    fontSize: "14px",
  },

  button: {
    width: "100%",
    padding: "12px",
    background: "#1e3a8a",
    border: "none",
    color: "white",
    fontWeight: "bold",
    borderRadius: "8px",
    cursor: "pointer",
  },

  footer: {
    marginTop: "15px",
    fontSize: "13px",
  },

  link: {
    color: "#1e3a8a",
    fontWeight: "bold",
    textDecoration: "none",
  },
};

export default Login;