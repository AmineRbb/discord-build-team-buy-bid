# 🏆 Bot Discord - Draft Football avec Enchères

Un bot Discord en TypeScript utilisant `discord.js` v14 pour organiser des drafts de tournoi de football avec un système d'enchères entre capitaines.

## 📋 Fonctionnalités

- **Draft par enchères** : Les capitaines misent sur les joueurs tirés au sort
- **Budget automatique** : Calculé selon le nombre de joueurs/capitaines (20M€ par joueur)
- **Attribution équitable** : Les joueurs non draftés sont distribués équitablement à la fin
- **Interface moderne** : Commandes slash avec embeds Discord stylisés
- **Gestion complète** : Création, suivi et affichage des équipes en temps réel

## 🚀 Installation et Configuration

### 1. Prérequis

- **Node.js** 18.0.0 ou plus récent
- **npm** ou **yarn**
- Un **serveur Discord** pour les tests
- Une **application Discord** (voir section suivante)

### 2. Créer l'Application Discord

1. Allez sur https://discord.com/developers/applications
2. Cliquez sur **"New Application"**
3. Donnez un nom à votre bot (ex: "Football Draft Bot")
4. Dans l'onglet **"Bot"** :
   - Cliquez sur **"Add Bot"**
   - Copiez le **Token** (gardez-le secret !)
   - Activez les **"Message Content Intent"** si nécessaire
5. Dans l'onglet **"General Information"** :
   - Copiez l'**Application ID** (Client ID)
6. Dans l'onglet **"OAuth2" > "URL Generator"** :
   - **Scopes** : `bot`, `applications.commands`
   - **Bot Permissions** : `Send Messages`, `Use Slash Commands`, `Read Message History`
   - Copiez l'URL générée pour inviter le bot

### 3. Installation du Projet

```bash
# Cloner le projet (ou télécharger)
cd bot-discord-five-a-20

# Installer les dépendances
npm install

# Créer le fichier de configuration
cp env.example .env
```

### 4. Configuration

Éditez le fichier `.env` avec vos informations :

```env
# Token du bot Discord
DISCORD_TOKEN=votre_token_ici

# ID de l'application Discord
CLIENT_ID=votre_client_id_ici

# ID du serveur Discord pour les tests (optionnel)
# Si défini : commandes déployées instantanément sur ce serveur
# Si vide : commandes déployées globalement (peut prendre 1 heure)
GUILD_ID=votre_guild_id_ici
```

**Comment trouver le GUILD_ID ?**
1. Activez le mode développeur dans Discord (Paramètres > Avancé > Mode développeur)
2. Clic droit sur votre serveur → "Copier l'ID"

## 🎮 Démarrage et Test

### 1. Déployer les Commandes Slash

```bash
# Déployer les commandes sur Discord
npm run deploy-commands
```

### 2. Lancer le Bot

```bash
# Mode développement (avec rechargement automatique)
npm run dev

# Mode production
npm run build
npm start
```

### 3. Inviter le Bot sur votre Serveur

1. Utilisez l'URL générée lors de la configuration Discord
2. Sélectionnez votre serveur de test
3. Autorisez les permissions nécessaires

## 🎯 Guide d'Utilisation

### Commandes Disponibles

| Commande | Description | Qui peut l'utiliser |
|----------|-------------|-------------------|
| `/create` | Créer une nouvelle draft | Tout le monde |
| `/join-captain` | Rejoindre comme capitaine | Tout le monde |
| `/add-player <nom>` | Ajouter un joueur à drafter | Host ou Capitaine |
| `/start-draft` | Commencer la draft | Host ou Capitaine |
| `/bid <montant>` | Miser sur le joueur actuel | Capitaines (pendant enchère) |
| `/pass` | Passer son tour | Capitaines (pendant enchère) |
| `/teams` | Voir les équipes actuelles | Tout le monde |
| `/status` | Voir le statut de la draft | Tout le monde |
| `/end-draft` | Terminer la draft | Host uniquement |

### Exemple de Session de Draft

1. **Création** :
   ```
   /create
   ```
   → Le bot crée une nouvelle draft

