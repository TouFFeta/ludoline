/* ============================================================
   LUDO — MOTEUR DE JEU LOCAL (4 joueurs sur le même appareil)

   ARCHITECTURE (ne jamais inverser cet ordre) :
   ÉTAT LOGIQUE → RÈGLES → VALIDATION → ANIMATION → AFFICHAGE

   Le moteur est la SEULE source de vérité.
   Aucune position n'est décidée par le CSS ou par une animation.
   ============================================================ */


/* ============================================================
   0. RÈGLES ACTIVÉES
   ============================================================ */

const RULES = {
    /* --- VÉRIFIÉES sur sources officielles Ludo King --- */
    SORTIE_UNIQUEMENT_AVEC_6:        true,
    TOUR_SUPPLEMENTAIRE_SUR_6:       true,
    TOUR_SUPPLEMENTAIRE_SUR_CAPTURE: true,
    BLOCAGE_AVEC_2_PIONS:            true,
    ARRIVEE_NOMBRE_EXACT:            true,

    /* Trois 6 d'affilée : le TOUR passe au joueur suivant.
       Cela ne fait JAMAIS perdre la partie, ne retire aucun pion
       et n'annule aucun coup déjà joué. Seul le 3e lancer est perdu.
       Mets false si tu veux autoriser les 6 à l'infini. */
    TROIS_6_TOUR_PERDU:              true,

    /* --- RÈGLES DE TON PROJET (choix assumés) --- */
    /* Les 4 cases de départ colorées sont protégées, comme les 4 étoiles.
       => 8 cases sûres au total. */
    CASES_DEPART_SONT_SURES:         true,
    /* Amener un pion à l'arrivée donne un tour supplémentaire. */
    TOUR_SUPPLEMENTAIRE_SUR_ARRIVEE: true,
    /* Un 6 sans aucun coup possible conserve le relancer. */
    GARDER_LA_MAIN_SI_6_SANS_COUP:   true
};


/* ============================================================
   1. ÉLÉMENTS DE L'INTERFACE
   ============================================================ */

const homeScreen       = document.getElementById("homeScreen");
const gameScreen       = document.getElementById("gameScreen");
const playNowButton    = document.getElementById("playNowButton");
const backHomeButton   = document.getElementById("backHomeButton");
const brandHome        = document.getElementById("brandHome");

const navHome          = document.getElementById("navHome");
const navPlay          = document.getElementById("navPlay");
const navRanking       = document.getElementById("navRanking");
const navEvents        = document.getElementById("navEvents");
const navShop          = document.getElementById("navShop");
const navProfile       = document.getElementById("navProfile");
const navNotifications = document.getElementById("navNotifications");

const modeButtons      = document.querySelectorAll(".mode-button");
const botLevelButtons  = document.querySelectorAll(".bot-level-button");

const ludoBoard        = document.getElementById("ludoBoard");
const diceButton       = document.getElementById("diceButton");
const diceButtonLabel  = diceButton ? diceButton.querySelector(".dice-button-label") : null;
const diceCube         = document.getElementById("diceCube");
const diceValueText    = document.getElementById("diceValueText");
const diceMessage      = document.getElementById("diceMessage");
const lastResultValue  = document.getElementById("lastResultValue");
const restartButton    = document.getElementById("restartButton");
const newGameButton    = document.getElementById("newGameButton");
const gameModeLabel    = document.getElementById("gameModeLabel");
const toast            = document.getElementById("toast");
const turnBonus        = document.getElementById("turnBonus");
const turnCard         = document.querySelector(".turn-card");

const turnColorIndicator = document.querySelector(".turn-color-indicator");
const playerAvatar       = document.querySelector(".player-avatar");
const playerInfoStrong   = document.querySelector(".player-info strong");
const playerInfoSmall    = document.querySelector(".player-info small");
const playerRows         = document.querySelectorAll(".players-card .player-row");

const historyList      = document.getElementById("historyList");
const historyCount     = document.getElementById("historyCount");

const soundButton      = document.getElementById("soundButton");
const settingsButton   = document.getElementById("settingsButton");
const helpButton       = document.getElementById("helpButton");

const winnerOverlay     = document.getElementById("winnerOverlay");
const winnerName        = document.getElementById("winnerName");
const winnerColorDot    = document.getElementById("winnerColorDot");
const playAgainButton   = document.getElementById("playAgainButton");
const backToHomeFromWin = document.getElementById("backToHomeFromWin");


