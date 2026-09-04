import {
  CaretDownIcon,
  CaretUpIcon,
  CheckIcon,
  CircleNotchIcon,
  MagnifyingGlassIcon,
} from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "preact/hooks";

import { GAME_GROUPS_ENABLED } from "../config/features";
import { useTransientFeedback } from "../hooks/use-transient-feedback";
import { useLanguage } from "../i18n/i18n";
import {
  getGameArtwork,
  previewGameGroup,
  resolveGameGroupSelection,
  searchGameGroups,
  searchGames,
} from "../services/api";
import type {
  CatalogGame,
  CatalogGameVariant,
  GameArtwork,
  GameGroupPreview,
  GameGroupSearchResult,
  GameGroupSelectionResolution,
  ListGame,
} from "../types";
import { PlatformIcons } from "./platform-icons";
import { Button, Field, Input } from "./ui";
import "./game-groups.css";

interface Props {
  games: ListGame[];
  onAddGame: (game: CatalogGame) => void;
  onAddGameGroup?: (
    preview: GameGroupPreview,
    resolutions: GameGroupSelectionResolution[],
  ) => Promise<void>;
}

const searchExamples = [
  "Hollow Knight",
  "Mario Kart 8 Deluxe",
  "Hades",
  "Stardew Valley",
  "Elden Ring",
  "The Legend of Zelda: Tears of the Kingdom",
  "Baldur's Gate 3",
  "Celeste",
  "Animal Crossing: New Horizons",
  "Apex Legends",
  "Bloodborne",
  "Chrono Trigger",
  "Control",
  "Cyberpunk 2077",
  "Dark Souls III",
  "Dead Cells",
  "Disco Elysium",
  "DOOM Eternal",
  "Dragon Quest XI",
  "Final Fantasy VII Rebirth",
  "Fire Emblem: Three Houses",
  "Forza Horizon 5",
  "Ghost of Tsushima",
  "God of War Ragnarök",
  "Gran Turismo 7",
  "Hi-Fi Rush",
  "It Takes Two",
  "Kingdom Hearts II",
  "Kirby and the Forgotten Land",
  "Like a Dragon: Infinite Wealth",
  "Mass Effect Legendary Edition",
  "Metaphor: ReFantazio",
  "Minecraft",
  "Monster Hunter Wilds",
  "NieR: Automata",
  "Octopath Traveler II",
  "Ori and the Will of the Wisps",
  "Outer Wilds",
  "Overwatch 2",
  "Persona 5 Royal",
  "Pokémon Legends: Arceus",
  "Prince of Persia: The Lost Crown",
  "Ratchet & Clank: Rift Apart",
  "Red Dead Redemption 2",
  "Resident Evil 4",
  "Sea of Stars",
  "Sekiro: Shadows Die Twice",
  "Slay the Spire",
  "Sonic Frontiers",
  "Spider-Man 2",
  "Splatoon 3",
  "Street Fighter 6",
  "Super Mario Bros. Wonder",
  "Super Mario Odyssey",
  "Super Smash Bros. Ultimate",
  "Tetris Effect: Connected",
  "The Last of Us Part II",
  "The Sims 4",
  "The Witcher 3: Wild Hunt",
  "Undertale",
  "Uncharted 4: A Thief's End",
  "Vampire Survivors",
] as const;

function getSearchExamples(): [string, string] {
  const firstIndex = Math.floor(Math.random() * searchExamples.length);
  const secondIndex =
    (firstIndex + 1 + Math.floor(Math.random() * (searchExamples.length - 1))) %
    searchExamples.length;

  return [searchExamples[firstIndex], searchExamples[secondIndex]];
}

function previewCoverUrl(coverUrl: string) {
  return coverUrl.replace("/t_thumb/", "/t_cover_small/");
}

