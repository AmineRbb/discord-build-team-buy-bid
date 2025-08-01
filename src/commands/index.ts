import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder, SlashCommandStringOption, SlashCommandIntegerOption } from 'discord.js';
import { DraftManager } from '../services/DraftManager';

const draftManager = new DraftManager();

export const commands = [
  {
    data: new SlashCommandBuilder()
      .setName('create')
      .setDescription('Créer une nouvelle partie de draft'),
    async execute(interaction: ChatInputCommandInteraction) {
      const success = draftManager.createDraft(interaction.user.id, interaction.channelId);
      
      if (!success) {
        await interaction.reply({
          content: '❌ Une draft est déjà active. Utilisez `/end-draft` pour terminer la partie actuelle.',
          ephemeral: true
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('🏆 Nouvelle Draft Créée!')
        .setDescription(`**Host:** ${interaction.user.username}\n\n**Prochaines étapes:**\n1️⃣ Les capitaines rejoignent avec \`/join-captain\`\n2️⃣ Ajoutez des joueurs avec \`/add-player\`\n3️⃣ Lancez la draft avec \`/start-draft\``)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }
  },

  {
    data: new SlashCommandBuilder()
      .setName('join-captain')
      .setDescription('Rejoindre la partie en tant que capitaine'),
    async execute(interaction: ChatInputCommandInteraction) {
      const success = draftManager.addCaptain(interaction.user.id, interaction.user.username);
      
      if (!success) {
        await interaction.reply({
          content: '❌ Impossible de rejoindre. Soit aucune draft n\'est active, soit vous êtes déjà capitaine.',
          ephemeral: true
        });
        return;
      }

      const draft = draftManager.getCurrentDraft();
      const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setTitle('⚽ Capitaine Ajouté!')
        .setDescription(`**${interaction.user.username}** a rejoint en tant que capitaine!\n\n**Capitaines actuels:** ${draft?.captains.length}`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }
  },

  {
    data: new SlashCommandBuilder()
      .setName('add-player')
      .setDescription('Ajouter un joueur à la liste de draft')
      .addStringOption((option: SlashCommandStringOption) =>
        option.setName('nom')
          .setDescription('Le nom du joueur à ajouter')
          .setRequired(true)
      ),
    async execute(interaction: ChatInputCommandInteraction) {
      const playerName = interaction.options.getString('nom', true);
      const success = draftManager.addPlayer(playerName);
      
      if (!success) {
        await interaction.reply({
          content: '❌ Impossible d\'ajouter le joueur. Vérifiez qu\'une draft est active et qu\'aucune enchère n\'est en cours.',
          ephemeral: true
        });
        return;
      }

      const draft = draftManager.getCurrentDraft();
      const embed = new EmbedBuilder()
        .setColor(0xFFFF00)
        .setTitle('👤 Joueur Ajouté!')
        .setDescription(`**${playerName}** a été ajouté à la liste!\n\n**Joueurs actuels:** ${draft?.playerPool.length}`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }
  },

  {
    data: new SlashCommandBuilder()
      .setName('start-draft')
      .setDescription('Commencer la draft avec les capitaines et joueurs actuels'),
    async execute(interaction: ChatInputCommandInteraction) {
      const result = draftManager.startDraft();
      
      if (!result.success) {
        await interaction.reply({
          content: `❌ ${result.message}`,
          ephemeral: true
        });
        return;
      }

      const draft = draftManager.getCurrentDraft();
      const currentPlayer = draftManager.currentPlayer;

      const embed = new EmbedBuilder()
        .setColor(0xFF6600)
        .setTitle('🚀 Draft Commencée!')
        .setDescription(`**Budget par capitaine:** ${(draft?.captains[0]?.budget || 0).toLocaleString()}€\n\n💰 **Joueur à drafter:** **${currentPlayer}**\n\n🎯 Capitaines, utilisez \`/bid <montant>\` ou \`/pass\``)
        .addFields(
          {
            name: '👑 Capitaines',
            value: draft?.captains.map(c => `• ${c.username}`).join('\n') || 'Aucun',
            inline: true
          },
          {
            name: '⚽ Joueurs totaux',
            value: draft?.playerPool.length.toString() || '0',
            inline: true
          }
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }
  },

  {
    data: new SlashCommandBuilder()
      .setName('bid')
      .setDescription('Faire une enchère sur le joueur actuel')
      .addIntegerOption((option: SlashCommandIntegerOption) =>
        option.setName('montant')
          .setDescription('Le montant de votre enchère en euros')
          .setRequired(true)
          .setMinValue(0)
      ),
    async execute(interaction: ChatInputCommandInteraction) {
      const amount = interaction.options.getInteger('montant', true);
      const result = draftManager.placeBid(interaction.user.id, amount);
      
      if (!result.success) {
        await interaction.reply({
          content: `❌ ${result.message}`,
          ephemeral: true
        });
        return;
      }

      const currentPlayer = draftManager.currentPlayer;
      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('💰 Enchère Placée!')
        .setDescription(`**${interaction.user.username}** mise **${amount.toLocaleString()}€** sur **${currentPlayer}**`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      // Vérifier si tous les capitaines ont répondu
      if (draftManager.checkBiddingComplete()) {
        await handleBiddingComplete(interaction);
      }
    }
  },

  {
    data: new SlashCommandBuilder()
      .setName('pass')
      .setDescription('Passer votre tour pour l\'enchère actuelle'),
    async execute(interaction: ChatInputCommandInteraction) {
      const result = draftManager.passBid(interaction.user.id);
      
      if (!result.success) {
        await interaction.reply({
          content: `❌ ${result.message}`,
          ephemeral: true
        });
        return;
      }

      const currentPlayer = draftManager.currentPlayer;
      const embed = new EmbedBuilder()
        .setColor(0x808080)
        .setTitle('🚫 Pass')
        .setDescription(`**${interaction.user.username}** passe pour **${currentPlayer}**`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });

      // Vérifier si tous les capitaines ont répondu
      if (draftManager.checkBiddingComplete()) {
        await handleBiddingComplete(interaction);
      }
    }
  },

  {
    data: new SlashCommandBuilder()
      .setName('teams')
      .setDescription('Afficher les équipes actuelles'),
    async execute(interaction: ChatInputCommandInteraction) {
      const draft = draftManager.getCurrentDraft();
      
      if (!draft) {
        await interaction.reply({
          content: '❌ Aucune draft active.',
          ephemeral: true
        });
        return;
      }

      const embed = new EmbedBuilder()
        .setColor(0x9932CC)
        .setTitle('🏆 Équipes Actuelles')
        .setTimestamp();

      draft.captains.forEach(captain => {
        const playersList = captain.players.length > 0 
          ? captain.players.map(p => `• ${p}`).join('\n')
          : 'Aucun joueur';
        
        embed.addFields({
          name: `👑 ${captain.username} (Budget: ${captain.budget.toLocaleString()}€)`,
          value: playersList,
          inline: true
        });
      });

      await interaction.reply({ embeds: [embed] });
    }
  },

  {
    data: new SlashCommandBuilder()
      .setName('status')
      .setDescription('Afficher le statut de la draft'),
    async execute(interaction: ChatInputCommandInteraction) {
      const draft = draftManager.getCurrentDraft();
      
      if (!draft) {
        await interaction.reply({
          content: '❌ Aucune draft active.',
          ephemeral: true
        });
        return;
      }

      const remainingPlayers = draft.playerPool.filter(
        player => !draft.draftedPlayers.has(player) && 
                  !draft.captains.some(captain => captain.players.includes(player))
      );

      const embed = new EmbedBuilder()
        .setColor(0x00FFFF)
        .setTitle('📊 Statut de la Draft')
        .addFields(
          {
            name: '🎯 Joueur actuel',
            value: draft.currentPlayer || 'Aucun',
            inline: true
          },
          {
            name: '⚽ Joueurs restants',
            value: remainingPlayers.length.toString(),
            inline: true
          },
          {
            name: '👑 Capitaines',
            value: draft.captains.length.toString(),
            inline: true
          }
        )
        .setTimestamp();

      if (remainingPlayers.length > 0) {
        embed.addFields({
          name: '📝 Joueurs non draftés',
          value: remainingPlayers.slice(0, 10).join(', ') + (remainingPlayers.length > 10 ? '...' : ''),
          inline: false
        });
      }

      await interaction.reply({ embeds: [embed] });
    }
  },

  {
    data: new SlashCommandBuilder()
      .setName('end-draft')
      .setDescription('Terminer la draft actuelle (réservé au host)'),
    async execute(interaction: ChatInputCommandInteraction) {
      const draft = draftManager.getCurrentDraft();
      
      if (!draft) {
        await interaction.reply({
          content: '❌ Aucune draft active.',
          ephemeral: true
        });
        return;
      }

      if (draft.hostId !== interaction.user.id) {
        await interaction.reply({
          content: '❌ Seul le host peut terminer la draft.',
          ephemeral: true
        });
        return;
      }

      draftManager.endDraft();

      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('🔚 Draft Terminée')
        .setDescription(`La draft a été terminée par **${interaction.user.username}**.`)
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    }
  }
];

async function handleBiddingComplete(interaction: ChatInputCommandInteraction) {
  const bidResult = draftManager.resolveBidding();
  
  let resultEmbed: EmbedBuilder;
  
  if (bidResult.winner) {
    resultEmbed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('🎉 Joueur Draftée!')
      .setDescription(`**${bidResult.winner.username}** remporte **${draftManager.currentPlayer}** pour **${bidResult.winningBid.toLocaleString()}€**`)
      .setTimestamp();

    if (bidResult.tiedCaptains.length > 1) {
      resultEmbed.addFields({
        name: '🎲 Égalité résolue par tirage au sort',
        value: `Capitaines à égalité: ${bidResult.tiedCaptains.map(c => c.username).join(', ')}`,
        inline: false
      });
    }
  } else {
    resultEmbed = new EmbedBuilder()
      .setColor(0xFFFF00)
      .setTitle('😴 Aucune Enchère')
      .setDescription(`Personne n'a misé sur **${draftManager.currentPlayer}**. Ce joueur sera remis dans le pool et pourra être tiré au sort à nouveau plus tard.`)
      .setTimestamp();
  }

  await interaction.followUp({ embeds: [resultEmbed] });

  // Passer au joueur suivant
  const nextPlayer = draftManager.drawNextPlayer();
  
  if (nextPlayer) {
    const nextEmbed = new EmbedBuilder()
      .setColor(0xFF6600)
      .setTitle('🎯 Prochain Joueur')
      .setDescription(`💰 **Joueur à drafter:** **${nextPlayer}**\n\n🎯 Capitaines, utilisez \`/bid <montant>\` ou \`/pass\``)
      .setTimestamp();

    await interaction.followUp({ embeds: [nextEmbed] });
  } else {
    // Draft terminée
    const finalEmbed = new EmbedBuilder()
      .setColor(0x9932CC)
      .setTitle('🏁 Draft Terminée!')
      .setDescription('Tous les joueurs ont été attribués. Utilisez `/teams` pour voir les équipes finales.')
      .setTimestamp();

    await interaction.followUp({ embeds: [finalEmbed] });
  }
} 