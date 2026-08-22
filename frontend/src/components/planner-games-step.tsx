import type { CatalogGame, HLTBCategory, ListGame } from "../types";
import { GameListView } from "./game-list-view";
import { GameSearch } from "./game-search";

interface Props {
  backlogName: string;
  games: ListGame[];
  onAddGame: (game: CatalogGame) => void;
  onSelectGameTime: (index: number, category: HLTBCategory) => void;
  onRemoveGame: (igdbId: number) => void;
  onRetryGame: (igdbId: number) => void;
  onMoveGame: (index: number, direction: -1 | 1) => void;
  onRenameBacklog: (name: string) => void;
}

export function PlannerGamesStep({
  backlogName,
  games,
  onAddGame,
  onSelectGameTime,
  onRemoveGame,
  onRetryGame,
  onMoveGame,
  onRenameBacklog,
}: Props) {
  return (
    <div class="planner-games-workspace">
      <GameSearch games={games} onAddGame={onAddGame} />

      <div class="planner-pane planner-pane--backlog">
        <GameListView
          name={backlogName}
          games={games}
          onRemoveGame={onRemoveGame}
          onSelectGameTime={onSelectGameTime}
          onRetryGame={onRetryGame}
          onMoveGame={onMoveGame}
          onRenameList={onRenameBacklog}
        />
      </div>
    </div>
  );
}