export function GameSearch({
  games,
  onAddGame,
  onAddGameGroup = async () => undefined,
}: Props) {
  const { t } = useLanguage();
  const [searchExamples] = useState(getSearchExamples);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const resultRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const searchRequestId = useRef(0);
  const groupSearchRequestId = useRef(0);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CatalogGame[]>([]);
  const [groupResults, setGroupResults] = useState<GameGroupSearchResult[]>([]);
  const [expandedGroupKey, setExpandedGroupKey] = useState<string | null>(null);
  const [groupError, setGroupError] = useState("");
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
  const visibleGroupResults = GAME_GROUPS_ENABLED ? groupResults : [];

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
    const requestId = ++searchRequestId.current;
    const controller = new AbortController();
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
        const nextResults = await searchGames(trimmedQuery, controller.signal);
        if (requestId !== searchRequestId.current) {
          return;
        }
        const visibleResults = nextResults.slice(0, 8);
        setResults(visibleResults);
        setArtworkById({});
        setPendingArtworkIds(
          new Set(visibleResults.map((game) => game.igdb_id)),
        );
        setIsDropdownOpen(true);
        setHighlightedIndex((current) =>
          current >= 0 || nextResults.length === 0 ? current : 0,
        );
      } catch (searchError) {
        if (
          controller.signal.aborted ||
          requestId !== searchRequestId.current
        ) {
          return;
        }
        setResults([]);
        setError(
          searchError instanceof Error ? searchError.message : t.search.failed,
        );
      } finally {
        if (requestId === searchRequestId.current) {
          setLoading(false);
        }
      }
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [query, t.search.failed]);

  useEffect(() => {
    if (!GAME_GROUPS_ENABLED) {
      setGroupResults([]);
      setExpandedGroupKey(null);
      setGroupError("");
      return undefined;
    }
    const trimmedQuery = query.trim();
    const requestId = ++groupSearchRequestId.current;
    const controller = new AbortController();
    if (trimmedQuery.length < 2) {
      setGroupResults([]);
      setExpandedGroupKey(null);
      setGroupError("");
      return undefined;
    }
    const timeoutId = window.setTimeout(() => {
      setGroupError("");
      void searchGameGroups(trimmedQuery, controller.signal)
        .then((nextGroups) => {
          if (requestId === groupSearchRequestId.current) {
            setGroupResults(nextGroups);
          }
        })
        .catch(() => {
          if (
            !controller.signal.aborted &&
            requestId === groupSearchRequestId.current
          ) {
            setGroupError(t.search.groupsUnavailable);
          }
        });
    }, 700);
    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [query, t.search.groupsUnavailable]);

  useEffect(() => {
    let isCurrent = true;
    const controller = new AbortController();

    for (const game of results) {
      void getGameArtwork(game, controller.signal)
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
      controller.abort();
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
    if (
      !isDropdownOpen ||
      loading ||
      (results.length === 0 && visibleGroupResults.length === 0)
    ) {
      if (event.key === "Escape") {
        setIsDropdownOpen(false);
        setHighlightedIndex(-1);
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      const rowCount = visibleGroupResults.length + results.length;
      setHighlightedIndex((current) =>
        current < rowCount - 1 ? current + 1 : 0,
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      const rowCount = visibleGroupResults.length + results.length;
      setHighlightedIndex((current) =>
        current > 0 ? current - 1 : rowCount - 1,
      );
      return;
    }

    if (event.key === "Enter" && highlightedIndex >= 0) {
      event.preventDefault();
      if (highlightedIndex < visibleGroupResults.length) {
        setExpandedGroupKey((current) =>
          current === visibleGroupResults[highlightedIndex].group_key
            ? null
            : visibleGroupResults[highlightedIndex].group_key,
        );
      } else if (addingId === null) {
        handleAddGame(results[highlightedIndex - visibleGroupResults.length]);
      }
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      if (expandedGroupKey) {
        setExpandedGroupKey(null);
      } else {
        setIsDropdownOpen(false);
        setHighlightedIndex(-1);
      }
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
              placeholder={t.search.placeholder(...searchExamples)}
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
            (!loading &&
              query.trim().length >= 2 &&
              (results.length > 0 || visibleGroupResults.length > 0)) ||
            (!loading &&
              query.trim().length >= 2 &&
              results.length === 0 &&
              visibleGroupResults.length === 0)) && (
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
              {GAME_GROUPS_ENABLED && groupError && !error && (
                <p class="planner-search-results__message">{groupError}</p>
              )}
              {!loading &&
                !error &&
                results.length === 0 &&
                visibleGroupResults.length === 0 && (
                  <p class="planner-search-results__message">
                    {t.search.noMatches}
                  </p>
                )}
              {!loading &&
                !error &&
                visibleGroupResults.map((group, index) => (
                  <GameGroupCard
                    key={group.group_key}
                    group={group}
                    games={games}
                    expanded={expandedGroupKey === group.group_key}
                    isHighlighted={index === highlightedIndex}
                    onToggle={() =>
                      setExpandedGroupKey((current) =>
                        current === group.group_key ? null : group.group_key,
                      )
                    }
                    onAdd={onAddGameGroup}
                  />
                ))}
              {!loading &&
                !error &&
                results.map((game, index) => {
                  const isHighlighted =
                    index + visibleGroupResults.length === highlightedIndex;
                  const artwork = artworkById[game.igdb_id];

                  return (
                    <div
                      class="planner-result-family"
                      key={`${game.igdb_id}:${artwork?.hero_url ?? ""}:${artwork?.logo_url ?? ""}`}
                    >
                      <SearchResultCartridge
                        buttonRef={(element) => {
                          resultRefs.current[
                            index + visibleGroupResults.length
                          ] = element;
                        }}
                        game={game}
                        artwork={artwork}
                        isArtworkLoading={pendingArtworkIds.has(game.igdb_id)}
                        isHighlighted={isHighlighted}
                        isAdding={addingId === game.igdb_id}
                        isAdded={addFeedback.active === game.igdb_id}
                        onMouseEnter={() =>
                          setHighlightedIndex(index + groupResults.length)
                        }
                        onFocus={() =>
                          setHighlightedIndex(index + groupResults.length)
                        }
                        onClick={() => handleAddGame(game)}
                      />
                      {(game.variants?.length ?? 0) > 0 && (
                        <div class="planner-result-variants">
                          {game.variants?.map((variant) => {
                            const variantGame = catalogGameFromVariant(variant);
                            return (
                              <SearchResultVariant
                                key={variant.igdb_id}
                                variant={variant}
                                isAdding={addingId === variant.igdb_id}
                                isAdded={addFeedback.active === variant.igdb_id}
                                onClick={() => handleAddGame(variantGame)}
                              />
                            );
                          })}
                        </div>
                      )}
                    </div>
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

interface GameGroupCardProps {
  group: GameGroupSearchResult;
  games: ListGame[];
  expanded: boolean;
  onToggle: () => void;
  isHighlighted: boolean;
  onAdd: (
    preview: GameGroupPreview,
    resolutions: GameGroupSelectionResolution[],
  ) => Promise<void>;
}

function groupArtworkSearchName(group: GameGroupSearchResult): string {
  const suffix = ` — ${group.scope_name}`;
  return group.display_name.endsWith(suffix)
    ? group.display_name.slice(0, -suffix.length)
    : group.display_name;
}

function groupArtworkGame(name: string): CatalogGame {
  return {
    igdb_id: 0,
    name,
    cover_url: "",
    summary: "",
    genres: [],
    platforms: [],
    release_year: null,
    rating: null,
  };
}

function catalogGameFromVariant(variant: CatalogGameVariant): CatalogGame {
  return {
    ...variant,
    ports: [],
    remakes: [],
    remasters: [],
    expanded_games: [],
    variants: [],
  };
}

function GameGroupCard({
  group,
  games,
  expanded,
  onToggle,
  isHighlighted,
  onAdd,
}: GameGroupCardProps) {
  const { t } = useLanguage();
  const [preview, setPreview] = useState<GameGroupPreview | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [unresolved, setUnresolved] = useState<GameGroupSelectionResolution[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");
  const [previewRetry, setPreviewRetry] = useState(0);
  const [artwork, setArtwork] = useState<GameArtwork>();
  const backlogGameIds = games.map((game) => game.igdb_id).join(",");
  const artworkSearchName = groupArtworkSearchName(group);
  const previewRef = useRef<GameGroupPreview | null>(null);
  const previewRequestKey = `${group.group_key}:${previewRetry}`;
  const previewRequestKeyRef = useRef(previewRequestKey);
  previewRequestKeyRef.current = previewRequestKey;

  useEffect(() => {
    const controller = new AbortController();
    void getGameArtwork(groupArtworkGame(artworkSearchName), controller.signal)
      .then((nextArtwork) => setArtwork(nextArtwork))
      .catch(() => setArtwork(undefined));
    return () => controller.abort();
  }, [artworkSearchName]);

  useEffect(() => {
    if (!expanded || previewRef.current) {
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    void previewGameGroup(
      group.group_key,
      backlogGameIds ? backlogGameIds.split(",").map(Number) : [],
      controller.signal,
    )
      .then((nextPreview) => {
        if (
          controller.signal.aborted ||
          previewRequestKeyRef.current !== previewRequestKey
        ) {
          return;
        }
        previewRef.current = nextPreview;
        setPreview(nextPreview);
        setSelectedIds(
          new Set(
            nextPreview.items
              .filter((item) => item.initially_selected)
              .map((item) => item.source_id),
          ),
        );
      })
      .catch((previewError: unknown) => {
        if (
          !controller.signal.aborted &&
          previewRequestKeyRef.current === previewRequestKey
        ) {
          setError(
            previewError instanceof Error
              ? previewError.message
              : t.search.groupPreviewFailed,
          );
        }
      })
      .finally(() => {
        if (
          !controller.signal.aborted &&
          previewRequestKeyRef.current === previewRequestKey
        ) {
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [
    backlogGameIds,
    expanded,
    group.group_key,
    previewRequestKey,
    t.search.groupPreviewFailed,
  ]);

  const toggleGame = (sourceId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(sourceId)) {
        next.delete(sourceId);
      } else {
        next.add(sourceId);
      }
      return next;
    });
  };

  const addSelected = async () => {
    if (!preview || selectedIds.size === 0) {
      return;
    }
    setAdding(true);
    setError("");
    setUnresolved([]);
    try {
      const resolutions = await resolveGameGroupSelection(
        preview.group.group_key,
        [...selectedIds],
      );
      const unresolvedSelections = resolutions.filter((item) => !item.game);
      const resolvedSelections = resolutions.filter((item) => item.game);
      setUnresolved(unresolvedSelections);
      if (resolvedSelections.length > 0) {
        await onAdd(preview, resolvedSelections);
        setSelectedIds(
          new Set(unresolvedSelections.map((item) => item.source_id)),
        );
      }
    } catch (addError) {
      setError(
        addError instanceof Error ? addError.message : t.search.addGroupFailed,
      );
    } finally {
      setAdding(false);
    }
  };

  return (
    <article
      class={`planner-result planner-group-result${isHighlighted ? " planner-result--active" : ""}`}
    >
      {artwork?.hero_url && (
        <img
          aria-hidden="true"
          class="planner-result__hero"
          src={artwork.hero_url}
          alt=""
          loading="lazy"
          decoding="async"
        />
      )}
      <div class="planner-result__wash" aria-hidden="true" />
      <Button
        unstyled
        class="planner-group-result__header"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-label={
          expanded
            ? t.search.collapseGroup(group.display_name)
            : t.search.expandGroup(group.display_name)
        }
      >
        <div class="planner-result__cover-frame">
          {artwork?.cover_url ? (
            <img
              src={previewCoverUrl(artwork.cover_url)}
              alt={`${groupArtworkSearchName(group)} artwork`}
              loading="lazy"
              decoding="async"
              width={56}
              height={80}
              class="planner-result__cover"
            />
          ) : (
            <div class="planner-result__cover planner-result__cover--empty">
              {group.card_kind.toUpperCase()}
            </div>
          )}
        </div>
        <div class="planner-result__body">
          <div class="planner-result__row">
            <div class="planner-result__identity">
              {artwork?.logo_url && (
                <img
                  class="planner-result__logo"
                  src={artwork.logo_url}
                  alt={`${artworkSearchName} logo`}
                  loading="lazy"
                  decoding="async"
                />
              )}
              <h3 class="planner-result__title planner-group-result__title">
                {group.display_name}
              </h3>
            </div>
            <span class="planner-group-result__meta">
              <span class="planner-group-result__kind">
                {group.card_kind.toUpperCase()}
              </span>
              {expanded ? (
                <CaretUpIcon aria-hidden="true" />
              ) : (
                <CaretDownIcon aria-hidden="true" />
              )}
            </span>
          </div>
          <div class="planner-result__details">
            <p class="planner-result__detail">
              {group.candidate_count > 0
                ? t.search.groupGames(group.candidate_count)
                : t.search.groupMembersUnknown}
            </p>
            <p class="planner-result__summary">
              {group.warning ?? t.search.groupDescription(group.card_kind)}
            </p>
          </div>
        </div>
      </Button>
      {group.sources.some((source) => source.source === "rawg") &&
        !expanded && (
          <p class="planner-group-result__attribution">
            {t.search.rawgEvidence} <a href="https://rawg.io/">RAWG</a>.
          </p>
        )}
      {expanded && (
        <div class="planner-group-result__preview">
          {group.warning && (
            <p class="planner-group-result__warning">{group.warning}</p>
          )}
          {loading && (
            <p class="planner-search-results__message">
              {t.search.loadingGroup}
            </p>
          )}
          {error && (
            <div class="planner-error" role="alert">
              <p>{error}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  previewRef.current = null;
                  setPreview(null);
                  setError("");
                  setPreviewRetry((current) => current + 1);
                }}
              >
                {t.list.retry}
              </Button>
            </div>
          )}
          {preview && !loading && (
            <>
              <div class="planner-group-result__items">
                {preview.items.map((item) => (
                  <label
                    key={item.source_id}
                    class="planner-group-result__item"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.source_id)}
                      disabled={adding}
                      onChange={() => toggleGame(item.source_id)}
                    />
                    <span>{item.name}</span>
                    <small>{item.release_year ?? t.search.unknownYear}</small>
                    <small>
                      {item.already_in_backlog
                        ? t.search.alreadyInBacklog
                        : item.edition.label}
                    </small>
                  </label>
                ))}
              </div>
              {unresolved.length > 0 && (
                <div class="planner-group-result__warning" role="alert">
                  <p>{t.search.unresolvedSelections(unresolved.length)}</p>
                  <ul>
                    {unresolved.map((item) => (
                      <li key={item.source_id}>{item.name}</li>
                    ))}
                  </ul>
                </div>
              )}
              {preview.unavailable_sources.length > 0 && (
                <p class="planner-group-result__warning">
                  {t.search.sourceEvidenceUnavailable}
                </p>
              )}
              {preview.rawg_attribution_required &&
                preview.rawg_attribution_url && (
                  <p class="planner-group-result__attribution">
                    {t.search.rawgEvidence}{" "}
                    <a href={preview.rawg_attribution_url}>RAWG</a>.
                  </p>
                )}
              <Button
                onClick={() => void addSelected()}
                disabled={adding || selectedIds.size === 0}
              >
                {adding
                  ? t.search.addingSelectedGames(selectedIds.size)
                  : t.search.addSelectedGames(selectedIds.size)}
              </Button>
            </>
          )}
        </div>
      )}
    </article>
  );
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
            <h3 class="planner-result__title">{game.name}</h3>
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

        {(game.variants?.length ?? 0) > 0 && (
          <p class="planner-result__version-count">
            {t.search.versions(game.variants?.length ?? 0)}
          </p>
        )}

        {isArtworkReady ? (
          <div class="planner-result__details">
            <p class="planner-result__detail">
              {game.platforms.length > 0 ? (
                <PlatformIcons platforms={game.platforms} />
              ) : (
                t.search.platformsUnavailable
              )}
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

interface SearchResultVariantProps {
  variant: CatalogGameVariant;
  isAdding: boolean;
  isAdded: boolean;
  onClick: () => void;
}

function SearchResultVariant({
  variant,
  isAdding,
  isAdded,
  onClick,
}: SearchResultVariantProps) {
  const { t } = useLanguage();
  const type = t.search.versionType(variant.game_type);
  const title = variant.version_title || variant.name;

  return (
    <Button
      unstyled
      class={`planner-result-variant${
        isAdding ? " planner-result-variant--loading" : ""
      }${isAdded ? " planner-result-variant--success" : ""}`}
      disabled={isAdding}
      onClick={onClick}
      aria-label={t.search.addVersion(variant.name, type)}
    >
      <span class="planner-result-variant__type">{type}</span>
      <span class="planner-result-variant__title">{title}</span>
      <span class="planner-result-variant__meta">
        {variant.platforms.length > 0
          ? variant.platforms.join(", ")
          : t.search.platformsUnavailable}
        {variant.release_year === null ? "" : ` · ${variant.release_year}`}
      </span>
      {(isAdding || isAdded) && (
        <span class="planner-result-variant__feedback">
          {isAdding ? t.search.adding : t.search.added}
        </span>
      )}
    </Button>
  );
}
