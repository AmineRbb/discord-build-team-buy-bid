import { Client, GatewayIntentBits, Events, Collection } from 'discord.js';
import { config } from 'dotenv';
import { commands } from './commands';

// Charger les variables d'environnement
config();

// Créer le client Discord avec les intents nécessaires
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Collection pour stocker les commandes
const clientCommands = new Collection<string, any>();

// Charger les commandes dans la collection
commands.forEach(command => {
  clientCommands.set(command.data.name, command);
});

// Événement Ready - Le bot est prêt
client.once(Events.ClientReady, (readyClient) => {
  console.log(`🚀 Bot connecté en tant que ${readyClient.user.tag}!`);
  console.log(`📊 Serveurs connectés: ${readyClient.guilds.cache.size}`);
  console.log(`👤 Utilisateurs accessibles: ${readyClient.users.cache.size}`);
  console.log('✅ Le bot est prêt à recevoir des commandes slash!');
});

// Événement InteractionCreate - Gestion des interactions (slash commands)
client.on(Events.InteractionCreate, async (interaction) => {
  // Vérifier que c'est une commande slash
  if (!interaction.isChatInputCommand()) return;

  const command = clientCommands.get(interaction.commandName);

  if (!command) {
    console.error(`❌ Commande inconnue: ${interaction.commandName}`);
    return;
  }

  try {
    console.log(`📝 Commande exécutée: /${interaction.commandName} par ${interaction.user.username}`);
    await command.execute(interaction);
  } catch (error) {
    console.error(`❌ Erreur lors de l'exécution de /${interaction.commandName}:`, error);
    
    const errorMessage = {
      content: '❌ Une erreur est survenue lors de l\'exécution de cette commande.',
      ephemeral: true
    };

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(errorMessage);
    } else {
      await interaction.reply(errorMessage);
    }
  }
});

// Gestion des erreurs
client.on(Events.Error, (error) => {
  console.error('❌ Erreur Discord.js:', error);
});

client.on(Events.Warn, (warning) => {
  console.warn('⚠️ Avertissement Discord.js:', warning);
});

// Gestion de l'arrêt propre du bot
process.on('SIGINT', () => {
  console.log('\n🔄 Arrêt du bot en cours...');
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🔄 Arrêt du bot en cours...');
  client.destroy();
  process.exit(0);
});

// Se connecter à Discord
const token = process.env.DISCORD_TOKEN;

if (!token) {
  console.error('❌ ERREUR: Token Discord manquant! Vérifiez votre fichier .env');
  process.exit(1);
}

client.login(token).catch(error => {
  console.error('❌ Erreur de connexion à Discord:', error);
  process.exit(1);
});

// Exporter le client pour d'éventuels tests
export { client }; 