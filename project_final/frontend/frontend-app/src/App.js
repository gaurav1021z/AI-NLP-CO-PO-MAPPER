import React from "react";
import Login from "./pages/Login";
import Signup from "./pages/Signup";

function App() {
  const path = window.location.pathname;
  const isLogged = localStorage.getItem("loggedIn") === "true";

  if (path === "/login" || path === "/" || path === "/login.html") {
    if (isLogged) {
      window.location.href = "/dashboard.html";
      return null;
    }
    return <Login />;
  }

  if (path === "/signup" || path === "/signup.html") {
    return <Signup />;
  }

  // Security route guard for protected dashboard & html pages
  if (!isLogged) {
    window.location.href = "/";
    return null;
  }

  // If already on a specific .html page, let browser load it
  if (path.endsWith(".html")) {
    return null;
  }

  // Default redirect to dashboard for logged in users
  window.location.href = "/dashboard.html";
  return null;
}

export default App;