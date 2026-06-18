const SUITS = [
    { symbol: '♠', color: 'black' },
    { symbol: '♥', color: 'red' },
    { symbol: '♦', color: 'red' },
    { symbol: '♣', color: 'black' },
];
const RANKS = [
    { rank: 2, label: '2' },
    { rank: 3, label: '3' },
    { rank: 4, label: '4' },
    { rank: 5, label: '5' },
    { rank: 6, label: '6' },
    { rank: 7, label: '7' },
    { rank: 8, label: '8' },
    { rank: 9, label: '9' },
    { rank: 10, label: '10' },
    { rank: 11, label: 'J' },
    { rank: 12, label: 'Q' },
    { rank: 13, label: 'K' },
    { rank: 14, label: 'A' },
];

const APP_VERSION = '20260618-gameover-reset-1';
const START_CHIPS = 1000;
const UPDATE_URL = 'https://mishanya3232-sketch.github.io/catch-game/version.json';

const els = {
    botCards: document.getElementById('botCards'),
    playerCards: document.getElementById('playerCards'),
    communityCards: document.getElementById('communityCards'),
    pot: document.getElementById('pot'),
    botChips: document.getElementById('botChips'),
    playerChips: document.getElementById('playerChips'),
    message: document.getElementById('message'),
    bestHands: document.getElementById('bestHands'),
    playerHint: document.getElementById('playerHint'),
    winChance: document.getElementById('winChance'),
    winBar: document.getElementById('winBar'),
    stage: document.getElementById('stage'),
    foldBtn: document.getElementById('foldBtn'),
    checkBtn: document.getElementById('checkBtn'),
    raiseBtn: document.getElementById('raiseBtn'),
    newHandBtn: document.getElementById('newHandBtn'),
};

let state;

function createDeck() {
    const deck = [];
    for (const suit of SUITS) {
        for (const rank of RANKS) {
            deck.push({ ...rank, symbol: suit.symbol, suit: suit.symbol, color: suit.color });
        }
    }
    return deck;
}

function shuffle(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }
}

function deal() {
    return state.deck.pop();
}

function newHand() {
    const matchWasOver = state.stage === 'gameover' && (state.playerChips <= 0 || state.botChips <= 0);

    if (matchWasOver) {
        state.playerChips = START_CHIPS;
        state.botChips = START_CHIPS;
    }

    if (state.playerChips <= 0 || state.botChips <= 0) {
        state.stage = 'gameover';
        state.message = state.playerChips <= 0 ? 'У вас закончились фишки. Бот победил.' : 'У бота закончились фишки. Вы победили.';
        render();
        return;
    }

    state.deck = createDeck();
    shuffle(state.deck);

    state.playerCards = [deal(), deal()];
    state.botCards = [deal(), deal()];
    state.communityCards = [];
    state.stage = 'preflop';
    state.pot = 0;
    state.playerBet = 0;
    state.botBet = 0;
    state.currentBet = 0;

    const playerBlind = Math.min(10, state.playerChips);
    const botBlind = Math.min(20, state.botChips);

    state.playerChips -= playerBlind;
    state.botChips -= botBlind;
    state.pot = playerBlind + botBlind;
    state.playerBet = playerBlind;
    state.botBet = botBlind;
    state.currentBet = botBlind;
    state.message = matchWasOver ? 'Фишки сброшены: новая игра началась. Бот поставил большой блайнд.' : 'Ваш ход. Бот поставил большой блайнд.';

    render();
}

function canPlayerAct() {
    return ['preflop', 'flop', 'turn', 'river'].includes(state.stage);
}

function canBotAct() {
    return ['preflop', 'flop', 'turn', 'river'].includes(state.stage);
}

function fold() {
    if (!canPlayerAct()) return;
    awardPot('bot');
    state.stage = 'gameover';
    state.message = 'Вы сдались. Бот забрал банк.';
    render();
}

