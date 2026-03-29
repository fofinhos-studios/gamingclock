import { CalendarDays, CalendarRange, Gamepad2 } from "lucide-preact";

const PLANNER_TABS = [
  { id: "games", label: "Games", icon: Gamepad2 },
  { id: "availability", label: "Availability", icon: CalendarDays },
  { id: "schedule", label: "Schedule", icon: CalendarRange },
] as const;

export type PlannerTab = (typeof PLANNER_TABS)[number]["id"];

interface Props {
  activeTab: PlannerTab;
  onChange: (tab: PlannerTab) => void;
}

export function PlannerTabs({ activeTab, onChange }: Props) {
  const focusTab = (tab: PlannerTab) => {
    onChange(tab);
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
    <nav class="planner-rail" aria-label="Planner workflow">
      <p class="planner-rail__eyebrow">Workflow</p>
      <div
        role="tablist"
        aria-label="Planner steps"
        aria-orientation="vertical"
        class="planner-rail__list"
      >
        {PLANNER_TABS.map((tab, index) => {
          const selected = tab.id === activeTab;
          const Icon = tab.icon;

          return (
            <button
              key={tab.id}
              id={`planner-tab-${tab.id}`}
              role="tab"
              type="button"
              class={`planner-rail__tab ${
                selected ? "planner-rail__tab--active" : ""
              }`}
              aria-selected={selected}
              aria-controls={`planner-panel-${tab.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(tab.id)}
              onKeyDown={(event) =>
                handleKeyDown(event as KeyboardEvent, index)
              }
            >
              <span class="planner-rail__tab-index">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span class="planner-rail__tab-content">
                <Icon
                  class="planner-icon planner-rail__tab-icon"
                  aria-hidden="true"
                />
                <span class="planner-rail__tab-label">{tab.label}</span>
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
