import type {
  CatalogGame,
  GameGroupImport,
  GameGroupPreview,
  HLTBCategory,
  ListGame,
} from "../types";
import { GameListView } from "./game-list-view";
import { GameSearch } from "./game-search";

interface Props {
  backlogName: string;
  games: ListGame[];
  groupImports?: GameGroupImport[];
  onAddGame: (game: CatalogGame) => void;
  onAddGameGroup: (
    preview: GameGroupPreview,
    selectedIgdbIds: number[],
  ) => Promise<void>;
  onSelectGameTime: (index: number, category: HLTBCategory) => void;
  onRemoveGame: (igdbId: number) => void;
  onRetryGame: (igdbId: number) => void;
  onMoveGame: (index: number, direction: -1 | 1) => void;
  onReorderGames: (sourceIndex: number, targetIndex: number) => void;
  onRenameBacklog: (name: string) => void;
  onRemoveGroupImport: (importId: string) => void;
  onRemoveGroup: (groupKey: string) => void;
}

export function PlannerGamesStep({
  backlogName,
  games,
  groupImports,
  onAddGame,
  onAddGameGroup,
  onSelectGameTime,
  onRemoveGame,
  onRetryGame,
  onMoveGame,
  onReorderGames,
  onRenameBacklog,
  onRemoveGroupImport,
  onRemoveGroup,
}: Props) {
  return (
    <div class="planner-games-workspace">
      <GameSearch
        games={games}
        onAddGame={onAddGame}
        onAddGameGroup={onAddGameGroup}
      />

      <div class="planner-pane planner-pane--backlog">
        <GameListView
          name={backlogName}
          games={games}
          groupImports={groupImports}
          onRemoveGame={onRemoveGame}
          onSelectGameTime={onSelectGameTime}
          onRetryGame={onRetryGame}
          onMoveGame={onMoveGame}
          onReorderGames={onReorderGames}
          onRenameList={onRenameBacklog}
          onRemoveGroupImport={onRemoveGroupImport}
          onRemoveGroup={onRemoveGroup}
        />
      </div>
    </div>
  );
}
