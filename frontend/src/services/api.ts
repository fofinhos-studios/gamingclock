import type {
  CatalogGame,
  GameArtwork,
  GameGroupPreview,
  GameGroupSearchResult,
  GameGroupSelectionResolution,
  ListGame,
  PlanningMode,
  PlaySession,
  ScheduleAlgorithm,
  ScheduleResponse,
  WeeklyAvailability,
} from "../types";

const API_BASE = "/api";
const MAX_CACHED_SEARCHES = 24;
const MAX_CACHED_ARTWORK = 48;
const MAX_CACHED_RESOLVED_GAMES = 48;

const searchCache = new Map<string, CatalogGame[]>();
const artworkCache = new Map<string, GameArtwork>();
const resolvedGameCache = new Map<number, ListGame>();
const groupSearchCache = new Map<string, GameGroupSearchResult[]>();

export function clearGameRequestCache(): void {
  searchCache.clear();
  artworkCache.clear();
  resolvedGameCache.clear();
  groupSearchCache.clear();
}

export type ApiOperation =
  | "search"
  | "groups"
  | "resolve"
  | "schedule"
  | "ical";
export type ApiErrorKind = "network" | "backend";

interface ApiErrorOptions {
  kind: ApiErrorKind;
  operation: ApiOperation;
  status?: number;
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly operation: ApiOperation;
  readonly status: number | undefined;

  constructor(message: string, options: ApiErrorOptions) {
    super(message);
    this.name = "ApiError";
    this.kind = options.kind;
    this.operation = options.operation;
    this.status = options.status;
  }
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    return error.message;
  }
  return error instanceof Error && error.message ? error.message : fallback;
}

function remember<K, V>(cache: Map<K, V>, key: K, value: V, limit: number): V {
  cache.delete(key);
  cache.set(key, value);
  if (cache.size > limit) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) {
      cache.delete(oldestKey);
    }
  }
  return value;
}

async function parseError(
  response: Response,
  fallbackMessage: string,
  operation: ApiOperation,
): Promise<ApiError> {
  try {
    const data = (await response.json()) as { detail?: string };
    if (typeof data.detail === "string") {
      return new ApiError(data.detail, {
        kind: "backend",
        operation,
        status: response.status,
      });
    }
  } catch {
    // Ignore JSON parse errors and fall back to the default message.
  }
  return new ApiError(fallbackMessage, {
    kind: "backend",
    operation,
    status: response.status,
  });
}

async function request(
  input: RequestInfo | URL,
  init: RequestInit,
  fallbackMessage: string,
  operation: ApiOperation,
): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch {
    throw new ApiError(fallbackMessage, { kind: "network", operation });
  }
}

export async function searchGames(
  query: string,
  signal?: AbortSignal,
): Promise<CatalogGame[]> {
  const cacheKey = query.trim().toLocaleLowerCase();
  const cachedResults = searchCache.get(cacheKey);
  if (cachedResults) {
    return cachedResults;
  }
  const params = new URLSearchParams({ query });
  const response = await request(
    `${API_BASE}/games/search?${params.toString()}`,
    { signal },
    "Search failed",
    "search",
  );
  if (!response.ok) {
    throw await parseError(response, "Search failed", "search");
  }
  return remember(
    searchCache,
    cacheKey,
    await response.json(),
    MAX_CACHED_SEARCHES,
  );
}

export async function searchGameGroups(
  query: string,
  signal?: AbortSignal,
): Promise<GameGroupSearchResult[]> {
  const cacheKey = query.trim().toLocaleLowerCase();
  const cachedResults = groupSearchCache.get(cacheKey);
  if (cachedResults) {
    return cachedResults;
  }
  const response = await request(
    `${API_BASE}/game-groups/search?${new URLSearchParams({ query }).toString()}`,
    { signal },
    "Related game groups are unavailable.",
    "groups",
  );
  if (!response.ok) {
    throw await parseError(
      response,
      "Related game groups are unavailable.",
      "groups",
    );
  }
  return remember(
    groupSearchCache,
    cacheKey,
    await response.json(),
    MAX_CACHED_SEARCHES,
  );
}

export async function previewGameGroup(
  groupKey: string,
  existingIgdbIds: number[],
  signal?: AbortSignal,
): Promise<GameGroupPreview> {
  const response = await request(
    `${API_BASE}/game-groups/preview`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        group_key: groupKey,
        existing_igdb_ids: existingIgdbIds,
        edition_policy: "canonical_releases",
      }),
      signal,
    },
    "Could not load this game group.",
    "groups",
  );
  if (!response.ok) {
    throw await parseError(
      response,
      "Could not load this game group.",
      "groups",
    );
  }
  return response.json();
}