/* ============================================================
   2. GÉOMÉTRIE DU PLATEAU (source de vérité unique)
   ------------------------------------------------------------
   Grille 15 × 15, coordonnées [ligne, colonne] de 0 à 14.
   ============================================================ */

const BOARD_SIZE = 15;

/* Durées d'animation (ms) */
const DICE_ANIMATION_MS = 850;   /* roulement du dé          */
const MOVE_STEP_MS      = 110;   /* glissement d'une case    */
const BASE_EXIT_MS      = 340;   /* sortie de base           */
const CAPTURE_RETURN_MS = 430;   /* retour du pion capturé   */
const ARRIVAL_MS        = 380;   /* petit saut à l'arrivée   */

/* Parcours commun : 52 cases, sens des aiguilles d'une montre.
   L'index 0 est la case de départ ROUGE. */
const RING = [
    [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],                 /* 0  → 4  */
    [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],         /* 5  → 10 */
    [0, 7],                                                 /* 11      */
    [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8],         /* 12 → 17 */
    [6, 9], [6, 10], [6, 11], [6, 12], [6, 13], [6, 14],    /* 18 → 23 */
    [7, 14],                                                /* 24      */
    [8, 14], [8, 13], [8, 12], [8, 11], [8, 10], [8, 9],    /* 25 → 30 */
    [9, 8], [10, 8], [11, 8], [12, 8], [13, 8], [14, 8],    /* 31 → 36 */
    [14, 7],                                                /* 37      */
    [14, 6], [13, 6], [12, 6], [11, 6], [10, 6], [9, 6],    /* 38 → 43 */
    [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],         /* 44 → 49 */
    [7, 0],                                                 /* 50      */
    [6, 0]                                                  /* 51      */
];

/* Les 4 cases étoilées. */
const STAR_RING_INDEXES = [8, 21, 34, 47];

/* Couloirs d'arrivée : 5 cases par couleur, de l'entrée vers le centre. */
const HOME_PATHS = {
    red:    [[7, 1],  [7, 2],  [7, 3],  [7, 4],  [7, 5]],
    green:  [[1, 7],  [2, 7],  [3, 7],  [4, 7],  [5, 7]],
    blue:   [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]],
    yellow: [[13, 7], [12, 7], [11, 7], [10, 7], [9, 7]]
};

/* Positions logiques d'un pion :
   -1       = dans sa base
   0 → 50   = parcours commun (51 cases parcourues)
   51 → 55  = couloir d'arrivée (5 cases)
   56       = ARRIVÉE (centre) */
const LAST_COMMON_POSITION = 50;
const FIRST_HOME_POSITION  = 51;
const FINISH_POSITION      = 56;

const PLAYER_ORDER = ["red", "green", "blue", "yellow"];

const PLAYERS = {
    red: {
        name: "Joueur rouge", shortName: "Rouge", letter: "R",
        offset: 0,  baseRow: 0, baseCol: 0, entryCell: [7, 0],  arrow: "right"
    },
    green: {
        name: "Joueur vert",  shortName: "Vert",  letter: "V",
        offset: 13, baseRow: 0, baseCol: 9, entryCell: [0, 7],  arrow: "down"
    },
    blue: {
        name: "Joueur bleu",  shortName: "Bleu",  letter: "B",
        offset: 26, baseRow: 9, baseCol: 9, entryCell: [7, 14], arrow: "left"
    },
    yellow: {
        name: "Joueur jaune", shortName: "Jaune", letter: "J",
        offset: 39, baseRow: 9, baseCol: 0, entryCell: [14, 7], arrow: "up"
    }
};

/* Index du parcours commun considérés comme cases sûres.
   4 étoiles + (optionnel) les 4 cases de départ colorées. */
const SAFE_RING_INDEXES = (function () {
    const set = new Set(STAR_RING_INDEXES);
    if (RULES.CASES_DEPART_SONT_SURES) {
        PLAYER_ORDER.forEach(color => set.add(PLAYERS[color].offset));
    }
    return set;
})();

const DICE_PIP_PATTERNS = {
    1: [5], 2: [1, 9], 3: [1, 5, 9],
    4: [1, 3, 7, 9], 5: [1, 3, 5, 7, 9], 6: [1, 3, 4, 6, 7, 9]
};


/* ============================================================
   3. ÉTAT LOGIQUE + IDENTITÉ DES PIONS
   ============================================================ */

