import type { ListGame } from "../types";
import { GameListView } from "./game-list-view";
import { GameSearch } from "./game-search";
import { Card } from "./ui";

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
    <div class="grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
      <Card class="p-6 md:p-8">
        <GameSearch onAddGame={onAddGame} />
      </Card>

      <Card class="p-6 md:p-8">
        <GameListView
          name={backlogName}
          games={games}
          onRemoveGame={onRemoveGame}
          onRenameList={onRenameBacklog}
        />
      </Card>
    </div>
  );
}
