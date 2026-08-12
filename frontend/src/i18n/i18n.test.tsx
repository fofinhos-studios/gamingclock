import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";

import { HomePage } from "../pages/home";
import { LanguageProvider, detectLanguage } from "./i18n";

describe("i18n", () => {
  test("uses the browser's supported language and falls back to English", () => {
    expect(detectLanguage(["pt-BR", "en-US"])).toBe("pt-BR");
    expect(detectLanguage(["fr-FR"])).toBe("en");
  });

  test("lets a person choose a language and remembers the choice", async () => {
    window.localStorage.clear();
    const user = userEvent.setup();
    const view = render(
      <LanguageProvider browserLanguages={["pt-BR"]}>
        <HomePage path="/" />
      </LanguageProvider>,
    );

    const chooser = view.getByRole("combobox", { name: "Idioma" });
    expect((chooser as HTMLSelectElement).value).toBe("pt-BR");
    expect(view.getByRole("heading", { name: "Monte sua lista" })).toBeTruthy();

    await user.selectOptions(chooser, "en");

    expect(view.getByRole("combobox", { name: "Language" })).toBeTruthy();
    expect(view.getByRole("heading", { name: "Build backlog" })).toBeTruthy();
    expect(window.localStorage.getItem("gaming-clock.language")).toBe("en");
  });
});
