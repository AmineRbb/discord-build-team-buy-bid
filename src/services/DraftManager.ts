import { Captain, DraftState, BidResult } from '../types';

export class DraftManager {
  private currentDraft: DraftState | null = null;
  private readonly PLAYER_VALUE = 20;

  constructor() {}

  public createDraft(hostId: string, channelId: string): boolean {
    if (this.currentDraft?.isActive) {
      return false; 
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
      isActive: true,
      lastDrawnPlayer: undefined
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

    // Calculer le nombre de joueurs par équipe (en comptant le capitaine comme 1 joueur)
    // Chaque équipe aura : 1 capitaine + N joueurs draftés
    const totalPlayers = this.currentDraft.playerPool.length + this.currentDraft.captains.length;
    const playersPerTeam = Math.floor(totalPlayers / this.currentDraft.captains.length);
    const playersToDraft = playersPerTeam - 1; // -1 car le capitaine compte comme 1 joueur
    
    if (playersToDraft <= 0) {
      return { success: false, message: "Pas assez de joueurs pour former des équipes équilibrées." };
    }

    const budgetPerCaptain = playersToDraft * this.PLAYER_VALUE;

    this.currentDraft.playersPerTeam = playersPerTeam;

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

    // Vérifier si l'équipe du capitaine est complète
    if (this.isTeamComplete(captain)) {
      return { success: false, message: "🏆 Votre équipe est déjà complète !" };
    }

    if (amount > captain.budget) {
      return { success: false, message: `💰 Budget insuffisant. Vous avez ${captain.budget.toLocaleString()}€.` };
    }

    if (amount < 0) {
      return { success: false, message: "💸 Le montant ne peut pas être négatif." };
    }

    // NOUVELLE LOGIQUE : 0€ uniquement si budget = 0
    if (amount === 0 && captain.budget > 0) {
      return { success: false, message: "💸 Vous ne pouvez miser 0€ que si vous n'avez plus de budget." };
    }

    // Vérifier que l'enchère est supérieure aux enchères existantes
    const currentBids = Object.values(this.currentDraft.roundBids);
    const highestBid = currentBids.length > 0 ? Math.max(...currentBids) : 0;
    
    if (amount > 0 && amount <= highestBid) {
      return { 
        success: false, 
        message: `📈 Votre enchère doit être supérieure à ${highestBid.toLocaleString()}€ (enchère actuelle la plus haute).` 
      };
    }

    // Vérifier qu'aucun autre capitaine n'a déjà misé ce montant exact (sauf pour 0€)
    if (amount > 0) {
      const existingBids = Object.entries(this.currentDraft.roundBids);
      for (const [otherCaptainId, bid] of existingBids) {
        if (otherCaptainId !== captainId && bid === amount) {
          return { 
            success: false, 
            message: `🚫 Un autre capitaine a déjà misé ${amount.toLocaleString()}€. Votre enchère doit être unique.` 
          };
        }
      }
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

    // Vérifier si l'équipe du capitaine est complète
    if (this.isTeamComplete(captain)) {
      return { success: false, message: "🏆 Votre équipe est déjà complète ! Vous êtes automatiquement exclu des enchères." };
    }

    captain.hasPassed = true;
    captain.currentBid = undefined;
    // Supprimer l'enchère actuelle de ce capitaine
    delete this.currentDraft.roundBids[captainId];

    return { success: true };
  }

  public checkBiddingComplete(): boolean {
    if (!this.currentDraft || !this.currentDraft.biddingOpen) {
      return false;
    }

    // Obtenir les capitaines éligibles (équipe non complète ET budget > 0)
    const eligibleCaptains = this.getEligibleCaptains();
    
    if (eligibleCaptains.length === 0) {
      // Aucun capitaine éligible, le joueur sera distribué à la fin
      return true;
    }

    if (eligibleCaptains.length === 1) {
      // Un seul capitaine éligible
      const soloCapt = eligibleCaptains[0];
      
      // S'il a déjà misé ou passé, les enchères sont terminées
      if (soloCapt.hasPassed || this.currentDraft.roundBids[soloCapt.id] !== undefined) {
        return true;
      }
      
      // Sinon, on attend qu'il mise ou passe
      return false;
    }

    // Plusieurs capitaines éligibles
    // Compter ceux qui ont répondu (bid ou pass)
    const respondedEligible = eligibleCaptains.filter(c => 
      c.hasPassed || this.currentDraft!.roundBids[c.id] !== undefined
    ).length;

    // Si tous les capitaines éligibles ont répondu
    if (respondedEligible === eligibleCaptains.length) {
      // Vérifier s'il n'y a qu'un seul enchérisseur actif
      const activeBidders = eligibleCaptains.filter(c => 
        !c.hasPassed && this.currentDraft!.roundBids[c.id] !== undefined
      );
      
      if (activeBidders.length <= 1) {
        return true;
      }
      
      // S'il y a plusieurs enchérisseurs, continuer les enchères
      // Reset les états pour permettre de nouvelles enchères
      eligibleCaptains.forEach(captain => {
        if (!captain.hasPassed) {
          captain.currentBid = undefined;
          // Garder l'enchère dans roundBids mais permettre de surenchérir
        }
      });
      
      return false;
    }

    // Pas tous les capitaines éligibles ont répondu
    return false;
  }

  private getEligibleCaptains(): Captain[] {
    if (!this.currentDraft) return [];
    
    // Obtenir la mise la plus haute actuelle (TOUTES les enchères)
    const currentBids = Object.values(this.currentDraft.roundBids);
    const highestBid = currentBids.length > 0 ? Math.max(...currentBids) : 0;
    
    return this.currentDraft.captains.filter(captain => {
      // L'équipe ne doit pas être complète
      if (this.isTeamComplete(captain)) return false;
      
      // Si il n'y a pas encore d'enchères, tous les capitaines sont éligibles
      if (highestBid === 0) return captain.budget >= 0;
      
      // Le capitaine doit pouvoir miser au-dessus de la plus haute enchère
      // OU avoir budget = 0 (pour pouvoir miser 0€)
      return captain.budget > highestBid || captain.budget === 0;
    });
  }

  private isTeamComplete(captain: Captain): boolean {
    if (!this.currentDraft) return false;
    
    // Une équipe est complète si elle a playersPerTeam - 1 joueurs draftés
    // (le -1 car le capitaine compte comme 1 joueur)
    const maxDraftedPlayers = (this.currentDraft.playersPerTeam || 1) - 1;
    return captain.players.length >= maxDraftedPlayers;
  }

  public resolveBidding(): BidResult {
    if (!this.currentDraft || !this.currentPlayer) {
      return { winner: null, winningBid: 0, tiedCaptains: [] };
    }

    // Vérifier s'il n'y a qu'un seul capitaine éligible
    const eligibleCaptains = this.getEligibleCaptains();
    
    if (eligibleCaptains.length === 1) {
      const soloCaptain = eligibleCaptains[0];
      // S'il a misé quelque chose (même 0€), il gagne
      if (this.currentDraft.roundBids[soloCaptain.id] !== undefined) {
        const winningBid = this.currentDraft.roundBids[soloCaptain.id];
        soloCaptain.budget -= winningBid;
        soloCaptain.players.push(this.currentPlayer);
        this.currentDraft.draftedPlayers.add(this.currentPlayer);
        
        return { winner: soloCaptain, winningBid, tiedCaptains: [] };
      }
    }

    const bids = Object.entries(this.currentDraft.roundBids)
      .map(([captainId, bid]) => ({
        captain: this.currentDraft!.captains.find(c => c.id === captainId)!,
        bid
      }))
      .filter(entry => entry.bid >= 0); 

    if (bids.length === 0) {
      // Personne n'a misé, le joueur sera attribué à la fin
      return { winner: null, winningBid: 0, tiedCaptains: [] };
    }

    if (bids.length === 1) {
      // Un seul enchérisseur
      const winner = bids[0].captain;
      const winningBid = bids[0].bid;
      winner.budget -= winningBid;
      winner.players.push(this.currentPlayer);
      this.currentDraft.draftedPlayers.add(this.currentPlayer);
      
      return { winner, winningBid, tiedCaptains: [] };
    }

    // Plusieurs enchérisseurs - prendre le plus haut
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

    let selectedPlayer: string;

    // Si il y a 3 joueurs ou plus disponibles et qu'on a un joueur précédent,
    // éviter de retomber sur le même joueur immédiatement
    if (availablePlayers.length >= 3 && this.currentDraft.lastDrawnPlayer) {
      const playersExcludingLast = availablePlayers.filter(
        player => player !== this.currentDraft!.lastDrawnPlayer
      );
      
      if (playersExcludingLast.length > 0) {
        const randomIndex = Math.floor(Math.random() * playersExcludingLast.length);
        selectedPlayer = playersExcludingLast[randomIndex];
      } else {
        // Fallback au cas où (ne devrait pas arriver)
        const randomIndex = Math.floor(Math.random() * availablePlayers.length);
        selectedPlayer = availablePlayers[randomIndex];
      }
    } else {
      // Tirage normal si moins de 3 joueurs ou pas de joueur précédent
      const randomIndex = Math.floor(Math.random() * availablePlayers.length);
      selectedPlayer = availablePlayers[randomIndex];
    }

    this.currentDraft.currentPlayer = selectedPlayer;
    this.currentDraft.lastDrawnPlayer = selectedPlayer; // Mémoriser le joueur tiré
    this.currentDraft.biddingOpen = true;
    this.currentDraft.roundBids = {};

    // Reset captain states
    this.currentDraft.captains.forEach(captain => {
      if (this.isTeamComplete(captain)) {
        // Automatiquement marquer les capitaines avec équipe complète comme ayant passé
        captain.hasPassed = true;
        captain.currentBid = undefined;
      } else {
        // Reset pour les capitaines éligibles
        captain.hasPassed = false;
        captain.currentBid = undefined;
      }
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