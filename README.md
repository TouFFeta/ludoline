# Serveur de rooms LUDO — étape 1

Ce dossier est un projet Node séparé du site (le site continue de
vivre à la racine et de fonctionner sans ce serveur : c'est le
mode LOCAL). Ce serveur, lui, ne sert qu'aux futurs modes en ligne.

## Ce qu'il fait à cette étape

- un joueur crée une room → il reçoit un identifiant (`LUDO-A7K29`) ;
- un autre joueur rejoint cette room avec cet identifiant → les deux
  sont reconnus, avec une couleur chacun ;
- si la connexion d'un joueur tombe, il garde sa place et peut la
  reprendre en revenant avec le même identifiant de navigateur.

Il n'y a **encore aucune règle de Ludo** ici : pas de dé, pas de
pion, pas de victoire. C'est l'étape d'après.

## Installer et lancer en local

```bash
cd server
npm install
npm start
```

Le serveur écoute sur `http://localhost:3001`. Ouvrir cette adresse
dans un navigateur doit afficher un petit JSON `{"service":"ludo-server", ...}` :
c'est le contrôle de santé, pas une page de jeu.

## Tester la logique de room (sans réseau)

```bash
npm test
```

Ceci exécute `roomManager.test.js`, qui vérifie toute la logique de
room (création, jonction, couleurs, room pleine, reconnexion...)
sans lancer aucun serveur. C'est la partie la plus importante à
garder verte à chaque modification.

## Tester la vraie connexion à deux (bout en bout)

1. `npm start` dans ce dossier.
2. Ouvrir `../online-test.html` dans un premier onglet, cliquer sur
   **Créer une room**. Un identifiant du type `LUDO-A7K29` apparaît.
3. Ouvrir la même page dans un second onglet (ou un navigateur
   privé), coller cet identifiant, cliquer sur **Rejoindre**.
4. Les deux onglets doivent afficher la même liste de 2 joueurs,
   avec une couleur différente chacun.

## Déployer ce serveur (pour de vrai, accessible depuis Internet)

Recommandation : **Render** (render.com), en plan **Starter** dès
la mise en ligne réelle (7 $/mois). Le détail et les alternatives
sont expliqués dans la réponse qui accompagne ce code — en résumé :
Render prend Node directement depuis un dépôt Git, gère les
WebSockets nécessaires à Socket.io nativement, et son offre
gratuite permet de tester avant de payer quoi que ce soit.

Étapes :
1. Pousser ce dossier `server/` dans un dépôt Git (le même dépôt
   que le site, ou un dépôt séparé : les deux fonctionnent).
2. Sur Render : **New → Web Service**, brancher le dépôt, indiquer
   `server` comme dossier racine du service.
3. Build command : `npm install` — Start command : `npm start`.
4. Une fois déployé, Render donne une adresse du type
   `https://ludo-server.onrender.com`. C'est cette adresse que le
   site (GitHub Pages) appellera plus tard pour se connecter.

## Pourquoi ces choix

Voir l'explication complète dans le message principal. En bref :
Socket.io (plutôt que WebSocket brut) parce qu'il gère déjà les
rooms, la reconnexion automatique et les navigateurs plus anciens ;
Render (plutôt que Fly.io ou un serveur classique) parce qu'il ne
demande aucune carte de crédit pour commencer et déploie du Node
directement depuis Git, sans configuration serveur à gérer soi-même.
