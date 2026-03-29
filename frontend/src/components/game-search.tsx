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
        setHighlightedIndex(0);
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
    <section aria-labelledby="search-games-heading" class="space-y-6">
      <div class="space-y-3">
        <p class="section-eyebrow">Search</p>
        <h3 id="search-games-heading" class="text-4xl md:text-5xl">
          Search Games
        </h3>
        <p class="section-copy max-w-none">
          Start typing to search IGDB, then add a game straight into your
          backlog.
        </p>
      </div>

      <div class="space-y-4" ref={containerRef}>
        <Field
          label="Search by title"
          controlId="game-search-input"
          hint="Type at least 2 characters. Arrow keys move through the result list."
        >
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
            placeholder="Search for a game..."
          />
        </Field>

        {isDropdownOpen &&
          (loading ||
            error ||
            (!loading && query.trim().length >= 2 && results.length > 0) ||
            (!loading && query.trim().length >= 2 && results.length === 0)) && (
            <div class="max-h-[34rem] overflow-y-auto border border-black bg-white">
              {loading && <p class="p-5">Searching...</p>}
              {error && <p class="p-5">{error}</p>}
              {!loading && !error && results.length === 0 && (
                <p class="p-5">No matches found.</p>
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
                      class={`group border-b border-black p-5 last:border-b-0 ${
                        isHighlighted
                          ? "bg-black text-white"
                          : "bg-white text-black"
                      }`}
                    >
                      <div class="grid gap-4 md:grid-cols-[5rem_minmax(0,1fr)]">
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

                        <div class="grid gap-5 lg:grid-cols-[minmax(0,1fr)_14rem]">
                          <div class="space-y-3">
                            <div class="space-y-2">
                              <h4 class="text-3xl leading-none">{game.name}</h4>
                              <p class="timeline-meta">
                                {game.release_year === null
                                  ? "Unknown year"
                                  : game.release_year}
                                {game.rating === null
                                  ? ""
                                  : ` / rating ${game.rating.toFixed(1)}`}
                              </p>
                            </div>
                            <p class="timeline-detail">
                              {game.platforms.length > 0
                                ? game.platforms.join(", ")
                                : "Platforms unavailable"}
                            </p>
                            <p class="timeline-detail">
                              {game.genres.length > 0
                                ? game.genres.join(", ")
                                : "Genres unavailable"}
                            </p>
                            {game.summary && (
                              <p
                                class={
                                  isHighlighted
                                    ? "text-white/80"
                                    : "text-[var(--muted-foreground)]"
                                }
                              >
                                {game.summary}
                              </p>
                            )}
                          </div>

                          <div class="space-y-3">
                            <Button
                              type="button"
                              variant={isHighlighted ? "primary" : "outline"}
                              size="sm"
                              block
                              onClick={() => void handleAddGame(game)}
                              onFocus={() => setHighlightedIndex(index)}
                              disabled={addingId === game.igdb_id}
                              aria-label={`Add ${game.name} to backlog`}
                              class={
                                isHighlighted
                                  ? "border-white bg-white text-black hover:border-white hover:bg-black hover:text-white"
                                  : undefined
                              }
                            >
                              {addingId === game.igdb_id
                                ? "Resolving"
                                : "Add to backlog"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
            </div>
          )}

        <p class="timeline-meta text-[var(--muted-foreground)]">
          Results stay in the dropdown until you add a game or change the
          search.
        </p>
      </div>
    </section>
  );
}
