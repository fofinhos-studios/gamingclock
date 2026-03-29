import { List, Trash2, Trophy } from "lucide-preact";
import type { ListGame } from "../types";
import { Button, Field } from "./ui";

interface Props {
  name: string;
  games: ListGame[];
  onRemoveGame: (index: number) => void;
  onRenameList: (name: string) => void;
}

export function GameListView({
  name,
  games,
  onRemoveGame,
  onRenameList,
}: Props) {
  const previewCoverUrl = (coverUrl: string) =>
    coverUrl.replace("/t_thumb/", "/t_cover_small/");

  const totalHours = games.reduce(
    (sum, game) => sum + (game.main_story_hours ?? 0),
    0,
  );
  const unresolvedGames = games.filter(
    (game) =>
      game.hltb_status === "unresolved" || game.main_story_hours === null,
  );

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
          <span>{unresolvedGames.length} unresolved</span>
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
                  <div class="planner-chip-group">
                    <span class="planner-chip">
                      {game.main_story_hours === null
                        ? "No HLTB time"
                        : `${game.main_story_hours}h main`}
                    </span>
                    {game.release_year !== null && (
                      <span class="planner-chip">{game.release_year}</span>
                    )}
                  </div>
                </div>

                <p class="planner-backlog-row__detail">
                  {game.platforms.length > 0
                    ? game.platforms.join(", ")
                    : "Platforms unavailable"}
                </p>
                <p class="planner-backlog-row__detail">
                  {game.hltb_status === "resolved"
                    ? `Resolved from ${game.hltb_match_name ?? game.name}`
                    : "HLTB duration not found yet"}
                </p>
              </div>

              <div class="planner-backlog-row__actions">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onRemoveGame(index)}
                >
                  <Trash2 class="planner-icon" aria-hidden="true" />
                  Remove
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