let gameState = null;

const TOKEN_STATE = {
    BASE: "BASE",
    TRACK: "TRACK",
    HOME_PATH: "HOME_PATH",
    FINISHED: "FINISHED"
};

function stateFromPosition(position) {
    if (position === -1) return TOKEN_STATE.BASE;
    if (position === FINISH_POSITION) return TOKEN_STATE.FINISHED;
    if (position >= FIRST_HOME_POSITION) return TOKEN_STATE.HOME_PATH;
    return TOKEN_STATE.TRACK;
}

function createTokens() {
    const tokens = [];
    PLAYER_ORDER.forEach(color => {
        for (let i = 0; i < 4; i++) {
            tokens.push({
                id: color + "-" + i,
                color: color,
                player: color,
                tokenIndex: i,
                position: -1,
                state: TOKEN_STATE.BASE
            });
        }
    });
    return tokens;
}

function createInitialState() {
    return {
        currentPlayerIndex: 0,
        diceValue: null,
        diceRolled: false,
        legalMoves: [],
        winner: null,
        isRolling: false,
        isAnimatingMove: false,
        consecutiveSixes: 0,
        lastRollWasSix: false,
        history: [],
        tokens: createTokens()
    };
}

function currentPlayerColor() { return PLAYER_ORDER[gameState.currentPlayerIndex]; }

function tokensOf(color) { return gameState.tokens.filter(t => t.color === color); }

function getToken(color, tokenIndex) {
    return gameState.tokens.find(t => t.color === color && t.tokenIndex === tokenIndex);
}

/* Toute écriture de position passe par ici :
   position et state ne peuvent jamais être désynchronisés. */
function setTokenPosition(token, position) {
    token.position = position;
    token.state = stateFromPosition(position);
}


/* ============================================================
   4. COORDONNÉES
   ============================================================ */

function coordinateKey(row, col) { return row + "-" + col; }

function isCommonPosition(position) {
    return position >= 0 && position <= LAST_COMMON_POSITION;
}

function getRingIndex(color, position) {
    if (!isCommonPosition(position)) return null;
    return (PLAYERS[color].offset + position) % RING.length;
}

function getLogicalCoordinate(color, position) {
    if (isCommonPosition(position)) return RING[getRingIndex(color, position)];
    if (position >= FIRST_HOME_POSITION && position < FINISH_POSITION) {
        return HOME_PATHS[color][position - FIRST_HOME_POSITION];
    }
    if (position === FINISH_POSITION) return [7, 7];
    return null;
}

function isSafeRingIndex(ringIndex) { return SAFE_RING_INDEXES.has(ringIndex); }


/* ============================================================
   5. RÈGLES
   ============================================================ */

function getRingOccupants(ringIndex) {
    return gameState.tokens.filter(t =>
        isCommonPosition(t.position) && getRingIndex(t.color, t.position) === ringIndex
    );
}

/* Blocage : 2 pions ou plus de la MÊME couleur sur la même case. */
function getBlockAtRingIndex(ringIndex) {
    if (!RULES.BLOCAGE_AVEC_2_PIONS) return null;
    const counts = {};
    getRingOccupants(ringIndex).forEach(t => {
        counts[t.color] = (counts[t.color] || 0) + 1;
    });
    for (const color of PLAYER_ORDER) {
        if ((counts[color] || 0) >= 2) return { color: color, count: counts[color] };
    }
    return null;
}

function pathIsBlocked(color, fromPosition, toPosition) {
    if (!RULES.BLOCAGE_AVEC_2_PIONS) return false;
    const start = Math.max(fromPosition + 1, 0);
    const end   = Math.min(toPosition, LAST_COMMON_POSITION);
    for (let p = start; p <= end; p++) {
        const block = getBlockAtRingIndex(getRingIndex(color, p));
        if (block && block.color !== color) return true;
    }
    return false;
}

function getTargetPosition(position, diceValue) {
    if (position === -1) return diceValue === 6 ? 0 : null;
    if (position === FINISH_POSITION) return null;
    const target = position + diceValue;
    if (target > FINISH_POSITION) return null;   /* nombre exact obligatoire */
    return target;
}

