"use strict";

const assert = require("assert");
const { creerGestionnaireDeRooms, COLOR_ORDER } = require("./roomManager");

function testCase(nom, fn) {
    try {
        fn();
        console.log("  ✓ " + nom);
    } catch (e) {
        console.log("  ✗ " + nom + " -> " + e.message);
        process.exitCode = 1;
    }
}

console.log("ROOM MANAGER — tests");

testCase("createRoom crée une room avec un identifiant LUDO-XXXXX", () => {
    const gm = creerGestionnaireDeRooms();
    const r = gm.createRoom("client-1", "Alice");
    assert.strictEqual(r.ok, true);
    assert.match(r.room.roomId, /^LUDO-[A-Z0-9]{5}$/);
    assert.strictEqual(r.room.status, "waiting");
    assert.strictEqual(r.room.players.length, 1);
    assert.strictEqual(r.player.color, "red");
    assert.strictEqual(r.player.name, "Alice");
});

testCase("deux rooms créées à la suite ont des identifiants différents", () => {
    const gm = creerGestionnaireDeRooms();
    const a = gm.createRoom("c1", "A").room.roomId;
    const b = gm.createRoom("c2", "B").room.roomId;
    assert.notStrictEqual(a, b);
});

testCase("joinRoom attribue la couleur suivante disponible", () => {
    const gm = creerGestionnaireDeRooms();
    const room = gm.createRoom("host", "Hôte").room;
    const r2 = gm.joinRoom(room.roomId, "c2", "Bob");
    assert.strictEqual(r2.ok, true);
    assert.strictEqual(r2.player.color, "green");
});

testCase("les 4 couleurs se remplissent dans l'ordre red/green/blue/yellow", () => {
    const gm = creerGestionnaireDeRooms();
    const room = gm.createRoom("h", "H").room;
    const couleurs = [room.players[0].color];
    ["p2", "p3", "p4"].forEach((id, i) => {
        couleurs.push(gm.joinRoom(room.roomId, id, "J" + i).player.color);
    });
    assert.deepStrictEqual(couleurs, COLOR_ORDER);
});

testCase("un 5e joueur ne peut pas rejoindre une room pleine", () => {
    const gm = creerGestionnaireDeRooms();
    const room = gm.createRoom("h", "H").room;
    ["p2", "p3", "p4"].forEach(id => gm.joinRoom(room.roomId, id, id));
    const r5 = gm.joinRoom(room.roomId, "p5", "Trop");
    assert.strictEqual(r5.ok, false);
    assert.strictEqual(r5.error, gm.ERRORS.ROOM_FULL);
});

testCase("rejoindre une room inexistante échoue proprement", () => {
    const gm = creerGestionnaireDeRooms();
    const r = gm.joinRoom("LUDO-ZZZZZ", "c", "X");
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, gm.ERRORS.ROOM_NOT_FOUND);
});

testCase("une room en cours de partie n'accepte plus de nouveaux joueurs", () => {
    const gm = creerGestionnaireDeRooms();
    const room = gm.createRoom("h", "H").room;
    room.status = "playing";
    const r = gm.joinRoom(room.roomId, "nouveau", "N");
    assert.strictEqual(r.ok, false);
    assert.strictEqual(r.error, gm.ERRORS.ROOM_NOT_JOINABLE);
});

testCase("rejoindre deux fois avec le même clientId ne duplique pas le joueur", () => {
    const gm = creerGestionnaireDeRooms();
    const room = gm.createRoom("h", "H").room;
    gm.joinRoom(room.roomId, "bob", "Bob");
    const r = gm.joinRoom(room.roomId, "bob", "Bob");
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.reconnected, true);
    assert.strictEqual(room.players.length, 2);
});

testCase("markDisconnected garde le joueur dans la room (pas de suppression)", () => {
    const gm = creerGestionnaireDeRooms();
    const room = gm.createRoom("h", "H").room;
    gm.joinRoom(room.roomId, "bob", "Bob");
    gm.markDisconnected(room.roomId, "bob");
    assert.strictEqual(room.players.length, 2);
    assert.strictEqual(room.players.find(p => p.clientId === "bob").connected, false);
});

testCase("un joueur déconnecté libère sa couleur pour un nouveau venu", () => {
    const gm = creerGestionnaireDeRooms();
    const room = gm.createRoom("h", "H").room;   /* rouge */
    gm.joinRoom(room.roomId, "bob", "Bob");       /* vert  */
    gm.markDisconnected(room.roomId, "bob");
    const r = gm.joinRoom(room.roomId, "carla", "Carla");
    assert.strictEqual(r.player.color, "green");
});

testCase("reconnectPlayer restaure la connexion avec un nouveau socketId", () => {
    const gm = creerGestionnaireDeRooms();
    const room = gm.createRoom("h", "H").room;
    gm.joinRoom(room.roomId, "bob", "Bob");
    gm.markDisconnected(room.roomId, "bob");
    const r = gm.reconnectPlayer(room.roomId, "bob", "socket-42");
    assert.strictEqual(r.ok, true);
    assert.strictEqual(r.player.connected, true);
    assert.strictEqual(r.player.socketId, "socket-42");
});

testCase("leaveRoom retire réellement le joueur, et vide la room si elle est vide", () => {
    const gm = creerGestionnaireDeRooms();
    const room = gm.createRoom("h", "H").room;
    gm.leaveRoom(room.roomId, "h");
    assert.strictEqual(gm.getRoom(room.roomId), null);
});

testCase("deux gestionnaires distincts ne partagent pas leurs rooms", () => {
    const gmA = creerGestionnaireDeRooms();
    const gmB = creerGestionnaireDeRooms();
    const room = gmA.createRoom("h", "H").room;
    assert.strictEqual(gmB.getRoom(room.roomId), null);
});

testCase("1000 créations de room ne produisent aucun doublon d'identifiant", () => {
    const gm = creerGestionnaireDeRooms();
    const ids = new Set();
    for (let i = 0; i < 1000; i++) {
        ids.add(gm.createRoom("c" + i, "J" + i).room.roomId);
    }
    assert.strictEqual(ids.size, 1000);
});

console.log(process.exitCode ? "\n✗ DES TESTS ONT ÉCHOUÉ" : "\n✓ TOUS LES TESTS PASSENT");
