@'
import React from "react";
import Login from "./pages/Login";
import Signup from "./pages/Signup";

function App() {
  const path = window.location.pathname;

  if (path === "/" || path === "/login") {
    return <Login />;
  }

  if (path === "/signup" || path === "/signup.html") {
    return <Signup />;
  }

  // Old testing dashboard route removed.
  // Actual dashboard is dashboard.html.
  window.location.replace("/login");
  return null;
}

export default App;
'@ | Set-Content .\frontend\frontend-app\src\App.js