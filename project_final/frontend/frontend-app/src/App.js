import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Home from "./pages/home";

function App() {
  const path = window.location.pathname;

  if (path === "/" || path === "/login") {
    return <Login />;
  }

  if (path === "/signup" || path === "/signup.html") {
    return <Signup />;
  }

  if (path === "/dashboard") {
    return <Home />;
  }

  return <Login />;
}

export default App;