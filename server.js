"use strict";

/* ============================================================
   LUDO — SERVEUR (couche réseau)
   ------------------------------------------------------------
   Ce fichier ne connaît AUCUNE règle de Ludo. Il fait seulement
   le lien entre les connexions Socket.io et roomManager.js :

       message reçu du client  →  appel à roomManager  →  diffusion
       du résultat aux joueurs concernés.

   La logique de room elle-même (créer, rejoindre, couleurs,
   reconnexion) vit entièrement dans roomManager.js, testée à
   part, sans aucun réseau. Ce fichier-ci n'ajoute presque rien :
   c'est voulu, c'est ce qui le rend facile à relire et à faire
   évoluer plus tard (validation des coups, dé, victoire...).
   ============================================================ */

const http = require("http");
const express = require("express");
const { Server } = require("socket.io");
const { creerGestionnaireDeRooms } = require("./roomManager");

const PORT = process.env.PORT || 3001;

const app = express();
const httpServer = http.createServer(app);

/* CORS ouvert pour l'instant : le site (GitHub Pages) et le
   serveur (Render) sont sur deux domaines différents. On resserrera
   cette liste quand l'adresse définitive du site sera connue. */
const io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] }
});

const gestionnaireRooms = creerGestionnaireDeRooms();

/* Simple contrôle de santé : pratique pour vérifier que le
   service tourne, et pour éviter qu'il ne s'endorme sur les
   hébergeurs qui mettent en veille les services inactifs. */
app.get("/", (req, res) => {
    res.json({ service: "ludo-server", status: "ok", rooms: gestionnaireRooms.toutesLesRooms().length });
});

/* Représentation d'une room envoyée aux clients : jamais l'objet
   interne tel quel (on ne veut pas fuiter de détails internes,
   et ça isole le contrat réseau de la structure de roomManager). */
function versVueClient(room) {
    return {
        roomId: room.roomId,
        status: room.status,
        players: room.players.map(p => ({
            color: p.color,
            name: p.name,
            connected: p.connected
        })),
        createdAt: room.createdAt
    };
}

io.on("connection", (socket) => {

    /* ROOM_CREATE : le client demande une nouvelle room.
       payload : { clientId, name } */
    socket.on("ROOM_CREATE", (payload, callback) => {
        const clientId = payload && payload.clientId;
        const name = payload && payload.name;
        if (!clientId) return callback({ ok: false, error: "CLIENT_ID_REQUIRED" });

        const resultat = gestionnaireRooms.createRoom(clientId, name);
        gestionnaireRooms.attacherSocket(resultat.room.roomId, clientId, socket.id);

        socket.join(resultat.room.roomId);
        socket.data.roomId   = resultat.room.roomId;
        socket.data.clientId = clientId;

        const vue = versVueClient(resultat.room);
        callback({ ok: true, room: vue, you: resultat.player });
        io.to(resultat.room.roomId).emit("ROOM_CREATED", vue);
    });

    /* ROOM_JOIN : le client rejoint une room existante, ou s'y
       reconnecte s'il y était déjà (même clientId).
       payload : { roomId, clientId, name } */
    socket.on("ROOM_JOIN", (payload, callback) => {
        const { roomId, clientId, name } = payload || {};
        if (!roomId || !clientId) return callback({ ok: false, error: "MISSING_FIELDS" });

        const resultat = gestionnaireRooms.joinRoom(roomId, clientId, name);
        if (!resultat.ok) return callback(resultat);

        gestionnaireRooms.attacherSocket(roomId, clientId, socket.id);
        socket.join(roomId);
        socket.data.roomId   = roomId;
        socket.data.clientId = clientId;

        const vue = versVueClient(resultat.room);
        callback({ ok: true, room: vue, you: resultat.player, reconnected: resultat.reconnected });

        /* Tout le monde dans la room reçoit la liste à jour. */
        if (resultat.reconnected) {
            io.to(roomId).emit("RECONNECTED", vue);
        } else {
            io.to(roomId).emit("PLAYER_JOINED", vue);
        }
    });

    /* ROOM_LEAVE : départ volontaire (bouton "quitter la partie"). */
    socket.on("ROOM_LEAVE", (payload, callback) => {
        const { roomId, clientId } = payload || {};
        const resultat = gestionnaireRooms.leaveRoom(roomId, clientId);
        socket.leave(roomId);
        if (callback) callback(resultat.ok ? { ok: true } : resultat);
        if (resultat.ok) io.to(roomId).emit("PLAYER_LEFT", versVueClient(resultat.room));
    });

    /* Coupure réseau (onglet fermé, wifi coupé...) : on ne supprime
       pas le joueur, on le marque seulement absent. Il pourra
       reprendre sa place avec ROOM_JOIN + le même clientId. */
    socket.on("disconnect", () => {
        const { roomId, clientId } = socket.data || {};
        if (!roomId || !clientId) return;

        const resultat = gestionnaireRooms.markDisconnected(roomId, clientId);
        if (resultat.ok) io.to(roomId).emit("PLAYER_LEFT", versVueClient(resultat.room));
    });
});

httpServer.listen(PORT, () => {
    console.log("LUDO — serveur de rooms démarré sur le port " + PORT);
});

/* ------------------------------------------------------------
   Emplacement réservé pour la suite (pas codé à cette étape) :

   - GAME_STARTED   : le serveur crée le vrai gameState de la
                       partie une fois que status passe à "playing".
   - DICE_ROLLED     : le serveur tire le dé lui-même (jamais le
                       client) et diffuse le résultat.
   - MOVE_REQUESTED / MOVE_ACCEPTED :
                       le client propose un coup, le serveur le
                       valide avec les mêmes fonctions que le
                       moteur local (isLegalMove, resoudreCapture...)
                       avant de l'accepter et de le diffuser.
   - TOKEN_MOVED, CAPTURE, TURN_CHANGED, PLAYER_FINISHED,
     GAME_FINISHED : diffusés par le serveur après validation.

   Le moteur de règles utilisé ici sera une copie (puis, plus
   tard, un seul module partagé) des fonctions déjà présentes et
   déjà testées dans script.js : isLegalMove, getLegalMoves,
   resoudreCapture, pathIsBlocked, verifierVictoire. Elles ne
   touchent jamais le DOM, donc elles fonctionnent telles quelles
   dans Node.
   ------------------------------------------------------------ */
