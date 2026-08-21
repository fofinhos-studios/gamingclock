import { render } from "@testing-library/preact";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";

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
        <HomePage />
      </LanguageProvider>,
    );

    const chooser = view.getByRole("combobox", { name: "Idioma" });
    expect((chooser as HTMLSelectElement).value).toBe("pt-BR");
    expect(view.getByRole("heading", { name: "Adicione jogos" })).toBeTruthy();
    expect(view.getByDisplayValue("Minha lista")).toBeTruthy();
    expect(
      view.getByRole("button", {
        name: /continuar para definir rotina/i,
      }),
    ).toBeTruthy();
    expect(
      view
        .getByRole("button", { name: /continuar para definir rotina/i })
        .getAttribute("title"),
    ).toMatch(/adicione e resolva pelo menos um jogo/i);

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

  test("omits redundant planner subtitles in each language", () => {
    expect(strings.en.app.steps.games).not.toHaveProperty("eyebrow");
    expect(strings.en.app.steps.availability).not.toHaveProperty("eyebrow");
    expect(strings.en.app.steps.schedule).not.toHaveProperty("eyebrow");
    expect(strings.en.tabs).not.toHaveProperty("intro");
    expect(strings.en.tabs).not.toHaveProperty("copy");
    expect(strings.en.availability).not.toHaveProperty("copy");
    expect(strings.en.availability.form).not.toHaveProperty("startHourCopy");
    expect(strings.en.schedule).not.toHaveProperty("copy");
    expect(strings.en.schedule).not.toHaveProperty("section");
    expect(strings.en.schedule).not.toHaveProperty("output");
    expect(
      strings.en.tabs.aria(1, "Add games", "games", "Current step"),
    ).not.toContain("—");
    expect(strings["pt-BR"].app.steps.games).not.toHaveProperty("eyebrow");
    expect(strings["pt-BR"].app.steps.availability).not.toHaveProperty(
      "eyebrow",
    );
    expect(strings["pt-BR"].app.steps.schedule).not.toHaveProperty("eyebrow");
    expect(strings["pt-BR"].tabs).not.toHaveProperty("intro");
    expect(strings["pt-BR"].tabs).not.toHaveProperty("copy");
    expect(strings["pt-BR"].availability).not.toHaveProperty("copy");
    expect(strings["pt-BR"].availability.form).not.toHaveProperty(
      "startHourCopy",
    );
    expect(strings["pt-BR"].schedule).not.toHaveProperty("copy");
    expect(strings["pt-BR"].schedule).not.toHaveProperty("section");
    expect(strings["pt-BR"].schedule).not.toHaveProperty("output");
    expect(
      strings["pt-BR"].tabs.aria(1, "Adicionar jogos", "games", "Etapa atual"),
    ).not.toContain("—");
  });

  test("uses distinct copy for the availability step, page, and form", () => {
    expect(strings["pt-BR"].tabs.availability).toBe("Definir rotina");
    expect(strings["pt-BR"].app.steps.availability.title).toBe(
      "Quando você joga?",
    );
    expect(strings["pt-BR"].availability.heading).toBe("Dias e horários");
  });
});