function checkCall() {
    if (!canPlayerAct()) return;
    const need = state.currentBet - state.playerBet;

    if (need > 0) {
        const amount = Math.min(need, state.playerChips);
        state.playerChips -= amount;
        state.playerBet += amount;
        state.pot += amount;

        if (amount < need) {
            state.message = 'Вы пошли all-in.';
            botAct();
            return;
        }

        state.message = 'Вы уравняли.';
        botAct();
        return;
    }

    state.message = 'Вы сделали чек.';
    botAct();
}

function raise() {
    if (!canPlayerAct()) return;
    const amount = Math.min(state.betSize, state.playerChips);

    if (amount <= 0) {
        state.message = 'У вас нет фишек для повышения.';
        botAct();
        return;
    }

    state.playerChips -= amount;
    state.playerBet += amount;
    state.pot += amount;
    state.currentBet = state.playerBet;
    state.message = `Вы повысили на ${amount}.`;
    botAct();
}

function botAct() {
    if (!canBotAct()) {
        advanceStreet();
        return;
    }

    const need = state.currentBet - state.botBet;

    if (need > 0) {
        if (state.botChips <= 0) {
            state.message = 'Бот в all-in.';
            advanceStreet();
            return;
        }

        const callAmount = Math.min(need, state.botChips);
        const strength = estimateBotStrength();

        if (strength < 0.25 && need > state.pot * 0.7 && Math.random() < 0.6) {
            awardPot('player');
            state.stage = 'gameover';
            state.message = 'Бот сбросил. Вы забрали банк.';
            render();
            return;
        }

        if (callAmount < need) {
            state.botChips -= callAmount;
            state.botBet += callAmount;
            state.pot += callAmount;
            state.currentBet = state.botBet;
            state.message = 'Бот пошёл all-in.';
            advanceStreet();
            return;
        }

        if (strength > 0.72 && Math.random() < 0.35 && state.botChips > need + state.betSize) {
            const raiseAmount = Math.min(state.betSize, state.botChips - need);
            state.botChips -= need + raiseAmount;
            state.botBet += need + raiseAmount;
            state.pot += need + raiseAmount;
            state.currentBet = state.botBet;
            state.message = `Бот повысил на ${raiseAmount}. Ваш ход.`;
            render();
            return;
        }

        state.botChips -= callAmount;
        state.botBet += callAmount;
        state.pot += callAmount;
        state.currentBet = state.botBet;
        state.message = 'Бот уравнял.';
        advanceStreet();
        return;
    }

    if (state.botChips > state.betSize && Math.random() < 0.12 && estimateBotStrength() > 0.55) {
        const raiseAmount = Math.min(state.betSize, state.botChips);
        state.botChips -= raiseAmount;
        state.botBet += raiseAmount;
        state.pot += raiseAmount;
        state.currentBet = state.botBet;
        state.message = `Бот повысил на ${raiseAmount}. Ваш ход.`;
        render();
        return;
    }

    state.message = 'Бот сделал чек.';
    advanceStreet();
}

function advanceStreet() {
    if (state.stage === 'preflop') {
        state.stage = 'flop';
        dealCommunity(3);
        state.message = 'Флоп. Ваш ход.';
    } else if (state.stage === 'flop') {
        state.stage = 'turn';
        dealCommunity(1);
        state.message = 'Тёрн. Ваш ход.';
    } else if (state.stage === 'turn') {
        state.stage = 'river';
        dealCommunity(1);
        state.message = 'Ривер. Ваш ход.';
    } else if (state.stage === 'river') {
        showdown();
        return;
    }

    state.playerBet = 0;
    state.botBet = 0;
    state.currentBet = 0;
    render();
}

function dealCommunity(count) {
    for (let i = 0; i < count; i++) {
        state.communityCards.push(deal());
    }
}

