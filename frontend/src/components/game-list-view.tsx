import { Check, List, Trash2, Trophy } from "lucide-preact";
import { useState } from "preact/hooks";
import { useTransientFeedback } from "../hooks/use-transient-feedback";
import {
  type HLTBCategory,
  type ListGame,
  getSelectedGameHours,
} from "../types";
import { Button, Field } from "./ui";

interface Props {
  name: string;
  games: ListGame[];
  onRemoveGame: (index: number) => void;
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
  const [removingIndex, setRemovingIndex] = useState<number | null>(null);
  const removeFeedback = useTransientFeedback<number>(1500);
  const previewCoverUrl = (coverUrl: string) =>
    coverUrl.replace("/t_thumb/", "/t_cover_small/");

  const totalHours = games.reduce(
    (sum, game) => sum + getSelectedGameHours(game),
    0,
  );

  const handleRemoveGame = async (index: number) => {
    setRemovingIndex(index);
    removeFeedback.trigger(index, 1500);
    await new Promise((resolve) => window.setTimeout(resolve, 700));
    onRemoveGame(index);
    setRemovingIndex(null);
  };

  return (
    <section aria-labelledby="current-list-heading" class="space-y-4">
      <div class="planner-pane__header">
        <div class="space-y-1">
          <p class="section-eyebrow">Backlog</p>
          <h2
            id="current-list-heading"
            class="planner-panel__title planner-heading"
          >
            <List
              class="planner-icon planner-heading__icon"
              aria-hidden="true"
            />
            <span>Current list</span>
          </h2>
        </div>
        <div class="planner-inline-stats">
          <span>{games.length} games</span>
          <span>{totalHours.toFixed(1)}h resolved</span>
        </div>
      </div>

      <Field label="Backlog name" controlId="active-list-name" class="max-w-md">
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
          <Trophy
            class="planner-icon planner-empty-state__icon"
            aria-hidden="true"
          />
          <p class="planner-empty-state__title">
            No games in this backlog yet.
          </p>
          <p class="planner-empty-state__text">
            Search on the left and add titles directly into the list.
          </p>
        </div>
      ) : (
        <div class="planner-backlog-list">
          {games.map((game, index) => (
            <article key={`${game.name}-${index}`} class="planner-backlog-row">
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
                  No image
                </div>
              )}

              <div class="planner-backlog-row__body">
                <div class="planner-backlog-row__header">
                  <h3 class="planner-backlog-row__title">{game.name}</h3>
                  <div
                    class="planner-chip-group"
                    aria-label={`${game.name} HLTB times`}
                  >
                    {[
                      ["main", "Main", game.main_story_hours],
                      ["extras", "Extras", game.main_extra_hours],
                      [
                        "completionist",
                        "Completionist",
                        game.completionist_hours,
                      ],
                    ].map(([category, label, hours]) =>
                      typeof hours === "number" ? (
                        <button
                          key={category}
                          type="button"
                          class={`planner-hltb-option ${
                            (game.selected_hltb_category ?? "main") === category
                              ? "planner-hltb-option--active"
                              : ""
                          }`}
                          aria-pressed={
                            (game.selected_hltb_category ?? "main") === category
                          }
                          aria-label={`Use ${label} time: ${hours} hours`}
                          onClick={() =>
                            onSelectGameTime(index, category as HLTBCategory)
                          }
                        >
                          {`${hours}h ${label.toLowerCase()}`}
                        </button>
                      ) : null,
                    )}
                    {game.release_year !== null && (
                      <span class="planner-chip">{game.release_year}</span>
                    )}
                  </div>
                </div>
              </div>

              <div class="planner-backlog-row__actions">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void handleRemoveGame(index)}
                  disabled={removingIndex === index}
                  feedbackState={
                    removingIndex === index || removeFeedback.active === index
                      ? "success"
                      : "idle"
                  }
                >
                  {removingIndex === index ||
                  removeFeedback.active === index ? (
                    <Check class="planner-icon" aria-hidden="true" />
                  ) : (
                    <Trash2 class="planner-icon" aria-hidden="true" />
                  )}
                  {removingIndex === index || removeFeedback.active === index
                    ? "Removed"
                    : "Remove"}
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
