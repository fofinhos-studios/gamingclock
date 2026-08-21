import {
  CalendarDotsIcon,
  CalendarIcon,
  CheckIcon,
  GameControllerIcon,
} from "@phosphor-icons/react";
import { useTransientFeedback } from "../hooks/use-transient-feedback";
import { useLanguage } from "../i18n/i18n";
import { Button } from "./ui";

const PLANNER_TABS = [
  { id: "games", icon: GameControllerIcon },
  { id: "availability", icon: CalendarDotsIcon },
  { id: "schedule", icon: CalendarIcon },
] as const;

export type PlannerTab = (typeof PLANNER_TABS)[number]["id"];

interface Props {
  activeTab: PlannerTab;
  completedTabs: PlannerTab[];
  onChange: (tab: PlannerTab) => void;
}

export function PlannerTabs({ activeTab, completedTabs, onChange }: Props) {
  const { t } = useLanguage();
  const feedback = useTransientFeedback<PlannerTab>(1400);

  const focusTab = (tab: PlannerTab) => {
    onChange(tab);
    feedback.trigger(tab);
    queueMicrotask(() => {
      const element = document.getElementById(`planner-tab-${tab}`);
      if (element instanceof HTMLButtonElement) {
        element.focus();
      }
    });
  };

  const handleKeyDown = (event: KeyboardEvent, index: number) => {
    let nextIndex = index;

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (index + 1) % PLANNER_TABS.length;
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (index - 1 + PLANNER_TABS.length) % PLANNER_TABS.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = PLANNER_TABS.length - 1;
    } else {
      return;
    }

    event.preventDefault();
    focusTab(PLANNER_TABS[nextIndex].id);
  };

  return (
    <nav class="planner-stepper" aria-label={t.tabs.nav}>
      <div
        role="tablist"
        aria-label={t.tabs.steps}
        aria-orientation="horizontal"
        class="planner-stepper__list"
      >
        {PLANNER_TABS.map((tab, index) => {
          const label =
            tab.id === "games"
              ? t.tabs.addGames
              : tab.id === "availability"
                ? t.tabs.availability
                : t.tabs.schedule;
          const selected = tab.id === activeTab;
          const complete = completedTabs.includes(tab.id);
          const Icon = tab.icon;
          const status = complete
            ? t.tabs.complete
            : selected
              ? t.tabs.current
              : t.tabs.notStarted;

          return (
            <div class="planner-stepper__item" key={tab.id}>
              <Button
                id={`planner-tab-${tab.id}`}
                role="tab"
                unstyled
                class={`planner-stepper__tab ${
                  selected ? "planner-stepper__tab--active" : ""
                } ${complete ? "planner-stepper__tab--complete" : ""} ${feedback.active === tab.id ? "planner-stepper__tab--confirmed" : ""}`}
                aria-selected={selected}
                aria-controls={`planner-panel-${tab.id}`}
                aria-label={t.tabs.aria(index + 1, label, tab.id, status)}
                tabIndex={selected ? 0 : -1}
                onClick={() => {
                  onChange(tab.id);
                  feedback.trigger(tab.id);
                }}
                onKeyDown={(event) =>
                  handleKeyDown(event as KeyboardEvent, index)
                }
              >
                <span class="planner-stepper__tab-marker" aria-hidden="true">
                  {complete ? <CheckIcon class="planner-icon" /> : index + 1}
                </span>
                <span class="planner-stepper__tab-content">
                  <Icon
                    class="planner-icon planner-stepper__tab-icon"
                    aria-hidden="true"
                  />
                  <span>
                    <span class="planner-stepper__tab-label">{label}</span>
                    <span class="planner-stepper__tab-status">{status}</span>
                  </span>
                </span>
              </Button>
            </div>
          );
        })}
      </div>
    </nav>
  );
}