function showdown() {
    state.stage = 'showdown';

    const playerScore = evaluateBest(state.playerCards.concat(state.communityCards));
    const botScore = evaluateBest(state.botCards.concat(state.communityCards));
    const cmp = compareScores(playerScore.score, botScore.score);
    const pot = state.pot;

    if (cmp > 0) {
        state.pot = 0;
        state.playerChips += pot;
        state.message = `Вы выиграли: ${labelFromScore(playerScore.score)}!`;
    } else if (cmp < 0) {
        state.pot = 0;
        state.botChips += pot;
        state.message = `Бот выиграл: ${labelFromScore(botScore.score)}!`;
    } else {
        state.pot = 0;
        const half = Math.floor(pot / 2);
        state.playerChips += half;
        state.botChips += half;
        state.message = 'Ничья. Банк разделён.';
    }

    render();
}

function endHand(message) {
    state.stage = 'gameover';
    state.pot = 0;
    state.message = message;
    render();
}

function awardPot(winner) {
    const pot = state.pot;
    state.pot = 0;

    if (winner === 'player') {
        state.playerChips += pot;
    } else {
        state.botChips += pot;
    }
}

function estimateBotStrength() {
    const visible = state.botCards.concat(state.communityCards);

    if (visible.length < 5) {
        return estimatePreflopStrength(state.botCards);
    }

    const score = evaluateBest(visible).score;
    if (!score) return 0.5;

    const category = score[0];
    if (category >= 2) return 0.85;
    if (category === 1) return 0.62;
    if (category === 0) {
        const highCard = score[1];
        if (highCard >= 12) return 0.52;
        if (highCard >= 10) return 0.42;
        return 0.28;
    }
    return 0.5;
}

function estimatePreflopStrength(hand) {
    if (!hand || hand.length < 2) return 0.35;

    const ranks = hand.map(card => card.rank).sort((a, b) => b - a);
    const suited = hand[0].suit === hand[1].suit;
    const connected = Math.abs(ranks[0] - ranks[1]) === 1;

    if (ranks[0] === ranks[1]) return 0.82; // пара
    if (ranks[0] === 14) return suited ? 0.76 : 0.70;
    if (ranks[0] >= 13 && ranks[1] >= 12) return suited ? 0.68 : 0.62;
    if (ranks[0] >= 11 && ranks[1] >= 10) return suited ? 0.60 : 0.54;
    if (connected && ranks[1] >= 8) return suited ? 0.58 : 0.50;
    if (suited) return 0.46;

    return 0.35;
}

function evaluateBest(cards) {
    const combos = combinations(cards, 5);
    let best = null;
    let bestScore = null;

    for (const combo of combos) {
        const score = scoreHand(combo);
        if (!bestScore || compareScores(score, bestScore) > 0) {
            bestScore = score;
            best = combo;
        }
    }

    return { score: bestScore, cards: best };
}

function scoreHand(cards) {
    const ranks = cards.map(card => card.rank).sort((a, b) => b - a);
    const suits = cards.map(card => card.suit);
    const uniqueRanks = [...new Set(ranks)].sort((a, b) => b - a);
    const flush = suits.every(suit => suit === suits[0]);
    const straightHigh = getStraightHigh(uniqueRanks);
    const counts = {};

    for (const rank of ranks) {
        counts[rank] = (counts[rank] || 0) + 1;
    }

    const entries = Object.entries(counts)
        .map(([rank, count]) => ({ rank: Number(rank), count }))
        .sort((a, b) => b.count - a.count || b.rank - a.rank);

    if (flush && straightHigh) {
        return [8, straightHigh];
    }

    if (entries[0].count === 4) {
        const quadRank = entries[0].rank;
        const kicker = ranks.find(rank => rank !== quadRank);
        return [7, quadRank, kicker];
    }

    if (entries[0].count === 3 && entries[1] && entries[1].count === 2) {
        return [6, entries[0].rank, entries[1].rank];
    }

    if (flush) {
        return [5, ...ranks];
    }

    if (straightHigh) {
        return [4, straightHigh];
    }

    if (entries[0].count === 3) {
        const tripRank = entries[0].rank;
        const kickers = ranks.filter(rank => rank !== tripRank);
        return [3, tripRank, ...kickers];
    }

    if (entries[0].count === 2 && entries[1] && entries[1].count === 2) {
        const pairs = entries.slice(0, 2).map(entry => entry.rank).sort((a, b) => b - a);
        const kicker = ranks.find(rank => !pairs.includes(rank));
        return [2, pairs[0], pairs[1], kicker];
    }

    if (entries[0].count === 2) {
        const pairRank = entries[0].rank;
        const kickers = ranks.filter(rank => rank !== pairRank);
        return [1, pairRank, ...kickers];
    }

    return [0, ...ranks.slice(0, 5)];
}

