import { Check, LoaderCircle, Search, X } from "lucide-preact";
import { useEffect, useRef, useState } from "preact/hooks";

import { useTransientFeedback } from "../hooks/use-transient-feedback";
import { useLanguage } from "../i18n/i18n";
import { getApiErrorMessage, searchGames } from "../services/api";
import type { CatalogGame, ListGame } from "../types";
import { Button, Field, Input } from "./ui";

interface Props {
  games: ListGame[];
  onAddGame: (game: CatalogGame) => void;
}

export function GameSearch({ games, onAddGame }: Props) {
  const { t } = useLanguage();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const resultRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogGame[]>([]);
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
        setResults(nextResults.slice(0, 8));
        setIsDropdownOpen(true);
        setHighlightedIndex(nextResults.length > 0 ? 0 : -1);
      } catch (searchError) {
        setResults([]);
        setError(getApiErrorMessage(searchError, t.search.failed));
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [query, t.search.failed]);

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

  const previewCoverUrl = (coverUrl: string) =>
    coverUrl.replace("/t_thumb/", "/t_cover_small/");

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
    <section aria-labelledby="search-games-heading" class="space-y-4">
      <div class="planner-pane__header">
        <div class="space-y-1">
          <h2
            id="search-games-heading"
            class="planner-panel__title planner-heading"
          >
            <Search
              class="planner-icon planner-heading__icon"
              aria-hidden="true"
            />
            <span>{t.search.title}</span>
          </h2>
        </div>
      </div>

      <div ref={containerRef} class="space-y-3">
        <Field label={t.search.label} controlId="game-search-input">
          <Input
            id="game-search-input"
            type="text"
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

        {query && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            class="planner-search-clear"
            onClick={() => {
              setQuery("");
              setIsDropdownOpen(false);
              setHighlightedIndex(-1);
            }}
          >
            <X class="planner-icon" aria-hidden="true" />
            {t.search.clear}
          </Button>
        )}

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
                <p
                  class="planner-search-results__message planner-search-results__message--loading"
                  aria-live="polite"
                >
                  <LoaderCircle
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

                  return (
                    <button
                      key={game.igdb_id}
                      ref={(element) => {
                        resultRefs.current[index] = element;
                      }}
                      type="button"
                      class={`planner-result ${
                        isHighlighted ? "planner-result--active" : ""
                      } ${
                        addingId === game.igdb_id
                          ? "planner-result--loading"
                          : ""
                      } ${
                        addFeedback.active === game.igdb_id
                          ? "planner-result--success"
                          : ""
                      }`}
                      onMouseEnter={() => setHighlightedIndex(index)}
                      onFocus={() => setHighlightedIndex(index)}
                      onClick={() => handleAddGame(game)}
                      disabled={addingId === game.igdb_id}
                      aria-label={t.search.addGame(game.name)}
                    >
                      {game.cover_url ? (
                        <img
                          src={previewCoverUrl(game.cover_url)}
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

                      <div class="planner-result__body">
                        <div class="planner-result__row">
                          <h3 class="planner-result__title">{game.name}</h3>
                          <div class="planner-result__meta-group">
                            <p class="planner-result__meta">
                              {game.release_year === null
                                ? t.search.unknownYear
                                : game.release_year}
                              {game.rating === null
                                ? ""
                                : ` / ${game.rating.toFixed(1)}`}
                            </p>
                          </div>
                        </div>

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

                        {(addingId === game.igdb_id ||
                          addFeedback.active === game.igdb_id) && (
                          <p
                            class="planner-result__feedback"
                            aria-live="polite"
                          >
                            {addingId === game.igdb_id ? (
                              <LoaderCircle
                                class="planner-icon planner-icon--spin"
                                aria-hidden="true"
                              />
                            ) : (
                              <Check class="planner-icon" aria-hidden="true" />
                            )}
                            <span>
                              {addingId === game.igdb_id
                                ? t.search.adding
                                : t.search.added}
                            </span>
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })}
            </div>
          )}

        <p class="planner-search-attribution">{t.search.attribution}</p>
      </div>
    </section>
  );
}
