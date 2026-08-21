export type HLTBStatus = "loading" | "resolved" | "unresolved";
export type HLTBCategory = "main" | "extras" | "completionist";

export interface CatalogGame {
  igdb_id: number;
  name: string;
  cover_url: string;
  summary: string;
  genres: string[];
  platforms: string[];
  release_year: number | null;
  rating: number | null;
}

export interface ListGame extends CatalogGame {
  logo_url?: string;
  hero_url?: string;
  hltb_status: HLTBStatus;
  hltb_error?: string | null;
  hltb_match_name: string | null;
  main_story_hours: number | null;
  main_extra_hours: number | null;
  completionist_hours: number | null;
  selected_hltb_category?: HLTBCategory;
}

export interface GameList {
  id: string;
  name: string;
  games: ListGame[];
}

export interface DayAvailability {
  day_of_week: number;
  hours: number;
  start_hour: number;
}

export interface WeeklyAvailability {
  days: DayAvailability[];
}

export type ScheduleAlgorithm = "sequential" | "alternating";

export interface PlaySession {
  game_name: string;
  date: string;
  start_time: string;
  duration_hours: number;
}

export interface ScheduleResponse {
  sessions: PlaySession[];
  total_hours: number;
  estimated_end_date: string | null;
}

export interface ScheduleErrorDetail {
  igdb_id: number;
  name: string;
}

export interface ScheduleErrorResponse {
  message: string;
  unresolved_games: ScheduleErrorDetail[];
}

export function getSelectedGameHours(game: ListGame): number {
  const category = game.selected_hltb_category ?? "main";
  const selectedHours = {
    main: game.main_story_hours,
    extras: game.main_extra_hours,
    completionist: game.completionist_hours,
  }[category];

  return selectedHours ?? game.main_story_hours ?? 0;
}
