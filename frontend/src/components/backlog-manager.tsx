import { ListBulletsIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { useState } from "preact/hooks";

import { useLanguage } from "../i18n/i18n";
import { type GameList, getSelectedGameHours } from "../types";
import { Button, Field, Input } from "./ui";

interface Props {
  backlogs: GameList[];
  activeBacklogId: string;
  onSelect: (id: string) => void;
  onCreate: (name: string) => void;
  onDelete: (id: string) => void;
}

export function BacklogManager({
  backlogs,
  activeBacklogId,
  onSelect,
  onCreate,
  onDelete,
}: Props) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [newBacklogName, setNewBacklogName] = useState("");
  const activeBacklog =
    backlogs.find((backlog) => backlog.id === activeBacklogId) ?? backlogs[0];
  const activeHours = getBacklogHours(activeBacklog);

  const createBacklog = () => {
    const name = newBacklogName.trim();
    if (!name) {
      return;
    }

    onCreate(name);
    setNewBacklogName("");
  };

  return (
    <section
      class="backlog-manager planner-toolbar__backlogs"
      aria-label={t.app.backlogs}
    >
      <div class="backlog-manager__summary">
        <Button
          class="backlog-manager__current"
          variant="outline"
          size="sm"
          aria-expanded={isOpen}
          aria-controls="backlog-manager-panel"
          aria-label={t.app.manageBacklogs}
          onClick={() => setIsOpen((open) => !open)}
        >
          <ListBulletsIcon aria-hidden="true" />
          <span class="backlog-manager__current-name">
            {activeBacklog.name}
          </span>
          <span class="backlog-manager__meta">
            {t.app.backlogStats(
              activeBacklog.games.length,
              activeHours.toFixed(1),
            )}
          </span>
        </Button>
      </div>

      {isOpen && (
        <div id="backlog-manager-panel" class="backlog-manager__panel">
          <div class="backlog-manager__panel-heading">
            <div>
              <h2>{t.app.backlogs}</h2>
            </div>
          </div>

          <div class="backlog-manager__collection">
            {backlogs.map((backlog) => {
              const hours = getBacklogHours(backlog);
              const isActive = backlog.id === activeBacklogId;

              return (
                <div
                  key={backlog.id}
                  class={`backlog-manager__item ${
                    isActive ? "backlog-manager__item--active" : ""
                  }`}
                >
                  <Button
                    unstyled
                    class="backlog-manager__select"
                    aria-current={isActive ? "true" : undefined}
                    aria-label={t.app.backlogSelection(
                      backlog.name,
                      backlog.games.length,
                      hours.toFixed(1),
                    )}
                    onClick={() => onSelect(backlog.id)}
                  >
                    <span>{backlog.name}</span>
                    <small>
                      {t.app.backlogStats(
                        backlog.games.length,
                        hours.toFixed(1),
                      )}
                    </small>
                  </Button>
                  <Button
                    unstyled
                    class="backlog-manager__delete"
                    aria-label={t.app.deleteBacklog(backlog.name)}
                    title={
                      backlogs.length === 1
                        ? t.app.deleteLastBacklogHint
                        : t.app.deleteBacklog(backlog.name)
                    }
                    disabled={backlogs.length === 1}
                    onClick={() => onDelete(backlog.id)}
                  >
                    <TrashIcon aria-hidden="true" />
                  </Button>
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
