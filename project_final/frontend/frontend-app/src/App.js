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

  return <Login />;
}

export default App;