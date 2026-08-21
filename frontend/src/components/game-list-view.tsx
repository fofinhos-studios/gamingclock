import {
  CircleNotchIcon,
  ListBulletsIcon,
  TrashIcon,
  TrophyIcon,
} from "@phosphor-icons/react";
import { useLanguage } from "../i18n/i18n";
import {
  type HLTBCategory,
  type ListGame,
  getSelectedGameHours,
} from "../types";
import { Button, Field } from "./ui";

interface Props {
  name: string;
  games: ListGame[];
  onRemoveGame: (igdbId: number) => void;
  onSelectGameTime: (index: number, category: HLTBCategory) => void;
  onRenameList: (name: string) => void;
}

export function GameListView({
  name,
  games,
  onRemoveGame,
  onSelectGameTime,
  onRenameList,
}: Props) {
  const { t } = useLanguage();
  const previewCoverUrl = (coverUrl: string) =>
    coverUrl.replace("/t_thumb/", "/t_cover_small/");

  const totalHours = games.reduce(
    (sum, game) => sum + getSelectedGameHours(game),
    0,
  );

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
          <span>{totalHours.toFixed(1)}h</span>
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
              {game.cover_url ? (
                <img
                  src={previewCoverUrl(game.cover_url)}
                  alt={game.name}
                  loading="lazy"
                  decoding="async"
                  width={56}
                  height={80}
                  class="planner-backlog-row__cover"
                />
              ) : (
                <div class="planner-backlog-row__cover planner-backlog-row__cover--empty">
                  {t.list.noImage}
                </div>
              )}

              <div class="planner-backlog-row__body">
                <div class="planner-backlog-row__header">
                  <h3 class="planner-backlog-row__title">{game.name}</h3>
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
                      <span class="planner-chip">{t.list.unavailable}</span>
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
                                onSelectGameTime(
                                  index,
                                  category as HLTBCategory,
                                )
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
              </div>

              <div class="planner-backlog-row__actions">
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
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
