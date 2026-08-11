import Login from "./pages/Login";
import Home from "./pages/home";

function App() {
  const path = window.location.pathname;

  if (path === "/" || path === "/login") {
    return <Login />;
  }

  if (path === "/dashboard") {
    return <Home />;
  }

  // Signup is currently an HTML page inside public/
  if (path === "/signup" || path === "/signup.html") {
    window.location.replace("/signup.html");
    return null;
  }

  return <Login />;
}

export default App;