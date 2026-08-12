import Router from "preact-router";

import { LanguageProvider } from "./i18n/i18n";
import { HomePage } from "./pages/home";

export function App() {
  return (
    <LanguageProvider>
      <Router>
        <HomePage path="/" />
      </Router>
    </LanguageProvider>
  );
}