export async function resolveGameGroupSelection(
  groupKey: string,
  sourceMemberIds: string[],
): Promise<GameGroupSelectionResolution[]> {
  const response = await request(`${API_BASE}/game-groups/resolve-selection`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      group_key: groupKey,
      source_member_ids: sourceMemberIds,
    }),
  });
  const data = await response.json();
  return data.resolutions;
}

export async function resolveGame(
  game: CatalogGame,
  signal?: AbortSignal,
): Promise<ListGame> {
  const cachedGame = resolvedGameCache.get(game.igdb_id);
  if (cachedGame) {
    return cachedGame;
  }
  const response = await request(
    `${API_BASE}/games/resolve`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(game),
      signal,
    },
    "Could not find a playtime estimate",
    "resolve",
  );
  if (!response.ok) {
    throw await parseError(
      response,
      "Could not find a playtime estimate",
      "resolve",
    );
  }
  const resolvedGame = (await response.json()) as ListGame;
  return resolvedGame.hltb_status === "resolved"
    ? remember(
        resolvedGameCache,
        game.igdb_id,
        resolvedGame,
        MAX_CACHED_RESOLVED_GAMES,
      )
    : resolvedGame;
}

export async function resolveGames(games: CatalogGame[]): Promise<ListGame[]> {
  if (games.length === 0) {
    return [];
  }
  const response = await request(
    `${API_BASE}/games/resolve-batch`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ games }),
    },
    "Could not find playtime estimates",
    "resolve",
  );
  if (!response.ok) {
    throw await parseError(
      response,
      "Could not find playtime estimates",
      "resolve",
    );
  }
  return ((await response.json()) as { games: ListGame[] }).games;
}

export async function getGameArtwork(
  game: CatalogGame,
  signal?: AbortSignal,
): Promise<GameArtwork> {
  const cacheKey = `${game.igdb_id}:${game.name.toLocaleLowerCase()}`;
  const cachedArtwork = artworkCache.get(cacheKey);
  if (cachedArtwork) {
    return cachedArtwork;
  }
  const params = new URLSearchParams({
    igdb_id: String(game.igdb_id),
    name: game.name,
  });
  const response = await request(
    `${API_BASE}/games/artwork?${params.toString()}`,
    { signal },
    "Could not load game artwork",
    "search",
  );
  if (!response.ok) {
    throw await parseError(response, "Could not load game artwork", "search");
  }
  return remember(
    artworkCache,
    cacheKey,
    await response.json(),
    MAX_CACHED_ARTWORK,
  );
}

export async function generateSchedule(
  gameListName: string,
  games: ListGame[],
  availability: WeeklyAvailability,
  algorithm: ScheduleAlgorithm,
  startDate: string,
  planningMode: PlanningMode = "weekly",
  finishByDate: string | null = null,
  maxSessionHours = 4,
): Promise<ScheduleResponse> {
  const response = await request(
    `${API_BASE}/schedule/generate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        game_list_name: gameListName,
        games,
        availability,
        algorithm,
        start_date: startDate,
        planning_mode: planningMode,
        finish_by_date: finishByDate,
        max_session_hours: maxSessionHours,
      }),
    },
    "Schedule generation failed",
    "schedule",
  );
  if (!response.ok) {
    throw await parseError(response, "Schedule generation failed", "schedule");
  }
  return response.json();
}

export async function downloadIcal(
  gameListName: string,
  games: ListGame[],
  availability: WeeklyAvailability,
  algorithm: ScheduleAlgorithm,
  startDate: string,
  planningMode: PlanningMode = "weekly",
  finishByDate: string | null = null,
  maxSessionHours = 4,
  sessions: PlaySession[] | null = null,
): Promise<Blob> {
  const response = await request(
    `${API_BASE}/schedule/ical`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        game_list_name: gameListName,
        games,
        availability,
        algorithm,
        start_date: startDate,
        planning_mode: planningMode,
        finish_by_date: finishByDate,
        max_session_hours: maxSessionHours,
        sessions,
      }),
    },
    "iCal download failed",
    "ical",
  );
  if (!response.ok) {
    throw await parseError(response, "iCal download failed", "ical");
  }
  return response.blob();
}

async function deflateRaw(value: string): Promise<Uint8Array | null> {
  if (typeof CompressionStream === "undefined") {
    return null;
  }

  const stream = new Blob([value])
    .stream()
    .pipeThrough(new CompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

export async function createCalendarUrl(
  gameListName: string,
  sessions: PlaySession[],
): Promise<string> {
  const content = JSON.stringify({
    game_list_name: gameListName,
    sessions,
  });
  const compressed = await deflateRaw(content);
  const payload = toBase64Url(compressed ?? new TextEncoder().encode(content));
  const params = new URLSearchParams({
    payload,
    encoding: compressed ? "deflate" : "plain",
  });
  return new URL(
    `${API_BASE}/schedule/ical-url?${params}`,
    window.location.origin,
  ).href;
}
