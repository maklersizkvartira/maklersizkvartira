export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT';

export type GameTheme = 'uyiz' | 'classic' | 'cyberpunk';

export interface TileData {
  id: string;
  value: number;
  row: number;
  col: number;
  isNew?: boolean;
  isMerged?: boolean;
}

export interface GameStats {
  score: number;
  bestScore: number;
  moves: number;
  undosRemaining: number;
  maxTile: number;
}

export interface Achievement {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlockedAt?: number;
}

export interface MoveResult {
  moved: boolean;
  scoreGained: number;
  mergeCount: number;
  maxMergedValue: number;
}
