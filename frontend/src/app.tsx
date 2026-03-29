import Router from "preact-router";

import { HomePage } from "./pages/home";

export function App() {
  return (
    <div>
      <Router>
        <HomePage path="/" />
      </Router>
    </div>
  );
}
