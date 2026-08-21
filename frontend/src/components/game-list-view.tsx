import {
  ArrowClockwiseIcon,
  ArrowDownIcon,
  ArrowUpIcon,
  CircleNotchIcon,
  ListBulletsIcon,
  TrashIcon,
  TrophyIcon,
} from "@phosphor-icons/react";
import { useLanguage } from "../i18n/i18n";
import type { HLTBCategory, ListGame } from "../types";
import { GameCartridge } from "./game-cartridge";
import { Button, Field } from "./ui";

interface Props {
  name: string;
  games: ListGame[];
  onRemoveGame: (igdbId: number) => void;
  onSelectGameTime: (index: number, category: HLTBCategory) => void;
  onRetryGame: (igdbId: number) => void;
  onMoveGame: (index: number, direction: -1 | 1) => void;
  onRenameList: (name: string) => void;
}

export function GameListView({
  name,
  games,
  onRemoveGame,
  onSelectGameTime,
  onRetryGame,
  onMoveGame,
  onRenameList,
}: Props) {
  const { t } = useLanguage();
  return (
    <section aria-labelledby="current-list-heading" class="space-y-4">
      <div class="planner-pane__header">
        <div class="space-y-1">
          <h2
            id="current-list-heading"
            class="planner-panel__title planner-heading"
          >
            <ListBulletsIcon
              class="planner-icon planner-heading__icon"
              aria-hidden="true"
            />
            <span>{t.list.title}</span>
          </h2>
        </div>
        <div class="planner-inline-stats">
          <span>{t.list.count(games.length)}</span>
          {games.length === 0 && <span>0.0h</span>}
        </div>
      </div>

      <Field
        label={t.list.backlogName}
        controlId="active-list-name"
        class="max-w-md"
      >
        <input
          id="active-list-name"
          type="text"
          value={name}
          onInput={(event) =>
            onRenameList((event.target as HTMLInputElement).value)
          }
          class="ui-input"
        />
      </Field>

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
            <article key={game.igdb_id} class="planner-backlog-row">
              <GameCartridge game={game} />

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
                          <button
                            key={category}
                            type="button"
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
                            aria-label={t.list.useTime(String(label), hours)}
                            onClick={() =>
                              onSelectGameTime(index, category as HLTBCategory)
                            }
                          >
                            {`${hours}h ${String(label).toLowerCase()}`}
                          </button>
                        ) : null,
                      )}
                    </>
                  )}
                  {game.release_year !== null && (
                    <span class="planner-chip">{game.release_year}</span>
                  )}
                </fieldset>
              </div>

              <div class="planner-backlog-row__actions">
                <div
                  class="planner-backlog-row__reorder"
                  aria-label={t.list.reorder(game.name)}
                >
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
    </section>
  );
}
