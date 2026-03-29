import { useEffect, useRef, useState } from "preact/hooks";

import { resolveGame, searchGames } from "../services/api";
import type { CatalogGame, ListGame } from "../types";
import { Button, Field, Input } from "./ui";

interface Props {
  onAddGame: (game: ListGame) => void;
}

export function GameSearch({ onAddGame }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const resultRefs = useRef<Array<HTMLDivElement | null>>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<number | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [error, setError] = useState("");

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
      setHighlightedIndex(-1);
      return undefined;
    }

    const timeoutId = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const games = await searchGames(trimmedQuery);
        setResults(games.slice(0, 8));
        setIsDropdownOpen(true);
        setHighlightedIndex(games.length > 0 ? 0 : -1);
      } catch (searchError) {
        setResults([]);
        setError(
          searchError instanceof Error ? searchError.message : "Search failed",
        );
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [query]);

  useEffect(() => {
    if (highlightedIndex < 0) {
      return;
    }

    resultRefs.current[highlightedIndex]?.scrollIntoView({
      block: "nearest",
    });
  }, [highlightedIndex]);

  const handleAddGame = async (game: CatalogGame) => {
    setAddingId(game.igdb_id);
    setError("");

    try {
      const resolvedGame = await resolveGame(game);
      onAddGame(resolvedGame);
      setQuery("");
      setResults([]);
      setIsDropdownOpen(false);
      setHighlightedIndex(-1);
    } catch (resolveError) {
      setError(
        resolveError instanceof Error
          ? resolveError.message
          : "Game resolution failed",
      );
    } finally {
      setAddingId(null);
    }
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
        void handleAddGame(results[highlightedIndex]);
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
          <p class="section-eyebrow">Search</p>
          <h2 id="search-games-heading" class="planner-panel__title">
            Find games
          </h2>
        </div>
        <p class="planner-panel__copy">
          Type at least 2 characters. Arrow keys move through the live results.
        </p>
      </div>

      <div ref={containerRef} class="space-y-3">
        <Field label="Search by title" controlId="game-search-input">
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
            placeholder="Search for a game"
            autoComplete="off"
          />
        </Field>

        {error && !isDropdownOpen && (
          <p role="alert" class="planner-error">
            {error}
          </p>
        )}

        {isDropdownOpen &&
          (loading ||
            error ||
            (!loading && query.trim().length >= 2 && results.length > 0) ||
            (!loading && query.trim().length >= 2 && results.length === 0)) && (
            <div class="planner-search-results">
              {loading && (
                <p class="planner-search-results__message">Searching...</p>
              )}
              {error && (
                <p role="alert" class="planner-search-results__message">
                  {error}
                </p>
              )}
              {!loading && !error && results.length === 0 && (
                <p class="planner-search-results__message">No matches found.</p>
              )}
              {!loading &&
                !error &&
                results.map((game, index) => {
                  const isHighlighted = index === highlightedIndex;

                  return (
                    <article
                      key={game.igdb_id}
                      ref={(element) => {
                        resultRefs.current[index] = element;
                      }}
                      class={`planner-result ${
                        isHighlighted ? "planner-result--active" : ""
                      }`}
                      onMouseEnter={() => setHighlightedIndex(index)}
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
                          No image
                        </div>
                      )}

                      <div class="planner-result__body">
                        <div class="planner-result__row">
                          <h3 class="planner-result__title">{game.name}</h3>
                          <p class="planner-result__meta">
                            {game.release_year === null
                              ? "Unknown year"
                              : game.release_year}
                            {game.rating === null
                              ? ""
                              : ` / ${game.rating.toFixed(1)}`}
                          </p>
                        </div>

                        <p class="planner-result__detail">
                          {game.platforms.length > 0
                            ? game.platforms.join(", ")
                            : "Platforms unavailable"}
                        </p>

                        <p class="planner-result__detail">
                          {game.genres.length > 0
                            ? game.genres.join(", ")
                            : "Genres unavailable"}
                        </p>

                        {game.summary && (
                          <p class="planner-result__summary">{game.summary}</p>
                        )}
                      </div>

                      <div class="planner-result__actions">
                        <Button
                          type="button"
                          variant={isHighlighted ? "primary" : "outline"}
                          size="sm"
                          onClick={() => void handleAddGame(game)}
                          onFocus={() => setHighlightedIndex(index)}
                          disabled={addingId === game.igdb_id}
                          aria-label={`Add ${game.name} to backlog`}
                          class={
                            isHighlighted
                              ? "border-black bg-black text-white hover:bg-neutral-900"
                              : ""
                          }
                        >
                          {addingId === game.igdb_id ? "Resolving" : "Add"}
                        </Button>
                      </div>
                    </article>
                  );
                })}
            </div>
          )}
      </div>
    </section>
  );
}
