import { ArrowLeftIcon, ArrowRightIcon } from "@phosphor-icons/react";
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
  const backHelp = previousTab === null ? t.tabs.firstStep : "";
  const backHelpId = backHelp ? "planner-step-actions-back-help" : undefined;
  const continueHelp =
    nextTab === null
      ? t.tabs.lastStep
      : canContinue
        ? ""
        : activeTab === "games"
          ? t.tabs.gamesRequired
          : t.tabs.availabilityRequired;
  const continueHelpId = continueHelp
    ? "planner-step-actions-continue-help"
    : undefined;
  return (
    <div class="planner-step-actions">
      <Button
        class="planner-step-actions__back"
        variant="ghost"
        size="sm"
        disabled={previousTab === null}
        title={backHelp || undefined}
        aria-description={backHelp || undefined}
        aria-describedby={backHelpId}
        onClick={() => {
          if (previousTab) onChange(previousTab);
        }}
      >
        <ArrowLeftIcon class="planner-icon" aria-hidden="true" />
        {t.tabs.backTo(previousTab ? tabLabels[previousTab] : tabLabels.games)}
      </Button>

      <Button
        class="planner-step-actions__continue"
        variant={nextTab && canContinue ? "primary" : "outline"}
        size="sm"
        disabled={nextTab === null || !canContinue}
        title={continueHelp || undefined}
        aria-description={continueHelp || undefined}
        aria-describedby={continueHelpId}
        onClick={() => {
          if (nextTab && canContinue) onChange(nextTab);
        }}
      >
        {nextTab ? t.tabs.continueTo(tabLabels[nextTab]) : t.tabs.continue}
        <ArrowRightIcon class="planner-icon" aria-hidden="true" />
      </Button>
      {backHelp && (
        <span id={backHelpId} class="sr-only">
          {backHelp}
        </span>
      )}
      {continueHelp && (
        <span id={continueHelpId} class="sr-only">
          {continueHelp}
        </span>
      )}
    </div>
  );
}