function getStraightHigh(uniqueRanks) {
    if (uniqueRanks.length < 5) return null;

    for (let i = 0; i <= uniqueRanks.length - 5; i++) {
        const window = uniqueRanks.slice(i, i + 5);
        if (window[0] - window[4] === 4) {
            return window[0];
        }
    }

    // A-2-3-4-5 straight
    if (uniqueRanks.includes(14) && uniqueRanks.includes(2) && uniqueRanks.includes(3) && uniqueRanks.includes(4) && uniqueRanks.includes(5)) {
        return 5;
    }

    return null;
}

function compareScores(a, b) {
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const av = a[i] ?? 0;
        const bv = b[i] ?? 0;
        if (av > bv) return 1;
        if (av < bv) return -1;
    }
    return 0;
}

function combinations(arr, k) {
    const result = [];

    function backtrack(start, current) {
        if (current.length === k) {
            result.push(current.slice());
            return;
        }

        for (let i = start; i < arr.length; i++) {
            current.push(arr[i]);
            backtrack(i + 1, current);
            current.pop();
        }
    }

    backtrack(0, []);
    return result;
}

function labelFromScore(score) {
    const labels = {
        8: 'стрит-флеш',
        7: 'каре',
        6: 'фулл-хаус',
        5: 'флеш',
        4: 'стрит',
        3: 'сет',
        2: 'две пары',
        1: 'пара',
        0: 'старшая карта',
    };
    return labels[score[0]] || 'неизвестная комбинация';
}

function renderCard(card, hidden = false) {
    const div = document.createElement('div');
    div.className = `card ${hidden ? 'hidden' : ''} ${card.color}`;
    if (hidden) {
        div.innerHTML = '<span class="rank">?</span><span class="suit">?</span>';
    } else {
        div.innerHTML = `<span class="rank">${card.label}</span><span class="suit">${card.symbol}</span>`;
    }
    return div;
}

function cardToString(card) {
    return `${card.label}${card.symbol}`;
}

function renderBestHands() {
    els.bestHands.innerHTML = '';

    if (state.stage !== 'showdown' && state.stage !== 'gameover') {
        return;
    }

    if (state.playerCards.length && state.communityCards.length) {
        const playerBest = evaluateBest(state.playerCards.concat(state.communityCards));
        const playerRow = document.createElement('div');
        playerRow.textContent = `Вы: ${labelFromScore(playerBest.score)} — ${playerBest.cards.map(cardToString).join(' ')}`;
        els.bestHands.appendChild(playerRow);
    }

    if (state.botCards.length && state.communityCards.length) {
        const botBest = evaluateBest(state.botCards.concat(state.communityCards));
        const botRow = document.createElement('div');
        botRow.textContent = `Бот: ${labelFromScore(botBest.score)} — ${botBest.cards.map(cardToString).join(' ')}`;
        els.bestHands.appendChild(botRow);
    }
}

function sameCard(a, b) {
    return a.rank === b.rank && a.suit === b.suit;
}

