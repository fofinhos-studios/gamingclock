import type {
  CatalogGame,
  GameArtwork,
  ListGame,
  PlanningMode,
  PlaySession,
  ScheduleAlgorithm,
  ScheduleResponse,
  WeeklyAvailability,
} from "../types";

const API_BASE = "/api";

export type ApiOperation = "search" | "resolve" | "schedule" | "ical";
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

export async function searchGames(query: string): Promise<CatalogGame[]> {
  const params = new URLSearchParams({ query });
  const response = await request(
    `${API_BASE}/games/search?${params.toString()}`,
    {},
    "Search failed",
    "search",
  );
  if (!response.ok) {
    throw await parseError(response, "Search failed", "search");
  }
  return response.json();
}

export async function resolveGame(game: CatalogGame): Promise<ListGame> {
  const response = await request(
    `${API_BASE}/games/resolve`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(game),
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
  return response.json();
}

export async function getGameArtwork(game: CatalogGame): Promise<GameArtwork> {
  const response = await request(
    `${API_BASE}/games/artwork`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(game),
    },
    "Could not load game artwork",
    "search",
  );
  if (!response.ok) {
    throw await parseError(response, "Could not load game artwork", "search");
  }
  return response.json();
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