function isLegalMove(color, tokenIndex, diceValue) {
    if (!Number.isInteger(diceValue)) return false;
    const token = getToken(color, tokenIndex);
    if (!token) return false;

    const target = getTargetPosition(token.position, diceValue);
    if (target === null) return false;

    /* Sortie de base : uniquement avec un 6. */
    if (token.position === -1) {
        if (diceValue !== 6) return false;
        const block = getBlockAtRingIndex(PLAYERS[color].offset);
        if (block && block.color !== color) return false;   /* départ bloqué */
        return true;
    }

    /* Blocage adverse sur le trajet ou sur la case d'arrivée. */
    if (pathIsBlocked(color, token.position, target)) return false;

    return true;
}

function getLegalMoves(color, diceValue) {
    const moves = [];
    tokensOf(color).forEach(token => {
        if (isLegalMove(color, token.tokenIndex, diceValue)) {
            moves.push({
                tokenIndex: token.tokenIndex,
                from: token.position,
                to: getTargetPosition(token.position, diceValue)
            });
        }
    });
    return moves;
}


/* ============================================================
   6. CASE PROTÉGÉE ET CAPTURE
   ------------------------------------------------------------
   Le moteur analyse TOUJOURS la case d'arrivée avant de décider
   d'une capture. Sur une case protégée : aucune capture, aucun
   retour en base, aucune animation de capture.
   ============================================================ */

/* Analyse logique de la case d'arrivée. Ne modifie rien. */
function analyserCaseArrivee(color, targetPosition) {
    if (!isCommonPosition(targetPosition)) {
        return { ringIndex: null, estProtegee: false, adversaires: [] };
    }
    const ringIndex = getRingIndex(color, targetPosition);
    return {
        ringIndex: ringIndex,
        estProtegee: isSafeRingIndex(ringIndex),
        adversaires: getRingOccupants(ringIndex).filter(t => t.color !== color)
    };
}

/* Exécute la capture UNIQUEMENT si la case n'est pas protégée.
   Renvoie { captures: [...], captureBloqueeParProtection: bool }. */
function resoudreCapture(color, targetPosition) {
    const analyse = analyserCaseArrivee(color, targetPosition);

    if (analyse.adversaires.length === 0) {
        return { captures: [], captureBloqueeParProtection: false, analyse: analyse };
    }

    /* RÈGLE CRITIQUE : case protégée → on ne capture pas. */
    if (analyse.estProtegee) {
        return { captures: [], captureBloqueeParProtection: true, analyse: analyse };
    }

    analyse.adversaires.forEach(victim => setTokenPosition(victim, -1));
    return { captures: analyse.adversaires, captureBloqueeParProtection: false, analyse: analyse };
}


/* ============================================================
   7. VICTOIRE
   ============================================================ */

function verifierVictoire(color) {
    return tokensOf(color).every(t => t.position === FINISH_POSITION);
}

function nombreArrives(color) {
    return tokensOf(color).filter(t => t.position === FINISH_POSITION).length;
}


/* ============================================================
   8. NOTIFICATIONS ET FEEDBACK
   ============================================================ */

let toastTimer;
function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function setGameMessage(message) {
    if (diceMessage) diceMessage.textContent = message;
}

let bonusTimer;
function showBonusBadge(message) {
    if (!turnBonus) return;
    turnBonus.textContent = message;
    turnBonus.hidden = false;
    turnBonus.classList.remove("show");
    void turnBonus.offsetWidth;
    turnBonus.classList.add("show");
    if (turnCard) {
        turnCard.classList.remove("bonus-flash");
        void turnCard.offsetWidth;
        turnCard.classList.add("bonus-flash");
    }
    clearTimeout(bonusTimer);
    bonusTimer = setTimeout(hideBonusBadge, 2400);
}

function hideBonusBadge() {
    if (!turnBonus) return;
    turnBonus.classList.remove("show");
    turnBonus.hidden = true;
    if (turnCard) turnCard.classList.remove("bonus-flash");
}


/* ============================================================
   9. HISTORIQUE
   ============================================================ */

function addHistoryEntry(color, text) {
    gameState.history.push({ color: color, text: text });
    if (gameState.history.length > 60) gameState.history.shift();
    renderHistory();
}

function renderHistory() {
    if (!historyList) return;

    if (gameState.history.length === 0) {
        historyList.innerHTML = '<div class="history-empty">Aucun événement.</div>';
    } else {
        historyList.innerHTML = gameState.history.map(entry =>
            '<div class="history-entry">' +
                '<span class="history-entry-dot ' + entry.color + '"></span>' +
                '<span class="history-entry-text">' + entry.text + '</span>' +
            '</div>'
        ).join("");
    }

    if (historyCount) historyCount.textContent = gameState.history.length;
    historyList.scrollTop = historyList.scrollHeight;
}


