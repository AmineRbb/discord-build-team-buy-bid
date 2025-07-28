import { Captain, DraftState, BidResult } from '../types';

export class DraftManager {
  private currentDraft: DraftState | null = null;
  private readonly PLAYER_VALUE = 20_000_000; // 20M par joueur

  constructor() {}

  public createDraft(hostId: string, channelId: string): boolean {
    if (this.currentDraft?.isActive) {
      return false; // Une draft est déjà active
    }

    this.currentDraft = {
      hostId,
      captains: [],
      playerPool: [],
      draftedPlayers: new Set(),
      currentPlayer: null,
      biddingOpen: false,
      roundBids: {},
      channelId,
      isActive: true
    };

    return true;
  }

  public addCaptain(userId: string, username: string): boolean {
    if (!this.currentDraft || !this.currentDraft.isActive) {
      return false;
    }

    // Vérifier que le capitaine n'est pas déjà dans la liste
    if (this.currentDraft.captains.some(c => c.id === userId)) {
      return false;
    }

    const captain: Captain = {
      id: userId,
      username,
      budget: 0, // Sera calculé au début de la draft
      players: [],
      hasPassed: false,
      currentBid: undefined
    };

    this.currentDraft.captains.push(captain);
    return true;
  }

  public addPlayer(playerName: string): boolean {
    if (!this.currentDraft || !this.currentDraft.isActive || this.currentDraft.biddingOpen) {
      return false;
    }

    // Vérifier que le joueur n'est pas déjà dans la liste
    if (this.currentDraft.playerPool.includes(playerName)) {
      return false;
    }

    this.currentDraft.playerPool.push(playerName);
    return true;
  }

  public startDraft(): { success: boolean; message?: string } {
    if (!this.currentDraft || !this.currentDraft.isActive) {
      return { success: false, message: "Aucune draft active." };
    }

    if (this.currentDraft.captains.length < 2) {
      return { success: false, message: "Il faut au moins 2 capitaines pour commencer." };
    }

    if (this.currentDraft.playerPool.length === 0) {
      return { success: false, message: "Il faut au moins 1 joueur pour commencer." };
    }

    // Calculer le budget par capitaine
    const playersPerCaptain = Math.floor(this.currentDraft.playerPool.length / this.currentDraft.captains.length);
    const budgetPerCaptain = playersPerCaptain * this.PLAYER_VALUE;

    this.currentDraft.playersPerTeam = playersPerCaptain;

    // Attribuer le budget à chaque capitaine
    this.currentDraft.captains.forEach(captain => {
      captain.budget = budgetPerCaptain;
    });

    // Tirer le premier joueur au sort
    this.drawNextPlayer();

    return { success: true };
  }

  public placeBid(captainId: string, amount: number): { success: boolean; message?: string } {
    if (!this.currentDraft || !this.currentDraft.biddingOpen) {
      return { success: false, message: "Aucune enchère en cours." };
    }

    const captain = this.currentDraft.captains.find(c => c.id === captainId);
    if (!captain) {
      return { success: false, message: "Capitaine non trouvé." };
    }

    if (amount > captain.budget) {
      return { success: false, message: `Budget insuffisant. Vous avez ${captain.budget.toLocaleString()}€.` };
    }

    if (amount <= 0) {
      return { success: false, message: "Le montant doit être positif." };
    }

    // Enregistrer l'enchère
    this.currentDraft.roundBids[captainId] = amount;
    captain.currentBid = amount;
    captain.hasPassed = false;

    return { success: true };
  }

  public passBid(captainId: string): { success: boolean; message?: string } {
    if (!this.currentDraft || !this.currentDraft.biddingOpen) {
      return { success: false, message: "Aucune enchère en cours." };
    }

    const captain = this.currentDraft.captains.find(c => c.id === captainId);
    if (!captain) {
      return { success: false, message: "Capitaine non trouvé." };
    }

    captain.hasPassed = true;
    captain.currentBid = undefined;

    return { success: true };
  }

