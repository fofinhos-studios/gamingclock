import { ArrowLeft, ArrowRight } from "lucide-preact";
import { useLanguage } from "../i18n/i18n";
import type { PlannerTab } from "./planner-tabs";
import { Button } from "./ui";

interface Props {
  activeTab: PlannerTab;
  canContinue: boolean;
  onChange: (tab: PlannerTab) => void;
}

const tabOrder: PlannerTab[] = ["games", "availability", "schedule"];

export function PlannerStepActions({
  activeTab,
  canContinue,
  onChange,
}: Props) {
  const { t } = useLanguage();
  const activeIndex = tabOrder.indexOf(activeTab);
  const previousTab = activeIndex > 0 ? tabOrder[activeIndex - 1] : null;
  const nextTab =
    activeIndex < tabOrder.length - 1 ? tabOrder[activeIndex + 1] : null;
  const tabLabels: Record<PlannerTab, string> = {
    games: t.tabs.addGames,
    availability: t.tabs.availability,
    schedule: t.tabs.schedule,
  };
  const backHelpId = "planner-stage-back-help";
  const continueHelpId = "planner-stage-continue-help";
  const backHelp = previousTab === null ? t.tabs.firstStep : "";
  const continueHelp =
    nextTab === null
      ? t.tabs.lastStep
      : canContinue
        ? ""
        : activeTab === "games"
          ? t.tabs.gamesRequired
          : t.tabs.availabilityRequired;
  return (
    <div class="planner-step-actions">
      <Button
        class="planner-step-actions__back"
        variant="ghost"
        size="sm"
        disabled={previousTab === null}
        aria-describedby={backHelp ? backHelpId : undefined}
        onClick={() => {
          if (previousTab) onChange(previousTab);
        }}
      >
        <ArrowLeft class="planner-icon" aria-hidden="true" />
        {t.tabs.backTo(previousTab ? tabLabels[previousTab] : tabLabels.games)}
      </Button>

      <div class="planner-step-actions__status">
        {backHelp && (
          <p id={backHelpId} class="planner-step-actions__help">
            {backHelp}
          </p>
        )}
        {continueHelp && (
          <p id={continueHelpId} class="planner-step-actions__help">
            {continueHelp}
          </p>
        )}
      </div>

      <Button
        class="planner-step-actions__continue"
        variant={nextTab && canContinue ? "primary" : "outline"}
        size="sm"
        disabled={nextTab === null || !canContinue}
        aria-describedby={continueHelp ? continueHelpId : undefined}
        onClick={() => {
          if (nextTab && canContinue) onChange(nextTab);
        }}
      >
        {nextTab ? t.tabs.continueTo(tabLabels[nextTab]) : t.tabs.continue}
        <ArrowRight class="planner-icon" aria-hidden="true" />
      </Button>
    </div>
  );
}
