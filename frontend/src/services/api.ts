import type {
  CatalogGame,
  ListGame,
  ScheduleAlgorithm,
  ScheduleErrorResponse,
  ScheduleResponse,
  WeeklyAvailability,
} from "../types";

const API_BASE = "/api";

async function parseError(
  response: Response,
  fallbackMessage: string,
): Promise<Error> {
  try {
    const data = (await response.json()) as {
      detail?: ScheduleErrorResponse | string;
    };
    if (typeof data.detail === "string") {
      return new Error(data.detail);
    }
    if (data.detail?.message) {
      return new Error(data.detail.message);
    }
  } catch {
    // Ignore JSON parse errors and fall back to the default message.
  }
  return new Error(fallbackMessage);
}

export async function searchGames(query: string): Promise<CatalogGame[]> {
  const params = new URLSearchParams({ query });
  const response = await fetch(`${API_BASE}/games/search?${params.toString()}`);
  if (!response.ok) {
    throw await parseError(response, "Search failed");
  }
  return response.json();
}

export async function resolveGame(game: CatalogGame): Promise<ListGame> {
  const response = await fetch(`${API_BASE}/games/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(game),
  });
  if (!response.ok) {
    throw await parseError(response, "Game resolution failed");
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
  const response = await fetch(`${API_BASE}/schedule/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      game_list_name: gameListName,
      games,
      availability,
      algorithm,
      start_date: startDate,
    }),
  });
  if (!response.ok) {
    throw await parseError(response, "Schedule generation failed");
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
  const response = await fetch(`${API_BASE}/schedule/ical`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      game_list_name: gameListName,
      games,
      availability,
      algorithm,
      start_date: startDate,
    }),
  });
  if (!response.ok) {
    throw await parseError(response, "iCal download failed");
  }
  return response.blob();
}
