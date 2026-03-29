import { Button } from "./ui";

const PLANNER_TABS = [
  { id: "games", label: "Games" },
  { id: "availability", label: "Availability" },
  { id: "schedule", label: "Schedule" },
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

    if (event.key === "ArrowRight") {
      nextIndex = (index + 1) % PLANNER_TABS.length;
    } else if (event.key === "ArrowLeft") {
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
    <div
      role="tablist"
      aria-label="Planner steps"
      aria-orientation="horizontal"
      class="flex flex-wrap gap-3 border-b-2 border-black pb-6"
    >
      {PLANNER_TABS.map((tab, index) => (
        <Button
          key={tab.id}
          id={`planner-tab-${tab.id}`}
          role="tab"
          type="button"
          size="sm"
          variant={tab.id === activeTab ? "primary" : "outline"}
          aria-selected={tab.id === activeTab}
          aria-controls={`planner-panel-${tab.id}`}
          tabIndex={tab.id === activeTab ? 0 : -1}
          onClick={() => onChange(tab.id)}
          onKeyDown={(event) => handleKeyDown(event as KeyboardEvent, index)}
        >
          {tab.label}
        </Button>
      ))}
    </div>
  );
}