function describeHoleCards() {
    if (!state.playerCards || state.playerCards.length < 2) return '—';

    const [first, second] = state.playerCards;
    const suited = first.suit === second.suit ? ' одномастные' : '';
    const connected = Math.abs(first.rank - second.rank) === 1 ? ' связанные' : '';

    if (first.rank === second.rank) {
        return `пара ${first.label}${first.symbol}`;
    }

    return `${first.label}${first.symbol} ${second.label}${second.symbol}${suited}${connected}`;
}

function renderPlayerHint() {
    if (!state.playerCards || state.playerCards.length === 0) {
        els.playerHint.textContent = 'Ваша рука: —';
        return;
    }

    if (state.stage === 'preflop') {
        els.playerHint.textContent = `Ваши карты: ${describeHoleCards()}. Комбинация появится после 5 общих карт.`;
        return;
    }

    const knownCards = state.playerCards.concat(state.communityCards);
    if (knownCards.length < 5) {
        const best = evaluateBest(knownCards);
        if (best.score) {
            els.playerHint.textContent = `Сейчас: ${labelFromScore(best.score)} — ${best.cards.map(cardToString).join(' ')}`;
        } else {
            els.playerHint.textContent = `Комбинация пока не собрана: есть ${knownCards.length} из 5 карт.`;
        }
        return;
    }

    const playerBest = evaluateBest(knownCards);
    els.playerHint.textContent = `Ваша рука: ${labelFromScore(playerBest.score)} — ${playerBest.cards.map(cardToString).join(' ')}`;
}

function gameoverProbability() {
    const message = state.message || '';

    if (message.includes('Вы выиграли') || message.includes('Вы забрали') || message.includes('У бота закончились фишки')) {
        return { percent: 100 };
    }

    if (message.includes('Бот выиграл') || message.includes('Вы сдались') || message.includes('У вас закончились фишки')) {
        return { percent: 0 };
    }

    if (message.includes('Ничья')) {
        return { percent: 50 };
    }

    return { percent: null };
}

function exactRiverProbability(remainingCards) {
    let wins = 0;
    let ties = 0;
    let total = 0;
    const board = state.communityCards.slice();

    for (let i = 0; i < remainingCards.length; i++) {
        for (let j = i + 1; j < remainingCards.length; j++) {
            const botHand = [remainingCards[i], remainingCards[j]];
            const playerScore = evaluateBest(state.playerCards.concat(board)).score;
            const botScore = evaluateBest(botHand.concat(board)).score;
            const cmp = compareScores(playerScore, botScore);

            if (cmp > 0) wins++;
            else if (cmp === 0) ties++;
            total++;
        }
    }

    if (!total) return { percent: null };

    return { percent: Math.round(((wins + ties * 0.5) / total) * 100) };
}

function calculateWinProbability() {
    if (state.stage === 'new' || !state.playerCards || state.playerCards.length === 0) {
        return { percent: null };
    }

    if (state.stage === 'showdown') {
        const playerScore = evaluateBest(state.playerCards.concat(state.communityCards)).score;
        const botScore = evaluateBest(state.botCards.concat(state.communityCards)).score;
        const cmp = compareScores(playerScore, botScore);

        return { percent: cmp > 0 ? 100 : cmp < 0 ? 0 : 50 };
    }

    if (state.stage === 'gameover') {
        return gameoverProbability();
    }

    const knownCards = state.playerCards.concat(state.communityCards);
    const remainingCards = createDeck().filter(card => !knownCards.some(knownCard => sameCard(card, knownCard)));

    if (remainingCards.length < 2) {
        return { percent: null };
    }

    if (state.stage === 'river') {
        return exactRiverProbability(remainingCards);
    }

    const trials = state.stage === 'preflop' ? 300 : state.stage === 'flop' ? 400 : 500;
    let wins = 0;
    let ties = 0;
    const neededCommunity = 5 - state.communityCards.length;

    for (let i = 0; i < trials; i++) {
        const deck = remainingCards.slice();
        shuffle(deck);

        const botHand = [deck.pop(), deck.pop()];
        const board = state.communityCards.slice().concat(deck.splice(0, neededCommunity));
        const playerScore = evaluateBest(state.playerCards.concat(board)).score;
        const botScore = evaluateBest(botHand.concat(board)).score;
        const cmp = compareScores(playerScore, botScore);

        if (cmp > 0) wins++;
        else if (cmp === 0) ties++;
    }

    return { percent: Math.round(((wins + ties * 0.5) / trials) * 100) };
}