/* ============================================================
   10. PANNEAU JOUEUR / TOUR
   ============================================================ */

function updatePlayerPanel() {
    const color  = currentPlayerColor();
    const player = PLAYERS[color];

    const cestUnBot = estBot(color);

    if (turnColorIndicator) turnColorIndicator.className = "turn-color-indicator " + color;
    if (playerAvatar) {
        playerAvatar.className = "player-avatar " + color + (cestUnBot ? " bot" : "");
        playerAvatar.textContent = cestUnBot ? "🤖" : player.letter;
    }
    if (playerInfoStrong) playerInfoStrong.textContent = nomComplet(color);
    if (playerInfoSmall) {
        playerInfoSmall.textContent = gameState.winner
            ? "Partie terminée"
            : (cestUnBot ? "Tour du bot" : "À toi de jouer");
    }

    playerRows.forEach(row => {
        const rowColor = row.dataset.color;
        if (!rowColor || !PLAYERS[rowColor]) return;

        row.classList.toggle("active-player", rowColor === color && !gameState.winner);

        const nameElement  = row.querySelector(".player-name");
        const stateElement = row.querySelector(".player-state");
        const dotElement   = row.querySelector(".player-color");

        /* Une seule source de vérité : PLAYERS[rowColor] + les sièges du mode. */
        if (nameElement) {
            nameElement.innerHTML = nomComplet(rowColor)
                + (estBot(rowColor) ? ' <span class="bot-tag">BOT</span>' : '');
        }
        if (dotElement)  dotElement.className = "player-color " + rowColor;
        if (stateElement) {
            const arrived = nombreArrives(rowColor);
            if (gameState.winner === rowColor)  stateElement.textContent = "Gagnant";
            else if (rowColor === color)        stateElement.textContent = arrived + "/4 · Ton tour";
            else                                stateElement.textContent = arrived + "/4";
        }
    });
}

/* NOTE : cette fonction peut réécrire le message du dé.
   Toujours l'appeler AVANT un setGameMessage() personnalisé. */
function updateActionPanel() {
    if (!diceButton || !diceButtonLabel) return;
    const color = currentPlayerColor();

    if (gameState.winner) {
        diceButton.disabled = true;
        diceButtonLabel.textContent = "PARTIE TERMINÉE";
        return;
    }

    const cestUnBot = estBot(color);

    /* Pendant tout le tour d'un bot, l'humain ne peut RIEN déclencher. */
    diceButton.disabled = cestUnBot
        || gameState.isRolling || gameState.isAnimatingMove || gameState.diceRolled;

    if (cestUnBot) {
        diceButtonLabel.textContent = "TOUR DU BOT";
    } else {
        diceButtonLabel.textContent = gameState.diceRolled ? "CHOISIR UN PION" : "LANCER LE DÉ";
    }

    if (cestUnBot) {
        /* Le message précis est écrit par executeBotTurn(). */
        return;
    }

    if (gameState.diceRolled) {
        const count = gameState.legalMoves.length;
        if (count === 1)    setGameMessage("Choisis le pion mis en évidence.");
        else if (count > 1) setGameMessage("Choisis un pion à déplacer.");
    } else if (!gameState.isRolling && !gameState.isAnimatingMove) {
        setGameMessage("Au tour du " + PLAYERS[color].name.toLowerCase() + ". Lance le dé.");
    }
}


/* ============================================================
   11. CONSTRUCTION DU PLATEAU
   ============================================================ */

function findRingIndexByCoordinate(row, col) {
    return RING.findIndex(coordinate => coordinate[0] === row && coordinate[1] === col);
}

function findHomePathByCoordinate(row, col) {
    for (const color of PLAYER_ORDER) {
        const index = HOME_PATHS[color].findIndex(c => c[0] === row && c[1] === col);
        if (index !== -1) return { color: color, index: index };
    }
    return null;
}

function isInsideBase(row, col) {
    return PLAYER_ORDER.some(color => {
        const p = PLAYERS[color];
        return row >= p.baseRow && row < p.baseRow + 6
            && col >= p.baseCol && col < p.baseCol + 6;
    });
}

