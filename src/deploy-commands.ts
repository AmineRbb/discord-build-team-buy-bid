import { REST, Routes } from 'discord.js';
import { config } from 'dotenv';
import { commands } from './commands';

// Charger les variables d'environnement
config();

const token = process.env.DISCORD_TOKEN;
const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;

if (!token) {
  console.error('❌ ERREUR: Token Discord manquant! Vérifiez votre fichier .env');
  process.exit(1);
}

if (!clientId) {
  console.error('❌ ERREUR: CLIENT_ID manquant! Vérifiez votre fichier .env');
  process.exit(1);
}

// TypeScript type assertions après vérification
const validClientId: string = clientId;
const validGuildId: string | undefined = guildId;

// Construire les données des commandes
const commandsData = commands.map(command => command.data.toJSON());

// Créer une instance REST et définir le token
const rest = new REST().setToken(token);

// Fonction pour déployer les commandes
async function deployCommands() {
  try {
    console.log(`🔄 Déploiement de ${commandsData.length} commandes slash...`);

    let data: any;

    if (validGuildId) {
      // Déploiement local (serveur spécifique) - plus rapide pour les tests
      console.log(`📍 Déploiement local sur le serveur ${validGuildId}`);
      data = await rest.put(
        Routes.applicationGuildCommands(validClientId, validGuildId),
        { body: commandsData },
      );
    } else {
      // Déploiement global - peut prendre jusqu'à 1 heure pour être visible
      console.log('🌍 Déploiement global sur tous les serveurs');
      data = await rest.put(
        Routes.applicationCommands(validClientId),
        { body: commandsData },
      );
    }

    console.log(`✅ ${data.length} commandes slash déployées avec succès!`);
    
    // Afficher la liste des commandes déployées
    console.log('\n📋 Commandes déployées:');
    commandsData.forEach((cmd: any) => {
      console.log(`  • /${cmd.name} - ${cmd.description}`);
    });

    if (!guildId) {
      console.log('\n⏰ Note: Les commandes globales peuvent prendre jusqu\'à 1 heure pour apparaître.');
      console.log('💡 Pour des tests rapides, ajoutez GUILD_ID dans votre .env');
    }

  } catch (error) {
    console.error('❌ Erreur lors du déploiement des commandes:', error);
    process.exit(1);
  }
}

// Exécuter le déploiement
deployCommands(); 