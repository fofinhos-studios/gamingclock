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
  return (
    <div
      role="tablist"
      aria-label="Planner steps"
      class="flex flex-wrap gap-3 border-b-2 border-black pb-6"
    >
      {PLANNER_TABS.map((tab) => (
        <Button
          key={tab.id}
          id={`planner-tab-${tab.id}`}
          role="tab"
          type="button"
          size="sm"
          variant={tab.id === activeTab ? "primary" : "outline"}
          aria-selected={tab.id === activeTab}
          aria-controls={`planner-panel-${tab.id}`}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </Button>
      ))}
    </div>
  );
}
