import {
  CalendarBlankIcon,
  ClockIcon,
  GameControllerIcon,
  TagIcon,
} from "@phosphor-icons/react";
import { useState } from "preact/hooks";
import { type ListGame, getSelectedGameHours } from "../types";
import { PlatformIcons } from "./platform-icons";

interface Props {
  game: ListGame;
  plannedHours?: number;
  startTime?: string;
  variant?: "backlog" | "calendar";
}

function previewCoverUrl(coverUrl: string): string {
  return coverUrl.replace("/t_thumb/", "/t_cover_small/");
}

function getArtworkUrls(game: ListGame): string[] {
  return [
    ...new Set(
      [
        game.hero_url,
        game.cover_url ? previewCoverUrl(game.cover_url) : null,
        game.logo_url,
      ].filter((url): url is string => Boolean(url)),
    ),
  ];
}

export function GameCartridge({
  game,
  plannedHours,
  startTime,
  variant = "backlog",
}: Props) {
  const primaryHours = plannedHours ?? getSelectedGameHours(game);
  const primaryLabel =
    plannedHours === undefined ? "PLAY TIME" : "TIME TO PLAY";
  const artworkUrls = getArtworkUrls(game);
  const [settledArtwork, setSettledArtwork] = useState<string[]>([]);
  const isReady =
    game.hltb_status !== "loading" &&
    artworkUrls.every((url) => settledArtwork.includes(url));

  const markArtworkSettled = (url: string) => {
    setSettledArtwork((current) =>
      current.includes(url) ? current : [...current, url],
    );
  };

  return (
    <div
      class={`game-cartridge game-cartridge--${variant}${
        isReady ? "" : " game-cartridge--loading"
      }`}
      aria-busy={!isReady}
    >
      {!isReady && (
        <output
          class="game-cartridge__loading"
          aria-label={`Loading ${game.name} artwork`}
        >
          <div class="game-cartridge__loading-cover" />
          <div class="game-cartridge__loading-content">
            <span class="game-cartridge__loading-logo" />
            <span class="game-cartridge__loading-line" />
            <span class="game-cartridge__loading-label" />
          </div>
        </output>
      )}

      {game.hero_url && (
        <img
          aria-hidden="true"
          class="game-cartridge__hero"
          src={game.hero_url}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={() => markArtworkSettled(game.hero_url)}
          onError={() => markArtworkSettled(game.hero_url)}
        />
      )}
      <div class="game-cartridge__wash" aria-hidden="true" />

      <div class="game-cartridge__cover-frame" aria-hidden={!isReady}>
        {game.cover_url ? (
          <img
            class="game-cartridge__cover"
            src={previewCoverUrl(game.cover_url)}
            alt={`${game.name} cover`}
            loading="lazy"
            decoding="async"
            onLoad={() => markArtworkSettled(previewCoverUrl(game.cover_url))}
            onError={() => markArtworkSettled(previewCoverUrl(game.cover_url))}
          />
        ) : (
          <div class="game-cartridge__cover game-cartridge__cover--empty">
            NO ART
          </div>
        )}
      </div>

      <div class="game-cartridge__content" aria-hidden={!isReady}>
        <div class="game-cartridge__identity">
          {game.logo_url ? (
            <img
              class="game-cartridge__logo"
              src={game.logo_url}
              alt={`${game.name} logo`}
              loading="lazy"
              decoding="async"
              onLoad={() => markArtworkSettled(game.logo_url)}
              onError={() => markArtworkSettled(game.logo_url)}
            />
          ) : null}
          <h3 class="game-cartridge__title planner-backlog-row__title">
            {game.name}
          </h3>
          <PlatformIcons
            class="game-cartridge__platforms"
            platforms={game.platforms}
            maxIcons={2}
            showFallback={false}
          />
        </div>

        <dl class="game-cartridge__label" aria-label={`${game.name} details`}>
          <div>
            <dt>
              <ClockIcon aria-hidden="true" />
              {variant !== "calendar" && <span>{primaryLabel}</span>}
            </dt>
            <dd>{primaryHours.toFixed(1)}H</dd>
          </div>
          {startTime && (
            <div>
              <dt>
                <ClockIcon aria-hidden="true" />
                <span>START</span>
              </dt>
              <dd>{startTime.slice(0, 5)}</dd>
            </div>
          )}
          <div>
            <dt>
              <CalendarBlankIcon aria-hidden="true" />
              <span>YEAR</span>
            </dt>
            <dd>{game.release_year ?? "—"}</dd>
          </div>
          <div>
            <dt>
              <GameControllerIcon aria-hidden="true" />
              <span>MODE</span>
            </dt>
            <dd>{game.selected_hltb_category ?? "main"}</dd>
          </div>
          <div>
            <dt>
              <TagIcon aria-hidden="true" />
              <span>GENRE</span>
            </dt>
            <dd>{game.genres[0] ?? "—"}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