function createBoardCell(row, col) {
    const cell = document.createElement("div");
    cell.className = "board-cell";
    cell.style.gridRow    = String(row + 1);
    cell.style.gridColumn = String(col + 1);
    cell.dataset.row = row;
    cell.dataset.col = col;

    if (isInsideBase(row, col)) {
        cell.classList.add("base-cell");
        return cell;
    }

    /* Centre 3 × 3 : dessiné par un calque dédié (createCenterGoal). */
    if (row >= 6 && row <= 8 && col >= 6 && col <= 8) {
        cell.classList.add("center-cell");
        return cell;
    }

    const ringIndex = findRingIndexByCoordinate(row, col);
    if (ringIndex !== -1) {
        cell.classList.add("track");
        cell.dataset.ringIndex = ringIndex;

        if (isSafeRingIndex(ringIndex)) cell.classList.add("safe");
        if (STAR_RING_INDEXES.indexOf(ringIndex) !== -1) cell.classList.add("star");

        PLAYER_ORDER.forEach(color => {
            if (ringIndex === PLAYERS[color].offset) {
                cell.classList.add("start-cell", "start-" + color);
                cell.dataset.startColor = color;
            }
            const entry = PLAYERS[color].entryCell;
            if (entry[0] === row && entry[1] === col) {
                cell.classList.add("entry-cell", "entry-" + color, "arrow-" + PLAYERS[color].arrow);
                cell.dataset.entryColor = color;
            }
        });
        return cell;
    }

    const home = findHomePathByCoordinate(row, col);
    if (home) {
        cell.classList.add("home-path", "home-path-" + home.color);
        cell.dataset.homeColor = home.color;
        cell.dataset.homeIndex = home.index;
    }
    return cell;
}

function createHomeZone(color) {
    const player = PLAYERS[color];

    const zone = document.createElement("div");
    zone.className = "home-zone " + color;
    zone.style.gridRow    = (player.baseRow + 1) + " / span 6";
    zone.style.gridColumn = (player.baseCol + 1) + " / span 6";

    const inner = document.createElement("div");
    inner.className = "home-zone-inner";

    for (let i = 0; i < 4; i++) {
        const slot = document.createElement("div");
        slot.className = "home-slot";
        slot.dataset.homeColor  = color;
        slot.dataset.tokenIndex = i;
        inner.appendChild(slot);
    }

    zone.appendChild(inner);
    ludoBoard.appendChild(zone);
}

function createCenterGoal() {
    const goal = document.createElement("div");
    goal.className = "center-goal";
    goal.style.gridRow    = "7 / span 3";
    goal.style.gridColumn = "7 / span 3";

    PLAYER_ORDER.forEach(color => {
        const triangle = document.createElement("div");
        triangle.className = "goal-triangle " + color;
        goal.appendChild(triangle);
    });

    PLAYER_ORDER.forEach(color => {
        const slot = document.createElement("div");
        slot.className = "finish-slot finish-" + color;
        slot.dataset.finishColor = color;
        goal.appendChild(slot);
    });

    ludoBoard.appendChild(goal);
}

function createBoard() {
    if (!ludoBoard) {
        console.error("LUDO : élément #ludoBoard introuvable dans index.html.");
        return;
    }
    ludoBoard.innerHTML = "";

    for (let row = 0; row < BOARD_SIZE; row++) {
        for (let col = 0; col < BOARD_SIZE; col++) {
            ludoBoard.appendChild(createBoardCell(row, col));
        }
    }

    PLAYER_ORDER.forEach(createHomeZone);
    createCenterGoal();
    renderTokens();
}


/* ============================================================
   12. RENDU DES PIONS
   ------------------------------------------------------------
   Structure d'un pion :
     <div class="game-token">   ← position (glissement FLIP)
        <span class="token">    ← visuel (pulsation, impact, saut)
   ============================================================ */

function findBoardCell(row, col) {
    return ludoBoard.querySelector('.board-cell[data-row="' + row + '"][data-col="' + col + '"]');
}

function createTokenElement(token) {
    const element = document.createElement("div");
    element.className = "game-token";
    element.tabIndex = 0;
    element.setAttribute("role", "button");
    element.setAttribute("aria-label",
        "Pion " + (token.tokenIndex + 1) + " du " + PLAYERS[token.color].name.toLowerCase());
    element.dataset.color      = token.color;
    element.dataset.tokenIndex = token.tokenIndex;
    element.dataset.tokenId    = token.id;

    const body = document.createElement("span");
    body.className = "token " + token.color;
    element.appendChild(body);

    element.addEventListener("click", function () {
        handleTokenSelection(token.color, token.tokenIndex);
    });
    element.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleTokenSelection(token.color, token.tokenIndex);
        }
    });
    return element;
}

