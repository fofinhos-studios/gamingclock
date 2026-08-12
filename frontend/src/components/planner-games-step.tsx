import type { CatalogGame, HLTBCategory, ListGame } from "../types";
import { GameListView } from "./game-list-view";
import { GameSearch } from "./game-search";

interface Props {
  backlogName: string;
  games: ListGame[];
  onAddGame: (game: CatalogGame) => void;
  onSelectGameTime: (index: number, category: HLTBCategory) => void;
  onRemoveGame: (igdbId: number) => void;
  onRenameBacklog: (name: string) => void;
}

export function PlannerGamesStep({
  backlogName,
  games,
  onAddGame,
  onSelectGameTime,
  onRemoveGame,
  onRenameBacklog,
}: Props) {
  return (
    <div class="planner-games-workspace">
      <div class="planner-pane planner-pane--search">
        <GameSearch games={games} onAddGame={onAddGame} />
      </div>

      <div class="planner-pane planner-pane--backlog">
        <GameListView
          name={backlogName}
          games={games}
          onRemoveGame={onRemoveGame}
          onSelectGameTime={onSelectGameTime}
          onRenameList={onRenameBacklog}
        />
      </div>
    </div>
  );
}
