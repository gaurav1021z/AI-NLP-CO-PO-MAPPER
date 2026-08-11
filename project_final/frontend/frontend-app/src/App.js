import React from "react";

function App() {
  const path = window.location.pathname;

  if (path === "/" || path === "/login") {
    return <div />;
  }

  window.location.replace("/login");
  return null;
}

export default App;