/* Renvoie le conteneur DOM correspondant EXACTEMENT à la position logique. */
function getTokenContainer(token) {
    if (token.position === -1) {
        return ludoBoard.querySelector(
            '.home-slot[data-home-color="' + token.color + '"]' +
            '[data-token-index="' + token.tokenIndex + '"]'
        );
    }
    if (token.position === FINISH_POSITION) {
        return ludoBoard.querySelector('.finish-slot[data-finish-color="' + token.color + '"]');
    }
    const coordinate = getLogicalCoordinate(token.color, token.position);
    if (!coordinate) return null;
    return findBoardCell(coordinate[0], coordinate[1]);
}

function renderTokens() {
    if (!ludoBoard) return;

    ludoBoard.querySelectorAll(".game-token").forEach(el => el.remove());
    ludoBoard.querySelectorAll(".block-marker").forEach(el => el.remove());
    ludoBoard.querySelectorAll(".has-block").forEach(el => el.classList.remove("has-block"));
    ludoBoard.querySelectorAll(".occupied-slot").forEach(el => el.classList.remove("occupied-slot"));

    const groups = new Map();

    gameState.tokens.forEach(token => {
        const container = getTokenContainer(token);
        if (!container) return;

        const element = createTokenElement(token);
        if (token.state === TOKEN_STATE.FINISHED) {
            element.querySelector(".token").classList.add("finished-token");
        }
        if (token.state === TOKEN_STATE.BASE) container.classList.add("occupied-slot");

        if (!groups.has(container)) groups.set(container, []);
        groups.get(container).push(element);
    });

    groups.forEach(function (elements, container) {
        elements.forEach(function (element, index) {
            element.dataset.stackIndex = index;
            element.dataset.stackSize  = elements.length;
            if (elements.length > 1) {
                element.classList.add("stacked-token");
                element.style.setProperty("--stack-index", index);
                element.style.setProperty("--stack-size", elements.length);
            }
            container.appendChild(element);
        });

        if (container.dataset && container.dataset.ringIndex !== undefined) {
            const block = getBlockAtRingIndex(Number(container.dataset.ringIndex));
            if (block) {
                container.classList.add("has-block");
                const marker = document.createElement("span");
                marker.className = "block-marker " + block.color;
                marker.textContent = "×" + block.count;
                container.appendChild(marker);
            }
        }
    });

    updateLegalMoveHighlights();
}


/* ============================================================
   13. MOTEUR D'ANIMATION (technique FLIP)
   ------------------------------------------------------------
   1. on mémorise la position à l'écran de chaque pion
   2. le MOTEUR change la position logique
   3. on redessine
   4. on remet visuellement le pion à son ancienne place
      puis on le laisse glisser jusqu'à la nouvelle.

   L'animation ne modifie JAMAIS l'état logique.
   ============================================================ */

function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

/* Étape 1 : mémoriser où se trouve chaque pion à l'écran. */
function captureTokenRects() {
    const rects = new Map();
    if (!ludoBoard) return rects;
    ludoBoard.querySelectorAll(".game-token").forEach(element => {
        const rect = element.getBoundingClientRect();
        if (rect.width > 0) rects.set(element.dataset.tokenId, rect);
    });
    return rects;
}

/* Étape 4 : faire glisser les pions qui ont changé de case. */
function playFlip(previousRects, duration) {
    if (!ludoBoard || !previousRects || previousRects.size === 0) return false;
    if (prefersReducedMotion()) return false;

    const moved = [];
    ludoBoard.querySelectorAll(".game-token").forEach(element => {
        const before = previousRects.get(element.dataset.tokenId);
        if (!before) return;
        const after = element.getBoundingClientRect();
        if (after.width === 0) return;

        const dx = before.left - after.left;
        const dy = before.top  - after.top;
        if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;

        element.style.transition = "none";
        element.style.transform  = "translate(" + dx + "px, " + dy + "px)";
        moved.push(element);
    });

    if (moved.length === 0) return false;

    void ludoBoard.offsetWidth;   /* force le navigateur à prendre en compte l'état de départ */

    moved.forEach(element => {
        element.style.transition = "transform " + duration + "ms cubic-bezier(0.32, 1.12, 0.42, 1)";
        element.style.transform  = "translate(0px, 0px)";
        element.classList.add("is-sliding");
    });
    return true;
}

