import { type ListGame, getSelectedGameHours } from "../types";

interface Props {
  game: ListGame;
  plannedHours?: number;
  startTime?: string;
  variant?: "backlog" | "calendar";
}

function previewCoverUrl(coverUrl: string): string {
  return coverUrl.replace("/t_thumb/", "/t_cover_small/");
}

export function GameCartridge({
  game,
  plannedHours,
  startTime,
  variant = "backlog",
}: Props) {
  const primaryHours = plannedHours ?? getSelectedGameHours(game);
  const primaryLabel = plannedHours === undefined ? "PLAY TIME" : "TODAY";

  return (
    <div class={`game-cartridge game-cartridge--${variant}`}>
      {game.hero_url && (
        <img
          aria-hidden="true"
          class="game-cartridge__hero"
          src={game.hero_url}
          alt=""
          loading="lazy"
          decoding="async"
        />
      )}
      <div class="game-cartridge__wash" aria-hidden="true" />

      <div class="game-cartridge__cover-frame">
        {game.cover_url ? (
          <img
            class="game-cartridge__cover"
            src={previewCoverUrl(game.cover_url)}
            alt={`${game.name} cover`}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <div class="game-cartridge__cover game-cartridge__cover--empty">
            NO ART
          </div>
        )}
      </div>

      <div class="game-cartridge__content">
        <div class="game-cartridge__identity">
          {game.logo_url ? (
            <img
              class="game-cartridge__logo"
              src={game.logo_url}
              alt={`${game.name} logo`}
              loading="lazy"
              decoding="async"
            />
          ) : (
            <h3 class="game-cartridge__title planner-backlog-row__title">
              {game.name}
            </h3>
          )}
        </div>

        <dl class="game-cartridge__label" aria-label={`${game.name} details`}>
          <div>
            <dt>{primaryLabel}</dt>
            <dd>{primaryHours.toFixed(1)}H</dd>
          </div>
          {startTime && (
            <div>
              <dt>START</dt>
              <dd>{startTime.slice(0, 5)}</dd>
            </div>
          )}
          <div>
            <dt>YEAR</dt>
            <dd>{game.release_year ?? "—"}</dd>
          </div>
          <div>
            <dt>MODE</dt>
            <dd>{game.selected_hltb_category ?? "main"}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
