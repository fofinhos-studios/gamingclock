import {
  CheckIcon,
  CircleNotchIcon,
  MagnifyingGlassIcon,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "preact/hooks";

import { useTransientFeedback } from "../hooks/use-transient-feedback";
import { useLanguage } from "../i18n/i18n";
import { getGameArtwork, searchGames } from "../services/api";
import type { CatalogGame, GameArtwork, ListGame } from "../types";
import { Button, Field, Input } from "./ui";

interface Props {
  games: ListGame[];
  onAddGame: (game: CatalogGame) => void;
}

function previewCoverUrl(coverUrl: string) {
  return coverUrl.replace("/t_thumb/", "/t_cover_small/");
}

export function GameSearch({ games, onAddGame }: Props) {
  const { t } = useLanguage();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const resultRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogGame[]>([]);
  const [artworkById, setArtworkById] = useState<Record<number, GameArtwork>>(
    {},
  );
  const [pendingArtworkIds, setPendingArtworkIds] = useState<Set<number>>(
    new Set(),
  );
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<number | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");
  const addFeedback = useTransientFeedback<number>(1700);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsDropdownOpen(false);
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      setResults([]);
      setArtworkById({});
      setPendingArtworkIds(new Set());
      setLoading(false);
      setError("");
      setInfoMessage("");
      setHighlightedIndex(-1);
      return undefined;
    }

    const timeoutId = window.setTimeout(async () => {
      setLoading(true);
      setIsDropdownOpen(true);
      setError("");
      setInfoMessage("");
      try {
        const nextResults = await searchGames(trimmedQuery);
        const visibleResults = nextResults.slice(0, 8);
        setResults(visibleResults);
        setArtworkById({});
        setPendingArtworkIds(
          new Set(visibleResults.map((game) => game.igdb_id)),
        );
        setIsDropdownOpen(true);
        setHighlightedIndex(nextResults.length > 0 ? 0 : -1);
      } catch (searchError) {
        setResults([]);
        setError(
          searchError instanceof Error ? searchError.message : t.search.failed,
        );
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [query, t.search.failed]);

  useEffect(() => {
    let isCurrent = true;

    for (const game of results) {
      void getGameArtwork(game)
        .then((artwork) => {
          if (isCurrent) {
            setArtworkById((current) => ({
              ...current,
              [game.igdb_id]: artwork,
            }));
          }
        })
        .catch(() => undefined)
        .finally(() => {
          if (isCurrent) {
            setPendingArtworkIds((current) => {
              const next = new Set(current);
              next.delete(game.igdb_id);
              return next;
            });
          }
        });
    }

    return () => {
      isCurrent = false;
    };
  }, [results]);

  useEffect(() => {
    if (highlightedIndex < 0) {
      return;
    }

    resultRefs.current[highlightedIndex]?.scrollIntoView({
      block: "nearest",
    });
  }, [highlightedIndex]);

  const handleAddGame = (game: CatalogGame) => {
    if (games.some((backlogGame) => backlogGame.igdb_id === game.igdb_id)) {
      setInfoMessage(t.search.alreadyAdded(game.name));
      setError("");
      return;
    }

    setAddingId(game.igdb_id);
    setError("");
    setInfoMessage("");

    onAddGame(game);
    addFeedback.trigger(game.igdb_id, 1700);
    setAddingId(null);
  };

  const handleSearchKeyDown = (event: KeyboardEvent) => {
    if (!isDropdownOpen || loading || results.length === 0) {
      if (event.key === "Escape") {
        setIsDropdownOpen(false);
        setHighlightedIndex(-1);
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((current) =>
        current < results.length - 1 ? current + 1 : 0,
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((current) =>
        current > 0 ? current - 1 : results.length - 1,
      );
      return;
    }

    if (event.key === "Enter" && highlightedIndex >= 0) {
      event.preventDefault();
      if (addingId === null) {
        handleAddGame(results[highlightedIndex]);
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      setIsDropdownOpen(false);
      setHighlightedIndex(-1);
    }
  };

  return (
    <section aria-labelledby="search-games-heading" class="planner-search-dock">
      <h2 id="search-games-heading" class="sr-only">
        {t.search.title}
      </h2>

      <div ref={containerRef} class="planner-search-dock__content">
        <div class="planner-search-dock__shell">
          <MagnifyingGlassIcon
            class="planner-icon planner-search-dock__icon"
            aria-hidden="true"
          />
          <Field
            label={t.search.label}
            controlId="game-search-input"
            class="planner-search-dock__field"
          >
            <Input
              id="game-search-input"
              type="text"
              class="planner-search-dock__input"
              value={query}
              onFocus={() => {
                if (query.trim().length >= 2) {
                  setIsDropdownOpen(true);
                  setHighlightedIndex(results.length > 0 ? 0 : -1);
                }
              }}
              onKeyDown={(event) => handleSearchKeyDown(event as KeyboardEvent)}
              onInput={(event) =>
                setQuery((event.target as HTMLInputElement).value)
              }
              placeholder={t.search.placeholder}
              autoComplete="off"
            />
          </Field>
        </div>

        {error && !isDropdownOpen && (
          <p role="alert" class="planner-error">
            {error}
          </p>
        )}

        {infoMessage && (
          <p class="planner-inline-feedback" aria-live="polite">
            {infoMessage}
          </p>
        )}

        {isDropdownOpen &&
          (loading ||
            error ||
            (!loading && query.trim().length >= 2 && results.length > 0) ||
            (!loading && query.trim().length >= 2 && results.length === 0)) && (
            <div class="planner-search-results">
              {loading && (
                <p class="planner-search-results__message planner-search-results__message--loading">
                  <CircleNotchIcon
                    class="planner-icon planner-icon--spin"
                    aria-hidden="true"
                  />
                  <span>{t.search.finding}</span>
                </p>
              )}
              {error && (
                <p role="alert" class="planner-search-results__message">
                  {error}
                </p>
              )}
              {!loading && !error && results.length === 0 && (
                <p class="planner-search-results__message">
                  {t.search.noMatches}
                </p>
              )}
              {!loading &&
                !error &&
                results.map((game, index) => {
                  const isHighlighted = index === highlightedIndex;
                  const artwork = artworkById[game.igdb_id];

                  return (
                    <SearchResultCartridge
                      key={`${game.igdb_id}:${artwork?.hero_url ?? ""}:${artwork?.logo_url ?? ""}`}
                      buttonRef={(element) => {
                        resultRefs.current[index] = element;
                      }}
                      game={game}
                      artwork={artwork}
                      isArtworkLoading={pendingArtworkIds.has(game.igdb_id)}
                      isHighlighted={isHighlighted}
                      isAdding={addingId === game.igdb_id}
                      isAdded={addFeedback.active === game.igdb_id}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      onFocus={() => setHighlightedIndex(index)}
                      onClick={() => handleAddGame(game)}
                    />
                  );
                })}
            </div>
          )}
      </div>
    </section>
  );
}

interface SearchResultCartridgeProps {
  game: CatalogGame;
  artwork: GameArtwork | undefined;
  isArtworkLoading: boolean;
  isHighlighted: boolean;
  isAdding: boolean;
  isAdded: boolean;
  buttonRef: (element: HTMLButtonElement | null) => void;
  onMouseEnter: () => void;
  onFocus: () => void;
  onClick: () => void;
}

function SearchResultCartridge({
  game,
  artwork,
  isArtworkLoading,
  isHighlighted,
  isAdding,
  isAdded,
  buttonRef,
  onMouseEnter,
  onFocus,
  onClick,
}: SearchResultCartridgeProps) {
  const { t } = useLanguage();
  const artworkUrls = [artwork?.hero_url, artwork?.logo_url].filter(
    (url): url is string => Boolean(url),
  );
  const [settledArtwork, setSettledArtwork] = useState<string[]>([]);
  const isArtworkReady =
    !isArtworkLoading &&
    artworkUrls.every((url) => settledArtwork.includes(url));
  const coverUrl = game.cover_url || artwork?.cover_url || "";

  const markArtworkSettled = (url: string) => {
    setSettledArtwork((current) =>
      current.includes(url) ? current : [...current, url],
    );
  };

  return (
    <Button
      unstyled
      ref={buttonRef}
      class={`planner-result${
        isHighlighted ? " planner-result--active" : ""
      }${!isArtworkReady ? " planner-result--artwork-loading" : ""}${
        isAdding ? " planner-result--loading" : ""
      }${isAdded ? " planner-result--success" : ""}`}
      onMouseEnter={onMouseEnter}
      onFocus={onFocus}
      onClick={onClick}
      disabled={isAdding}
      aria-label={t.search.addGame(game.name)}
      aria-busy={isArtworkLoading || !isArtworkReady}
    >
      {artwork?.hero_url && (
        <img
          aria-hidden="true"
          class="planner-result__hero"
          src={artwork.hero_url}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={() => markArtworkSettled(artwork.hero_url)}
          onError={() => markArtworkSettled(artwork.hero_url)}
        />
      )}
      <div class="planner-result__wash" aria-hidden="true" />

      <div class="planner-result__cover-frame">
        {coverUrl ? (
          <img
            src={previewCoverUrl(coverUrl)}
            alt={game.name}
            loading="lazy"
            decoding="async"
            width={56}
            height={80}
            class="planner-result__cover"
          />
        ) : (
          <div class="planner-result__cover planner-result__cover--empty">
            {t.list.noImage}
          </div>
        )}
      </div>

      <div class="planner-result__body">
        <div class="planner-result__row">
          <div class="planner-result__identity">
            {artwork?.logo_url && (
              <img
                class={`planner-result__logo${
                  isArtworkReady ? "" : " planner-result__logo--loading"
                }`}
                src={artwork.logo_url}
                alt={`${game.name} logo`}
                aria-hidden={!isArtworkReady}
                loading="lazy"
                decoding="async"
                onLoad={() => markArtworkSettled(artwork.logo_url)}
                onError={() => markArtworkSettled(artwork.logo_url)}
              />
            )}
            {(!isArtworkReady || !artwork?.logo_url) && (
              <h3 class="planner-result__title">{game.name}</h3>
            )}
          </div>
          <div class="planner-result__meta-group">
            <p class="planner-result__meta">
              {game.release_year === null
                ? t.search.unknownYear
                : game.release_year}
              {game.rating === null ? "" : ` / ${game.rating.toFixed(1)}`}
            </p>
          </div>
        </div>

        {isArtworkReady ? (
          <div class="planner-result__details">
            <p class="planner-result__detail">
              {game.platforms.length > 0
                ? game.platforms.join(", ")
                : t.search.platformsUnavailable}
            </p>
            <p class="planner-result__detail">
              {game.genres.length > 0
                ? game.genres.join(", ")
                : t.search.genresUnavailable}
            </p>
            {game.summary && (
              <p class="planner-result__summary">{game.summary}</p>
            )}
          </div>
        ) : (
          <div class="planner-result__artwork-loading" aria-hidden="true">
            <span class="planner-result__loading-line" />
            <span class="planner-result__loading-line" />
            <span class="planner-result__loading-line planner-result__loading-line--short" />
          </div>
        )}

        {(isAdding || isAdded) && (
          <p class="planner-result__feedback">
            {isAdding ? (
              <CircleNotchIcon
                class="planner-icon planner-icon--spin"
                aria-hidden="true"
              />
            ) : (
              <CheckIcon class="planner-icon" aria-hidden="true" />
            )}
            <span>{isAdding ? t.search.adding : t.search.added}</span>
          </p>
        )}
      </div>
    </Button>
  );
}
