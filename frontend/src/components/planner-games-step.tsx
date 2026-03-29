import type { ListGame } from "../types";
import { GameListView } from "./game-list-view";
import { GameSearch } from "./game-search";

interface Props {
  backlogName: string;
  games: ListGame[];
  onAddGame: (game: ListGame) => void;
  onRemoveGame: (index: number) => void;
  onRenameBacklog: (name: string) => void;
}

export function PlannerGamesStep({
  backlogName,
  games,
  onAddGame,
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
          onRenameList={onRenameBacklog}
        />
      </div>
    </div>
  );
}