function renderWinProbability() {
    const probability = calculateWinProbability();

    if (probability.percent === null) {
        els.winChance.textContent = '—';
        els.winBar.style.width = '10%';
        els.winBar.style.background = '#64748b';
        return;
    }

    const percent = Math.max(0, Math.min(100, probability.percent));
    els.winChance.textContent = `примерно ${percent}%`;
    els.winBar.style.width = `${Math.max(8, percent)}%`;
    els.winBar.style.background = percent >= 60 ? '#22c55e' : percent >= 40 ? '#f59e0b' : '#ef4444';
}

async function checkForUpdate() {
    try {
        const response = await fetch(`${UPDATE_URL}?current=${encodeURIComponent(APP_VERSION)}&t=${Date.now()}`, { cache: 'no-store' });
        const data = await response.json();

        if (data.version && data.version !== APP_VERSION) {
            const message = data.message || `Доступна версия ${data.version}.`;
            state.message = `${message} Кнопка обновления скрыта: скачайте новый APK с сайта.`;
            render();
        }
    } catch (error) {
        // Обновление проверяется тихо: если интернета нет, игра продолжает работать.
    }
}

function render() {
    els.botCards.innerHTML = '';
    els.playerCards.innerHTML = '';
    els.communityCards.innerHTML = '';

    for (const card of state.botCards) {
        els.botCards.appendChild(renderCard(card, state.stage !== 'showdown' && state.stage !== 'gameover'));
    }

    for (const card of state.playerCards) {
        els.playerCards.appendChild(renderCard(card));
    }

    for (const card of state.communityCards) {
        els.communityCards.appendChild(renderCard(card));
    }

    els.pot.textContent = state.pot;
    els.botChips.textContent = state.botChips;
    els.playerChips.textContent = state.playerChips;
    els.message.textContent = state.message;
    els.bestHands.innerHTML = '';
    renderBestHands();
    renderPlayerHint();
    renderWinProbability();
    els.stage.textContent = state.stage === 'preflop' ? 'Префлоп' :
        state.stage === 'flop' ? 'Флоп' :
        state.stage === 'turn' ? 'Тёрн' :
        state.stage === 'river' ? 'Ривер' :
        state.stage === 'showdown' ? 'Вскрытие' :
        state.stage === 'gameover' ? 'Конец раздачи' : '—';

    const playerCanAct = canPlayerAct();
    els.foldBtn.disabled = !playerCanAct;
    els.checkBtn.disabled = !playerCanAct;
    els.raiseBtn.disabled = !playerCanAct || state.playerChips <= 0;
    els.checkBtn.textContent = state.currentBet > state.playerBet ? 'Колл' : 'Чек';
    els.newHandBtn.disabled = false;
}

els.foldBtn.addEventListener('click', fold);
els.checkBtn.addEventListener('click', checkCall);
els.raiseBtn.addEventListener('click', raise);
els.newHandBtn.addEventListener('click', newHand);

state = {
    deck: [],
    playerCards: [],
    botCards: [],
    communityCards: [],
    stage: 'new',
    pot: 0,
    playerChips: START_CHIPS,
    botChips: START_CHIPS,
    playerBet: 0,
    botBet: 0,
    currentBet: 0,
    message: 'Нажмите «Новая раздача», чтобы начать.',
    betSize: 50,
};

render();
checkForUpdate();