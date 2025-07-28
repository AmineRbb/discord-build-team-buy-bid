export interface Captain {
  id: string;
  username: string;
  budget: number;
  players: string[];
  hasPassed: boolean;
  currentBid?: number;
}

export interface DraftState {
  hostId: string;
  captains: Captain[];
  playerPool: string[]; // noms ou mentions
  draftedPlayers: Set<string>;
  currentPlayer: string | null;
  biddingOpen: boolean;
  roundBids: Record<string, number>; // captainId -> bid
  channelId: string;
  isActive: boolean;
  playersPerTeam?: number;
}

export interface BidResult {
  winner: Captain | null;
  winningBid: number;
  tiedCaptains: Captain[];
}

export enum DraftPhase {
  WAITING = 'waiting',
  BIDDING = 'bidding',
  COMPLETED = 'completed'
} 