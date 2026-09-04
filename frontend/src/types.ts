export type HLTBStatus = "loading" | "resolved" | "unresolved";
export type HLTBCategory = "main" | "extras" | "completionist";
export type GameGroupKind = "series" | "franchise";
export type GameGroupSource = "igdb" | "rawg" | "wikidata";

export interface GameGroupEvidence {
  source: GameGroupSource;
  label: string;
}

export interface GameGroupSearchResult {
  group_key: string;
  display_name: string;
  scope_name: string;
  card_kind: GameGroupKind;
  candidate_count: number;
  sources: GameGroupEvidence[];
  warning: string | null;
}

export interface GameGroupPreviewItem {
  source_id: string;
  name: string;
  release_year: number | null;
  igdb_id: number | null;
  order: number;
  initially_selected: boolean;
  already_in_backlog: boolean;
  evidence: Array<{ source: GameGroupSource; relation: string; label: string }>;
  edition: { state: string; label: string };
}

export interface GameGroupSelectionResolution {
  source_id: string;
  name: string;
  game: CatalogGame | null;
  reason: string | null;
}

export interface GameGroupPreview {
  group: GameGroupSearchResult;
  items: GameGroupPreviewItem[];
  excluded_items: Array<{ label: string; reason: string }>;
  possible_matches: Array<{
    source: GameGroupSource;
    source_id: string;
    name: string;
    release_year: number | null;
    reason: string;
    igdb_id: number | null;
  }>;
  unavailable_sources: GameGroupSource[];
  rawg_attribution_required: boolean;
  rawg_attribution_url: string | null;
}

export interface GameGroupImport {
  id: string;
  group_key: string;
  display_name: string;
  card_kind: GameGroupKind;
  sources: GameGroupSource[];
  selected_igdb_ids: number[];
  created_at: string;
}

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

export interface GameArtwork {
  cover_url: string;
  logo_url: string;
  hero_url: string;
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
  added_individually?: boolean;
  group_import_ids?: string[];
  group_keys?: string[];
}

export interface GameList {
  id: string;
  name: string;
  games: ListGame[];
  group_imports?: GameGroupImport[];
}

export interface DayAvailability {
  day_of_week: number;
  hours: number;
  start_hour: number;
  start_minute?: number;
}

export interface WeeklyAvailability {
  days: DayAvailability[];
}

export type ScheduleAlgorithm = "sequential" | "alternating";
export type PlanningMode = "weekly" | "finish_by";

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

export function getSelectedGameHours(game: ListGame): number {
  const category = game.selected_hltb_category ?? "main";
  const selectedHours = {
    main: game.main_story_hours,
    extras: game.main_extra_hours,
    completionist: game.completionist_hours,
  }[category];

  return selectedHours ?? game.main_story_hours ?? 0;
}