2. **Rejoindre** :
   ```
   /join-captain
   ```
   → Les joueurs rejoignent comme capitaines (minimum 2)

3. **Ajouter des joueurs** :
   ```
   /add-player nom:Messi
   /add-player nom:Ronaldo
   /add-player nom:Neymar
   /add-player nom:Mbappé
   ```
   → Ajouter tous les joueurs à drafter

4. **Commencer** :
   ```
   /start-draft
   ```
   → Le bot calcule les budgets et tire le premier joueur au sort

5. **Enchérir** :
   ```
   /bid montant:5000000    (5M€)
   /pass
   ```
   → Chaque capitaine mise ou passe, puis le bot attribue le joueur

6. **Répéter** jusqu'à ce que tous les joueurs soient draftés

7. **Voir les équipes** :
   ```
   /teams
   ```
   → Affichage final des équipes constituées

## ⚙️ Règles du Système

### Budget et Calculs
- **Valeur par joueur** : 20M€
- **Budget par capitaine** : `(Nombre de joueurs ÷ Nombre de capitaines) × 20M€`
- **Exemple** : 10 joueurs, 2 capitaines → 5 × 20M = 100M€ par capitaine

### Enchères
- Les capitaines misent à tour de rôle sur chaque joueur tiré au sort
- Le plus offrant remporte le joueur
- En cas d'égalité : tirage au sort entre les ex æquo
- Si personne ne mise : le joueur sera attribué aléatoirement à la fin

### Attribution Finale
- Les joueurs non draftés sont mélangés
- Distribution équitable entre toutes les équipes
- Chaque équipe aura le même nombre de joueurs

## 🛠️ Structure du Projet

```
bot-discord-five-a-20/
├── src/
│   ├── types/
│   │   └── index.ts          # Interfaces TypeScript
│   ├── services/
│   │   └── DraftManager.ts   # Logique de la draft
│   ├── commands/
│   │   └── index.ts          # Commandes slash
│   ├── deploy-commands.ts    # Script de déploiement
│   └── index.ts              # Point d'entrée du bot
├── package.json              # Dépendances et scripts
├── tsconfig.json             # Configuration TypeScript
├── env.example               # Exemple de configuration
└── README.md                 # Ce fichier
```

## 🔧 Scripts Disponibles

```bash
# Développement
npm run dev                   # Lancer en mode développement

# Production
npm run build                 # Compiler TypeScript
npm start                     # Lancer la version compilée

# Déploiement
npm run deploy-commands       # Déployer les commandes slash
```

## 🐛 Résolution de Problèmes

### Le bot ne répond pas aux commandes
1. Vérifiez que les commandes sont déployées : `npm run deploy-commands`
2. Attendez quelques minutes (surtout pour le déploiement global)
3. Vérifiez les permissions du bot sur le serveur

### Erreur "Token invalide"
1. Vérifiez le token dans le fichier `.env`
2. Régénérez le token depuis https://discord.com/developers/applications

### Commandes non visibles
1. Utilisez `GUILD_ID` pour un déploiement local instantané
2. Les commandes globales prennent jusqu'à 1 heure

### Erreur de permissions
1. Vérifiez que le bot a les permissions `Send Messages` et `Use Slash Commands`
2. Réinvitez le bot avec l'URL complète des permissions

## 📝 Développement

### Ajouter une Nouvelle Commande

1. Éditez `src/commands/index.ts`
2. Ajoutez votre commande dans le tableau `commands`
3. Redéployez avec `npm run deploy-commands`
4. Redémarrez le bot

### Modifier la Logique de Draft

La logique principale se trouve dans `src/services/DraftManager.ts`. Vous pouvez modifier :
- Le calcul des budgets
- Les règles d'attribution
- La gestion des égalités

## 📄 Licence

MIT License - Vous êtes libre d'utiliser, modifier et distribuer ce code.

## 💡 Support

En cas de problème :
1. Vérifiez cette documentation
2. Consultez les logs du bot dans la console
3. Vérifiez la configuration Discord

---

**Bon draft ! ⚽🏆** 