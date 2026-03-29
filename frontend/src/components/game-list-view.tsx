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
    <section aria-labelledby="current-list-heading" class="space-y-6">
      <div class="space-y-3">
        <p class="section-eyebrow">Current backlog</p>
        <h3 id="current-list-heading" class="text-4xl md:text-5xl">
          Active backlog
        </h3>
        <p class="section-copy max-w-none">
          Games: {games.length} / Resolved hours: {totalHours.toFixed(1)} /
          Unresolved games: {unresolvedGames.length}
        </p>
      </div>

      <Field label="Backlog name" controlId="active-list-name">
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
        <div class="empty-state space-y-3">
          <p class="text-3xl">No games in this backlog yet.</p>
          <p class="text-[var(--muted-foreground)]">
            Use search to add a few titles and start planning.
          </p>
        </div>
      ) : (
        <div class="grid gap-4">
          {games.map((game, index) => (
            <article
              key={`${game.name}-${index}`}
              class="group border border-black p-5 transition-colors duration-100 hover:bg-black hover:text-white"
            >
              <div class="grid gap-5 lg:grid-cols-[5rem_minmax(0,1fr)_auto]">
                <div>
                  {game.cover_url ? (
                    <img
                      src={previewCoverUrl(game.cover_url)}
                      alt={game.name}
                      loading="lazy"
                      decoding="async"
                      width={80}
                      height={120}
                      class="h-30 w-20 border-2 border-current object-cover transition-all duration-100 group-hover:border-[4px]"
                    />
                  ) : (
                    <div class="flex h-30 w-20 items-center justify-center border-2 border-current text-center font-[var(--font-mono)] text-[0.65rem] uppercase tracking-[0.2em]">
                      No image
                    </div>
                  )}
                </div>

                <div class="space-y-4">
                  <div class="space-y-2">
                    <h4 class="text-3xl leading-none">{game.name}</h4>
                    <p class="timeline-detail group-hover:text-white/80">
                      {game.platforms.length > 0
                        ? game.platforms.join(", ")
                        : "Platforms unavailable"}
                    </p>
                    <p class="timeline-detail group-hover:text-white/80">
                      {game.hltb_status === "resolved"
                        ? `Resolved from ${game.hltb_match_name ?? game.name}`
                        : "HLTB duration not found yet"}
                    </p>
                  </div>

                  <div class="flex flex-wrap gap-2">
                    <span class="chip">
                      {game.main_story_hours === null
                        ? "No HLTB time yet"
                        : `${game.main_story_hours}h main story`}
                    </span>
                    {game.release_year !== null && (
                      <span class="chip">{game.release_year}</span>
                    )}
                  </div>
                </div>

                <div class="self-start">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onRemoveGame(index)}
                    class="group-hover:border-white group-hover:bg-black group-hover:text-white"
                  >
                    Remove
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
