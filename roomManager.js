"use strict";

/* ============================================================
   LUDO — GESTIONNAIRE DE ROOMS (logique pure, sans réseau)
   ------------------------------------------------------------
   Ce fichier ne connaît ni Socket.io, ni HTTP, ni WebSocket.
   Il ne fait qu'une chose : tenir à jour la liste des rooms et
   des joueurs qu'elles contiennent, avec des règles simples.

   Le but de cette séparation :
   - on peut tester cette logique avec Node tout seul, sans
     serveur, sans réseau, sans navigateur ;
   - demain, si on change de bibliothèque réseau (Socket.io,
     ws, autre chose), ce fichier ne bouge pas.

   Une room :
   {
       roomId:    "LUDO-A7K29",
       status:    "waiting" | "playing" | "finished",
       players:   [ { clientId, socketId, color, name, connected } ],
       gameState: null,          // rempli à l'étape suivante
       createdAt: 1737400000000
   }
   ============================================================ */

/* Mêmes couleurs, dans le même ordre que côté client (PLAYER_ORDER
   dans script.js). Les garder alignées évite des surprises quand
   les deux seront reliés. */
const COLOR_ORDER = ["red", "green", "blue", "yellow"];

const MAX_PLAYERS_PER_ROOM = 4;

/* Identifiants de room lisibles à voix haute : on retire les
   caractères ambigus (0/O, 1/I) pour éviter les erreurs de
   recopie quand quelqu'un partage le lien de sa partie. */
const ROOM_ID_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_ID_LENGTH   = 5;

const ERRORS = {
    ROOM_NOT_FOUND:    "ROOM_NOT_FOUND",
    ROOM_FULL:         "ROOM_FULL",
    ROOM_NOT_JOINABLE: "ROOM_NOT_JOINABLE",
    PLAYER_NOT_FOUND:  "PLAYER_NOT_FOUND"
};

function genererIdentifiantRoom(dejaUtilise) {
    let id;
    do {
        let suffixe = "";
        for (let i = 0; i < ROOM_ID_LENGTH; i++) {
            suffixe += ROOM_ID_ALPHABET[Math.floor(Math.random() * ROOM_ID_ALPHABET.length)];
        }
        id = "LUDO-" + suffixe;
    } while (dejaUtilise(id));
    return id;
}

/* Première couleur du cycle qu'aucun joueur connecté n'occupe encore. */
function couleurDisponible(room) {
    const prises = new Set(room.players.filter(p => p.connected).map(p => p.color));
    return COLOR_ORDER.find(c => !prises.has(c)) || null;
}

/* Fabrique un gestionnaire de rooms indépendant.
   Une instance = un espace mémoire isolé : pratique pour les
   tests (chaque test a son propre store) et pour le serveur
   réel (un seul store partagé par tous les joueurs connectés). */
function creerGestionnaireDeRooms() {
    const rooms = new Map();

    function ok(room)          { return { ok: true, room: room }; }
    function fail(error)       { return { ok: false, error: error }; }

    function getRoom(roomId) {
        return rooms.get(roomId) || null;
    }

    function ajouterJoueur(room, clientId, name) {
        const couleur = couleurDisponible(room);
        const joueur = {
            clientId: clientId,
            socketId: null,       /* renseigné par la couche réseau au moment de la connexion */
            color:    couleur,
            name:     name || ("Joueur " + couleur),
            connected: true
        };
        room.players.push(joueur);
        return joueur;
    }

    /* Crée une room et y place directement son créateur. */
    function createRoom(hostClientId, hostName) {
        const roomId = genererIdentifiantRoom(id => rooms.has(id));
        const room = {
            roomId:    roomId,
            status:    "waiting",
            players:   [],
            gameState: null,
            createdAt: Date.now()
        };
        rooms.set(roomId, room);
        const joueur = ajouterJoueur(room, hostClientId, hostName);
        return { ok: true, room: room, player: joueur };
    }

    /* Un second joueur (ou plus) rejoint une room existante. */
    function joinRoom(roomId, clientId, name) {
        const room = getRoom(roomId);
        if (!room) return fail(ERRORS.ROOM_NOT_FOUND);

        /* Un joueur qui revient (même clientId) ne doit jamais être
           dupliqué : c'est une reconnexion, pas une nouvelle entrée. */
        const dejaPresent = room.players.find(p => p.clientId === clientId);
        if (dejaPresent) {
            dejaPresent.connected = true;
            return { ok: true, room: room, player: dejaPresent, reconnected: true };
        }

        if (room.status !== "waiting") return fail(ERRORS.ROOM_NOT_JOINABLE);

        const placesPrises = room.players.filter(p => p.connected).length;
        if (placesPrises >= MAX_PLAYERS_PER_ROOM) return fail(ERRORS.ROOM_FULL);

        const joueur = ajouterJoueur(room, clientId, name);
        return { ok: true, room: room, player: joueur, reconnected: false };
    }

    /* Départ volontaire : le joueur est réellement retiré de la room. */
    function leaveRoom(roomId, clientId) {
        const room = getRoom(roomId);
        if (!room) return fail(ERRORS.ROOM_NOT_FOUND);

        const index = room.players.findIndex(p => p.clientId === clientId);
        if (index === -1) return fail(ERRORS.PLAYER_NOT_FOUND);

        room.players.splice(index, 1);

        /* Room vide : elle n'a plus de raison d'exister. */
        if (room.players.length === 0) rooms.delete(roomId);

        return ok(room);
    }

    /* Coupure réseau : on ne supprime PAS le joueur. On le marque
       seulement absent, pour qu'il puisse reprendre sa place plus
       tard avec reconnectPlayer(). C'est ici que vivra la vraie
       logique de reconnexion, écrite à l'étape suivante. */
    function markDisconnected(roomId, clientId) {
        const room = getRoom(roomId);
        if (!room) return fail(ERRORS.ROOM_NOT_FOUND);

        const joueur = room.players.find(p => p.clientId === clientId);
        if (!joueur) return fail(ERRORS.PLAYER_NOT_FOUND);

        joueur.connected = false;
        joueur.socketId  = null;
        return { ok: true, room: room, player: joueur };
    }

    /* Reprise de connexion : même clientId, nouveau socketId. */
    function reconnectPlayer(roomId, clientId, newSocketId) {
        const room = getRoom(roomId);
        if (!room) return fail(ERRORS.ROOM_NOT_FOUND);

        const joueur = room.players.find(p => p.clientId === clientId);
        if (!joueur) return fail(ERRORS.PLAYER_NOT_FOUND);

        joueur.connected = true;
        joueur.socketId  = newSocketId;
        return { ok: true, room: room, player: joueur };
    }

    function attacherSocket(roomId, clientId, socketId) {
        const room = getRoom(roomId);
        if (!room) return fail(ERRORS.ROOM_NOT_FOUND);
        const joueur = room.players.find(p => p.clientId === clientId);
        if (!joueur) return fail(ERRORS.PLAYER_NOT_FOUND);
        joueur.socketId = socketId;
        return ok(room);
    }

    function toutesLesRooms() {
        return Array.from(rooms.values());
    }

    return {
        createRoom, joinRoom, leaveRoom,
        markDisconnected, reconnectPlayer, attacherSocket,
        getRoom, toutesLesRooms,
        ERRORS
    };
}

module.exports = { creerGestionnaireDeRooms, COLOR_ORDER, MAX_PLAYERS_PER_ROOM, ERRORS };
