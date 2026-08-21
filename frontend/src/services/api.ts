import type {
  CatalogGame,
  ListGame,
  ScheduleAlgorithm,
  ScheduleErrorDetail,
  ScheduleErrorResponse,
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
  unresolvedGames?: ScheduleErrorDetail[];
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly operation: ApiOperation;
  readonly status: number | undefined;
  readonly unresolvedGames: ScheduleErrorDetail[];

  constructor(message: string, options: ApiErrorOptions) {
    super(message);
    this.name = "ApiError";
    this.kind = options.kind;
    this.operation = options.operation;
    this.status = options.status;
    this.unresolvedGames = options.unresolvedGames ?? [];
  }
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.unresolvedGames.length > 0) {
      return `${error.message}: ${error.unresolvedGames
        .map((game) => game.name)
        .join(", ")}`;
    }
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
    const data = (await response.json()) as {
      detail?: ScheduleErrorResponse | string;
    };
    if (typeof data.detail === "string") {
      return new ApiError(data.detail, {
        kind: "backend",
        operation,
        status: response.status,
      });
    }
    if (data.detail?.message) {
      return new ApiError(data.detail.message, {
        kind: "backend",
        operation,
        status: response.status,
        unresolvedGames: data.detail.unresolved_games,
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

export async function generateSchedule(
  gameListName: string,
  games: ListGame[],
  availability: WeeklyAvailability,
  algorithm: ScheduleAlgorithm,
  startDate: string,
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