/* Petite animation sur le visuel d'un pion (impact, saut, atterrissage). */
function animateTokenBody(color, tokenIndex, className, duration) {
    if (!ludoBoard || prefersReducedMotion()) return;
    const body = ludoBoard.querySelector(
        '.game-token[data-color="' + color + '"][data-token-index="' + tokenIndex + '"] .token'
    );
    if (!body) return;
    body.classList.remove(className);
    void body.offsetWidth;
    body.classList.add(className);
    setTimeout(function () { body.classList.remove(className); }, duration);
}


/* ============================================================
   14. SURBRILLANCE DES COUPS LÉGAUX
   ============================================================ */

function updateLegalMoveHighlights() {
    if (!ludoBoard) return;
    ludoBoard.querySelectorAll(".game-token").forEach(el => el.classList.remove("legal-move"));
    if (!gameState.diceRolled || gameState.winner) return;

    const color = currentPlayerColor();
    gameState.legalMoves.forEach(move => {
        const element = ludoBoard.querySelector(
            '.game-token[data-color="' + color + '"][data-token-index="' + move.tokenIndex + '"]'
        );
        if (element) element.classList.add("legal-move");
    });
}

function handleTokenSelection(color, tokenIndex) {
    if (!gameState || gameState.winner || gameState.isRolling || gameState.isAnimatingMove) return;

    if (estBot(currentPlayerColor())) {
        showToast("Le bot est en train de jouer.");
        return;
    }
    if (color !== currentPlayerColor()) {
        showToast("Ce n'est pas le tour de ce joueur.");
        return;
    }
    if (!gameState.diceRolled) {
        showToast("Lance d'abord le dé.");
        return;
    }

    const move = gameState.legalMoves.find(m => m.tokenIndex === tokenIndex);
    if (!move) {
        showToast("Ce pion ne peut pas être déplacé avec ce résultat.");
        return;
    }

    animateTokenBody(color, tokenIndex, "picked", 220);
    deplacerPion(color, tokenIndex, move.to);
}


/* ============================================================
   15. DÉPLACEMENT (case par case, avec glissement)
   ============================================================ */

function getMovementPath(fromPosition, toPosition) {
    if (fromPosition === -1) return [0];
    const path = [];
    for (let p = fromPosition + 1; p <= toPosition; p++) path.push(p);
    return path;
}

async function animateTokenMovement(token, fromPosition, toPosition) {
    const path = getMovementPath(fromPosition, toPosition);

    if (prefersReducedMotion()) {
        setTokenPosition(token, toPosition);
        renderTokens();
        return;
    }

    /* Sortie de base : un seul grand glissement + atterrissage. */
    if (fromPosition === -1) {
        const before = captureTokenRects();
        setTokenPosition(token, 0);
        renderTokens();
        playFlip(before, BASE_EXIT_MS);
        animateTokenBody(token.color, token.tokenIndex, "exiting-base", BASE_EXIT_MS);
        await sleep(BASE_EXIT_MS);
        animateTokenBody(token.color, token.tokenIndex, "landing", 260);
        await sleep(160);
        return;
    }

    /* Déplacement normal : une case à la fois, chacune animée. */
    for (const position of path) {
        const before = captureTokenRects();
        setTokenPosition(token, position);
        renderTokens();
        playFlip(before, MOVE_STEP_MS);
        animateTokenBody(token.color, token.tokenIndex, "hopping", MOVE_STEP_MS);
        await sleep(MOVE_STEP_MS);
    }
}

async function deplacerPion(color, tokenIndex, targetPosition) {
    const token = getToken(color, tokenIndex);
    if (!token) return;

    /* Dernière validation avant toute animation. */
    if (!isLegalMove(color, tokenIndex, gameState.diceValue)) return;

    const fromPosition = token.position;
    const diceValue    = gameState.diceValue;
    const rolledSix    = gameState.lastRollWasSix;

    gameState.isAnimatingMove = true;
    gameState.legalMoves = [];
    hideBonusBadge();
    updateActionPanel();
    updateLegalMoveHighlights();

    /* --- 4. Le pion se déplace --- */
    await animateTokenMovement(token, fromPosition, targetPosition);
