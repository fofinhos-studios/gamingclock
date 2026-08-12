import { describe, expect, test } from "bun:test";
import { render } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";

import { HomePage } from "../pages/home";
import { LanguageProvider, detectLanguage } from "./i18n";
import { strings } from "./strings";

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
    expect(view.getByRole("heading", { name: "Adicione jogos" })).toBeTruthy();
    expect(view.getByDisplayValue("Minha lista")).toBeTruthy();

    await user.selectOptions(chooser, "en");

    expect(view.getByRole("combobox", { name: "Language" })).toBeTruthy();
    expect(view.getByRole("heading", { name: "Add games" })).toBeTruthy();
    expect(view.getByDisplayValue("My Backlog")).toBeTruthy();
    expect(window.localStorage.getItem("gaming-clock.language")).toBe("en");

    const backlogName = view.getByDisplayValue("My Backlog");
    await user.clear(backlogName);
    await user.type(backlogName, "Weekend games");
    await user.selectOptions(
      view.getByRole("combobox", { name: "Language" }),
      "pt-BR",
    );

    expect(view.getByDisplayValue("Weekend games")).toBeTruthy();
  });

  test("uses direct copy without em dashes in each language", () => {
    expect(strings.en.app.steps.games.eyebrow).toBe(
      "Add the games you want to play.",
    );
    expect(strings.en.tabs.copy).toBe(
      "Add games, set your time, then create a schedule.",
    );
    expect(
      strings.en.tabs.aria(1, "Add games", "games", "Current step"),
    ).not.toContain("—");
    expect(strings["pt-BR"].app.steps.games.eyebrow).toBe(
      "Adicione os jogos que você quer jogar.",
    );
    expect(
      strings["pt-BR"].tabs.aria(1, "Adicionar jogos", "games", "Etapa atual"),
    ).not.toContain("—");
  });
});
