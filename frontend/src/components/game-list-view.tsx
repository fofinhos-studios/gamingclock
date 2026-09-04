import {
  ArrowClockwiseIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  CircleNotchIcon,
  ClockIcon,
  DotsSixVerticalIcon,
  ListBulletsIcon,
  PencilSimpleIcon,
  TrashIcon,
  TrophyIcon,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "preact/hooks";
import { GAME_GROUPS_ENABLED } from "../config/features";
import { useLanguage } from "../i18n/i18n";
import type { GameGroupImport, HLTBCategory, ListGame } from "../types";
import { GameCartridge } from "./game-cartridge";
import { Button } from "./ui";

interface Props {
  name: string;
  games: ListGame[];
  onRemoveGame: (igdbId: number) => void;
  onSelectGameTime: (index: number, category: HLTBCategory) => void;
  onRetryGame: (igdbId: number) => void;
  onMoveGame: (index: number, direction: -1 | 1) => void;
  onReorderGames: (sourceIndex: number, targetIndex: number) => void;
  onRenameList: (name: string) => void;
  groupImports?: GameGroupImport[];
  onRemoveGroupImport?: (importId: string) => void;
  onRemoveGroup?: (groupKey: string) => void;
}

type DropTarget = {
  index: number;
  position: "before" | "after";
};

function formatPlaytime(hours: number): string {
  const totalMinutes = Math.round(hours * 60);
  const wholeHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  return remainingMinutes === 0
    ? `${wholeHours}h`
    : `${wholeHours}h ${remainingMinutes}m`;
}

export function GameListView({
  name,
  games,
  onRemoveGame,
  onSelectGameTime,
  onRetryGame,
  onMoveGame,
  onReorderGames,
  onRenameList,
  groupImports = [],
  onRemoveGroupImport,
  onRemoveGroup,
}: Props) {
  const { t } = useLanguage();
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dropTarget, setDropTarget] = useState<DropTarget | null>(null);
  const [managedImportId, setManagedImportId] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming) {
      renameInputRef.current?.focus();
    }
  }, [isRenaming]);

  const saveListName = () => {
    const trimmedName = draftName.trim();
    if (trimmedName) {
      onRenameList(trimmedName);
    } else {
      setDraftName(name);
    }
    setIsRenaming(false);
  };

  const cancelRename = () => {
    setDraftName(name);
    setIsRenaming(false);
  };

  const getDropTarget = (index: number, event: DragEvent): DropTarget => {
    const bounds = (event.currentTarget as HTMLElement).getBoundingClientRect();
    return {
      index,
      position:
        event.clientY > bounds.top + bounds.height / 2 ? "after" : "before",
    };
  };

  const resetDragState = () => {
    setDraggedIndex(null);
    setDropTarget(null);
  };

  return (
    <section aria-label={name} class="space-y-4">
      <div class="planner-pane__header">
        <div class="planner-list-name">
          {isRenaming ? (
            <form
              class="planner-list-name__form"
              onSubmit={(event) => {
                event.preventDefault();
                saveListName();
              }}
            >
              <label class="sr-only" for="active-list-name">
                {t.list.backlogName}
              </label>
              <input
                id="active-list-name"
                type="text"
                value={draftName}
                ref={renameInputRef}
                class="ui-input planner-list-name__input"
                onInput={(event) =>
                  setDraftName((event.target as HTMLInputElement).value)
                }
                onBlur={saveListName}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    cancelRename();
                  }
                }}
              />
            </form>
          ) : (
            <>
              <h2 class="planner-panel__title planner-heading">
                <ListBulletsIcon
                  class="planner-icon planner-heading__icon"
                  aria-hidden="true"
                />
                <span>{name}</span>
              </h2>
              <Button
                unstyled
                class="planner-list-name__rename"
                aria-label={t.list.renameBacklog(name)}
                title={t.list.renameBacklog(name)}
                onClick={() => {
                  setDraftName(name);
                  setIsRenaming(true);
                }}
              >
                <PencilSimpleIcon class="planner-icon" aria-hidden="true" />
              </Button>
            </>
          )}
        </div>
        <div class="planner-inline-stats">
          <span>{t.list.count(games.length)}</span>
          {games.length === 0 && <span>0.0h</span>}
        </div>
      </div>

      {games.length === 0 ? (
        <div class="planner-empty-state">
          <TrophyIcon
            class="planner-icon planner-empty-state__icon"
            aria-hidden="true"
          />
          <p class="planner-empty-state__title">{t.list.emptyTitle}</p>
          <p class="planner-empty-state__text">{t.list.emptyCopy}</p>
        </div>
      ) : (
        <div class="planner-backlog-list">
          {games.map((game, index) => (
            <article
              key={game.igdb_id}
              class={`planner-backlog-row${
                draggedIndex === index ? " planner-backlog-row--dragging" : ""
              }${
                dropTarget?.index === index
                  ? ` planner-backlog-row--drop-${dropTarget.position}`
                  : ""
              }${
                managedImportId &&
                game.group_import_ids?.includes(managedImportId)
                  ? " planner-backlog-row--active"
                  : ""
              }`}
              draggable
              onDragStart={(event) => {
                event.dataTransfer?.setData("text/plain", String(game.igdb_id));
                if (event.dataTransfer) {
                  event.dataTransfer.effectAllowed = "move";
                }
                setDraggedIndex(index);
              }}
              onDragOver={(event) => {
                if (draggedIndex === null || draggedIndex === index) {
                  return;
                }
                event.preventDefault();
                if (event.dataTransfer) {
                  event.dataTransfer.dropEffect = "move";
                }
                setDropTarget(getDropTarget(index, event));
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (draggedIndex === null || draggedIndex === index) {
                  resetDragState();
                  return;
                }

                const target = getDropTarget(index, event);
                let targetIndex =
                  target.index + (target.position === "after" ? 1 : 0);
                if (draggedIndex < targetIndex) {
                  targetIndex -= 1;
                }
                resetDragState();
                onReorderGames(draggedIndex, targetIndex);
              }}
              onDragEnd={resetDragState}
            >
              <GameCartridge game={game} />
              {GAME_GROUPS_ENABLED &&
                game.group_import_ids?.[0] &&
                groupImports.find(
                  (groupImport) =>
                    groupImport.id === game.group_import_ids?.[0],
                ) && (
                  <p class="planner-group-source-chip">
                    {
                      groupImports.find(
                        (groupImport) =>
                          groupImport.id === game.group_import_ids?.[0],
                      )?.display_name
                    }
                  </p>
                )}

              <div class="planner-backlog-row__controls">
                <fieldset class="planner-chip-group">
                  <legend class="sr-only">
                    {t.list.playtimeOptions(game.name)}
                  </legend>
                  {game.hltb_status === "loading" ? (
                    <span
                      class="planner-chip planner-chip--loading"
                      aria-live="polite"
                    >
                      <CircleNotchIcon
                        class="planner-icon planner-icon--spin"
                        aria-hidden="true"
                      />
                      {t.list.retrieving}
                    </span>
                  ) : game.hltb_status === "unresolved" ? (
                    <>
                      <span class="planner-chip" aria-live="polite">
                        {t.list.unavailable}
                      </span>
                      {game.hltb_error && (
                        <span class="planner-chip" role="alert">
                          {game.hltb_error}
                        </span>
                      )}
                    </>
                  ) : (
                    <>
                      {games.length === 1 && index === 0 && (
                        <span class="planner-hltb-onboarding">
                          {t.list.onboarding}
                        </span>
                      )}
                      {[
                        ["main", t.list.main, game.main_story_hours],
                        ["extras", t.list.extras, game.main_extra_hours],
                        [
                          "completionist",
                          t.list.completionist,
                          game.completionist_hours,
                        ],
                      ].map(([category, label, hours]) =>
                        typeof hours === "number" ? (
                          <Button
                            key={category}
                            unstyled
                            class={`planner-hltb-option ${
                              (game.selected_hltb_category ?? "main") ===
                              category
                                ? "planner-hltb-option--active"
                                : ""
                            }`}
                            aria-pressed={
                              (game.selected_hltb_category ?? "main") ===
                              category
                            }
                            aria-label={t.list.useTime(
                              String(label),
                              formatPlaytime(hours),
                            )}
                            onClick={() =>
                              onSelectGameTime(index, category as HLTBCategory)
                            }
                          >
                            <ClockIcon
                              class="planner-hltb-option__icon"
                              aria-hidden="true"
                            />
                            {`${formatPlaytime(hours)} ${String(label).toLowerCase()}`}
                          </Button>
                        ) : null,
                      )}
                    </>
                  )}
                </fieldset>
              </div>

              <div class="planner-backlog-row__actions">
                <div
                  class="planner-backlog-row__reorder"
                  aria-label={t.list.reorder(game.name)}
                >
                  <span
                    class="planner-drag-hint"
                    aria-label={t.list.dragToReorder(game.name)}
                    title={t.list.dragToReorder(game.name)}
                  >
                    <DotsSixVerticalIcon
                      class="planner-icon"
                      aria-hidden="true"
                    />
                    <span>{t.list.drag}</span>
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    class="planner-reorder-button"
                    aria-label={t.list.moveEarlier(game.name)}
                    disabled={index === 0}
                    onClick={() => onMoveGame(index, -1)}
                  >
                    <ArrowUpIcon class="planner-icon" aria-hidden="true" />
                    <span>{t.list.earlier}</span>
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    class="planner-reorder-button"
                    aria-label={t.list.moveLater(game.name)}
                    disabled={index === games.length - 1}
                    onClick={() => onMoveGame(index, 1)}
                  >
                    <ArrowDownIcon class="planner-icon" aria-hidden="true" />
                    <span>{t.list.later}</span>
                  </Button>
                </div>

                <div class="planner-backlog-row__action-group">
                  {game.hltb_status === "unresolved" && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      aria-label={t.list.retryPlaytime(game.name)}
                      onClick={() => onRetryGame(game.igdb_id)}
                    >
                      <ArrowClockwiseIcon
                        class="planner-icon"
                        aria-hidden="true"
                      />
                      {t.list.retry}
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onRemoveGame(game.igdb_id)}
                  >
                    <TrashIcon class="planner-icon" aria-hidden="true" />
                    {t.list.remove}
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {GAME_GROUPS_ENABLED && groupImports.length > 0 && (
        <section class="planner-group-tray" aria-label={t.list.groupTray}>
          <h3 class="planner-panel__title">{t.list.groupTray}</h3>
          {groupImports.map((groupImport) => {
            const associatedGames = games.filter((game) =>
              game.group_import_ids?.includes(groupImport.id),
            );
            return (
              <div key={groupImport.id} class="planner-group-tray__row">
                <span>
                  {groupImport.display_name} ·{" "}
                  {t.list.groupGames(associatedGames.length)}
                </span>
                <div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setManagedImportId(groupImport.id)}
                  >
                    {t.list.manageGroup}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const removed = associatedGames.filter(
                        (game) =>
                          !game.added_individually &&
                          (game.group_import_ids?.length ?? 0) === 1,
                      ).length;
                      const kept = associatedGames.length - removed;
                      if (
                        window.confirm(
                          t.list.removeImportConfirm(removed, kept),
                        )
                      ) {
                        onRemoveGroupImport?.(groupImport.id);
                      }
                    }}
                  >
                    {t.list.removeImport}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const count = games.filter((game) =>
                        game.group_keys?.includes(groupImport.group_key),
                      ).length;
                      if (
                        window.confirm(
                          t.list.removeAllGroupConfirm(
                            groupImport.display_name,
                            count,
                          ),
                        )
                      ) {
                        onRemoveGroup?.(groupImport.group_key);
                      }
                    }}
                  >
                    {t.list.removeAllGroup}
                  </Button>
                </div>
              </div>
            );
          })}
        </section>
      )}
    </section>
  );
}
