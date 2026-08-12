import { CalendarDays, CalendarRange, Check, Gamepad2 } from "lucide-preact";
import { useTransientFeedback } from "../hooks/use-transient-feedback";

const PLANNER_TABS = [
  { id: "games", label: "Add games", icon: Gamepad2 },
  {
    id: "availability",
    label: "Choose your weekly play time",
    icon: CalendarDays,
  },
  { id: "schedule", label: "Make your schedule", icon: CalendarRange },
] as const;

export type PlannerTab = (typeof PLANNER_TABS)[number]["id"];

interface Props {
  activeTab: PlannerTab;
  completedTabs: PlannerTab[];
  onChange: (tab: PlannerTab) => void;
}

export function PlannerTabs({ activeTab, completedTabs, onChange }: Props) {
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
    <nav
      class="planner-stepper"
      aria-label="Build your game schedule step by step"
    >
      <div class="planner-stepper__intro">
        <p class="planner-stepper__eyebrow">Your game plan</p>
        <p class="planner-stepper__copy">
          Build your game schedule step by step. You can return to any step
          whenever you need to.
        </p>
      </div>
      <div
        role="tablist"
        aria-label="Planner steps"
        aria-orientation="horizontal"
        class="planner-stepper__list"
      >
        {PLANNER_TABS.map((tab, index) => {
          const selected = tab.id === activeTab;
          const complete = completedTabs.includes(tab.id);
          const Icon = tab.icon;
          const status = complete
            ? "Complete"
            : selected
              ? "Current step"
              : "Not started";

          return (
            <button
              key={tab.id}
              id={`planner-tab-${tab.id}`}
              role="tab"
              type="button"
              class={`planner-stepper__tab ${
                selected ? "planner-stepper__tab--active" : ""
              } ${complete ? "planner-stepper__tab--complete" : ""} ${feedback.active === tab.id ? "planner-stepper__tab--confirmed" : ""}`}
              aria-selected={selected}
              aria-controls={`planner-panel-${tab.id}`}
              aria-label={`Step ${index + 1}: ${tab.label} (${tab.id}) — ${status}`}
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
                {complete ? <Check class="planner-icon" /> : index + 1}
              </span>
              <span class="planner-stepper__tab-content">
                <Icon
                  class="planner-icon planner-stepper__tab-icon"
                  aria-hidden="true"
                />
                <span>
                  <span class="planner-stepper__tab-label">{tab.label}</span>
                  <span class="planner-stepper__tab-status">{status}</span>
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
