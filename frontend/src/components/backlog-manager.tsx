import { ListBulletsIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { useState } from "preact/hooks";

import { useLanguage } from "../i18n/i18n";
import { type GameList, getSelectedGameHours } from "../types";
import { Button, Field, Input } from "./ui";

interface Props {
  backlogs: GameList[];
  activeBacklogIndex: number;
  onSelect: (index: number) => void;
  onCreate: (name: string) => void;
  onDelete: (index: number) => void;
}

export function BacklogManager({
  backlogs,
  activeBacklogIndex,
  onSelect,
  onCreate,
  onDelete,
}: Props) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [newBacklogName, setNewBacklogName] = useState("");
  const activeBacklog = backlogs[activeBacklogIndex];
  const activeHours = getBacklogHours(activeBacklog);
  const allGames = backlogs.flatMap((backlog) => backlog.games);
  const allHours = backlogs.reduce(
    (total, backlog) => total + getBacklogHours(backlog),
    0,
  );

  const createBacklog = () => {
    const name = newBacklogName.trim();
    if (!name) {
      return;
    }

    onCreate(name);
    setNewBacklogName("");
  };

  return (
    <section class="backlog-manager" aria-label={t.app.backlogs}>
      <div class="backlog-manager__summary">
        <div class="backlog-manager__current">
          <span class="backlog-manager__label">{t.app.currentBacklog}</span>
          <strong>{activeBacklog.name}</strong>
          <span class="backlog-manager__meta">
            {t.app.backlogStats(
              activeBacklog.games.length,
              activeHours.toFixed(1),
            )}
          </span>
        </div>
        <div class="backlog-manager__actions">
          <Button
            aria-label={t.app.newBacklog}
            title={t.app.newBacklog}
            onClick={() => onCreate(t.app.newBacklogName(backlogs.length + 1))}
            size="sm"
            variant="ghost"
          >
            <PlusIcon aria-hidden="true" />
          </Button>
          <Button
            aria-expanded={isOpen}
            aria-controls="backlog-manager-panel"
            onClick={() => setIsOpen((open) => !open)}
            size="sm"
          >
            <ListBulletsIcon aria-hidden="true" />
            {t.app.manageBacklogs}
          </Button>
        </div>
      </div>

      <p class="backlog-manager__total">
        <span>{t.app.backlogCount(backlogs.length)}</span>
        <span>{t.app.allBacklogs(allGames.length, allHours.toFixed(1))}</span>
      </p>

      {isOpen && (
        <div id="backlog-manager-panel" class="backlog-manager__panel">
          <div class="backlog-manager__panel-heading">
            <div>
              <p class="backlog-manager__label">{t.app.backlogs}</p>
              <h2>{t.app.manageBacklogs}</h2>
            </div>
          </div>

          <div class="backlog-manager__collection">
            {backlogs.map((backlog, index) => {
              const hours = getBacklogHours(backlog);
              const isActive = index === activeBacklogIndex;

              return (
                <div
                  key={`${backlog.name}-${index}`}
                  class={`backlog-manager__item ${
                    isActive ? "backlog-manager__item--active" : ""
                  }`}
                >
                  <button
                    type="button"
                    class="backlog-manager__select"
                    aria-current={isActive ? "true" : undefined}
                    aria-label={t.app.backlogSelection(
                      backlog.name,
                      backlog.games.length,
                      hours.toFixed(1),
                    )}
                    onClick={() => onSelect(index)}
                  >
                    <span>{backlog.name}</span>
                    <small>
                      {t.app.backlogStats(
                        backlog.games.length,
                        hours.toFixed(1),
                      )}
                    </small>
                  </button>
                  <button
                    type="button"
                    class="backlog-manager__delete"
                    aria-label={t.app.deleteBacklog(backlog.name)}
                    title={
                      backlogs.length === 1
                        ? t.app.deleteLastBacklogHint
                        : t.app.deleteBacklog(backlog.name)
                    }
                    disabled={backlogs.length === 1}
                    onClick={() => onDelete(index)}
                  >
                    <TrashIcon aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>

          {backlogs.length === 1 && (
            <p class="backlog-manager__hint">{t.app.deleteLastBacklogHint}</p>
          )}

          <form
            class="backlog-manager__create"
            onSubmit={(event) => {
              event.preventDefault();
              createBacklog();
            }}
          >
            <Field
              label={t.app.newBacklogNameLabel}
              controlId="new-backlog-name"
            >
              <Input
                id="new-backlog-name"
                value={newBacklogName}
                placeholder={t.app.newBacklogName(backlogs.length + 1)}
                onInput={(event) =>
                  setNewBacklogName((event.target as HTMLInputElement).value)
                }
              />
            </Field>
            <Button type="submit" disabled={!newBacklogName.trim()}>
              <PlusIcon aria-hidden="true" />
              {t.app.createBacklog}
            </Button>
          </form>
        </div>
      )}
    </section>
  );
}

function getBacklogHours(backlog: GameList): number {
  return backlog.games.reduce(
    (total, game) => total + getSelectedGameHours(game),
    0,
  );
}
