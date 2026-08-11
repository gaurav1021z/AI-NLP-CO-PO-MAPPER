import React from "react";
import Login from "./pages/Login";
import Signup from "./pages/Signup";

function App() {
  const path = window.location.pathname;

  if (path === "/login" || path === "/") {
    return <Login />;
  }

  if (path === "/signup") {
    return <Signup />;
  }

  // Existing HTML/JS application handles dashboard and other pages
  window.location.href = "/dashboard.html";
  return null;
}

export default App;