  public checkBiddingComplete(): boolean {
    if (!this.currentDraft || !this.currentDraft.biddingOpen) {
      return false;
    }

    return this.currentDraft.captains.every(captain => 
      captain.hasPassed || captain.currentBid !== undefined
    );
  }

  public resolveBidding(): BidResult {
    if (!this.currentDraft || !this.currentPlayer) {
      return { winner: null, winningBid: 0, tiedCaptains: [] };
    }

    const bids = Object.entries(this.currentDraft.roundBids)
      .map(([captainId, bid]) => ({
        captain: this.currentDraft!.captains.find(c => c.id === captainId)!,
        bid
      }))
      .filter(entry => entry.bid > 0);

    if (bids.length === 0) {
      // Personne n'a misé, le joueur sera attribué à la fin
      return { winner: null, winningBid: 0, tiedCaptains: [] };
    }

    const maxBid = Math.max(...bids.map(b => b.bid));
    const winners = bids.filter(b => b.bid === maxBid);

    if (winners.length === 1) {
      const winner = winners[0].captain;
      winner.budget -= maxBid;
      winner.players.push(this.currentPlayer);
      this.currentDraft.draftedPlayers.add(this.currentPlayer);
      
      return { winner, winningBid: maxBid, tiedCaptains: [] };
    } else {
      // Égalité - tirage au sort
      const randomWinner = winners[Math.floor(Math.random() * winners.length)];
      const winner = randomWinner.captain;
      winner.budget -= maxBid;
      winner.players.push(this.currentPlayer);
      this.currentDraft.draftedPlayers.add(this.currentPlayer);

      return { 
        winner, 
        winningBid: maxBid, 
        tiedCaptains: winners.map(w => w.captain) 
      };
    }
  }

  public drawNextPlayer(): string | null {
    if (!this.currentDraft) return null;

    const availablePlayers = this.currentDraft.playerPool.filter(
      player => !this.currentDraft!.draftedPlayers.has(player)
    );

    if (availablePlayers.length === 0) {
      this.finalizeDraft();
      return null;
    }

    const randomIndex = Math.floor(Math.random() * availablePlayers.length);
    const selectedPlayer = availablePlayers[randomIndex];
    this.currentDraft.currentPlayer = selectedPlayer;
    this.currentDraft.biddingOpen = true;
    this.currentDraft.roundBids = {};

    // Reset captain states
    this.currentDraft.captains.forEach(captain => {
      captain.hasPassed = false;
      captain.currentBid = undefined;
    });

    return selectedPlayer;
  }

  private finalizeDraft(): void {
    if (!this.currentDraft) return;

    // Distribuer les joueurs restants équitablement
    const remainingPlayers = this.currentDraft.playerPool.filter(
      player => !this.currentDraft!.draftedPlayers.has(player)
    );

    // Mélanger les joueurs restants
    const shuffled = [...remainingPlayers].sort(() => Math.random() - 0.5);

    // Distribuer équitablement
    let captainIndex = 0;
    shuffled.forEach(player => {
      this.currentDraft!.captains[captainIndex].players.push(player);
      captainIndex = (captainIndex + 1) % this.currentDraft!.captains.length;
    });

    this.currentDraft.biddingOpen = false;
    this.currentDraft.currentPlayer = null;
  }

  public getCurrentDraft(): DraftState | null {
    return this.currentDraft;
  }

  public get currentPlayer(): string | null {
    return this.currentDraft?.currentPlayer || null;
  }

  public isDraftComplete(): boolean {
    if (!this.currentDraft) return false;
    
    return this.currentDraft.playerPool.every(player => 
      this.currentDraft!.draftedPlayers.has(player) || 
      this.currentDraft!.captains.some(captain => captain.players.includes(player))
    );
  }

  public endDraft(): void {
    if (this.currentDraft) {
      this.currentDraft.isActive = false;
      this.currentDraft = null;
    }
  }
} 