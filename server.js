const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const port = process.env.PORT || 3000;

// Middleware
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Oyun Durumu
const gameState = {
  players: {}, // { playerId: { slot, cards, score, bet, status } }
  dealer: { cards: [], score: 0 },
  deck: [],
  gameActive: false
};

// Kart Destesi Oluştur
function createDeck() {
  const suits = ['H', 'D', 'C', 'S']; // Hearts, Diamonds, Clubs, Spades
  const values = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K'];
  const deck = [];

  for (let i = 0; i < 6; i++) { // 6 desteli ayakkabı
    for (let suit of suits) {
      for (let value of values) {
        deck.push({ value, suit });
      }
    }
  }

  return deck.sort(() => Math.random() - 0.5); // Karıştır
}

// Kart Çek
function drawCard() {
  if (gameState.deck.length < 10) {
    gameState.deck = createDeck(); // Yeni desteler ekle
  }
  return gameState.deck.pop();
}

// Puan Hesapla
function calculateScore(cards) {
  let score = 0;
  let aces = 0;

  for (let card of cards) {
    if (card.value === 'A') {
      aces++;
      score += 11;
    } else if (['K', 'Q', 'J'].includes(card.value)) {
      score += 10;
    } else if (card.value === 'T') {
      score += 10;
    } else {
      score += parseInt(card.value);
    }
  }

  // As puanını ayarla
  while (score > 21 && aces > 0) {
    score -= 10;
    aces--;
  }

  return score;
}

// Dealer Otomatik Oynat
async function dealerPlay(io) {
  return new Promise((resolve) => {
    const delay = (ms) => new Promise(r => setTimeout(r, ms));

    (async () => {
      // Dealer'ın kapalı kartını aç ve tüm oyunculara göster
      io.emit('dealerCards', {
        cards: gameState.dealer.cards,
        score: gameState.dealer.score,
        deckRemaining: gameState.deck.length
      });

      // Kısa bekleme sonra çekme işlemi başlasın
      await delay(600);

      // Dealer 17+ kadar oyna
      while (gameState.dealer.score < 17) {
        await delay(800); // Görsel efekt için bekleme
        const newCard = drawCard();
        gameState.dealer.cards.push(newCard);
        gameState.dealer.score = calculateScore(gameState.dealer.cards);

        io.emit('dealerCards', {
          cards: gameState.dealer.cards,
          score: gameState.dealer.score,
          deckRemaining: gameState.deck.length
        });
      }

      await delay(500);

      // Tüm oyuncu sonuçlarını belirle
      for (let slot in gameState.players) {
        const player = gameState.players[slot];
        if (player.status === 'bust') {
          // Zaten bust, hiçbir şey yapma
          player.totalScore -= player.bet; // Bahis kaybetti
          continue;
        }

        let result = 'loss'; // Varsayılan kayıp
        let scoreChange = -player.bet; // Varsayılan bahis kaybı

        if (gameState.dealer.score > 21) {
          // Dealer bust, oyuncu kazan
          result = 'win';
          scoreChange = player.bet;
        } else if (player.score > gameState.dealer.score) {
          result = 'win';
          scoreChange = player.bet;
        } else if (player.score === gameState.dealer.score) {
          result = 'push';
          scoreChange = 0; // Bahis iade
        } else {
          result = 'loss';
          scoreChange = -player.bet;
        }

        player.totalScore += scoreChange;
        player.status = result;
        io.to(`player-${slot}`).emit('gameResult', {
          slot: parseInt(slot),
          result: result,
          dealerScore: gameState.dealer.score,
          totalScore: player.totalScore
        });
      }

      // Tüm skorları yayınla
      const scores = {};
      for (let slot in gameState.players) {
        scores[slot] = gameState.players[slot].totalScore;
      }
      io.emit('updateScores', scores);

      resolve();
    })();
  });
}

// Tüm Oyunlar Bitti mi?
function areAllPlayersFinished() {
  for (let slot in gameState.players) {
    const player = gameState.players[slot];
    if (player.status === 'active' || player.status === 'waiting') {
      return false;
    }
  }
  return true;
}

// Socket.io connection
io.on('connection', (socket) => {
  console.log('New player connected:', socket.id);

  // Oyuncuyu bir slota ata
  let assignedSlot = null;
  for (let slot = 1; slot <= 7; slot++) {
    if (!gameState.players[slot]) {
      assignedSlot = slot;
      gameState.players[slot] = {
        id: socket.id,
        slot: slot,
        cards: [],
        score: 0,
        bet: 0,
        status: 'waiting',
        totalScore: 0 // Toplam skor (genel)
      };
      break;
    }
  }

  if (assignedSlot) {
    socket.emit('playerJoined', { playerId: socket.id, slot: assignedSlot });
    io.emit('playerConnected', { slot: assignedSlot, playerId: socket.id });
    console.log(`Player ${socket.id} assigned to slot ${assignedSlot}`);
  } else {
    socket.emit('error', { message: 'Tüm masalar dolu' });
  }

  // Claim specific seat on table by clicking empty box
  socket.on('claimSeat', (data) => {
    const slot = data.slot;

    // If this socket already has a slot, reject
    for (let s in gameState.players) {
      if (gameState.players[s] && gameState.players[s].id === socket.id) {
        socket.emit('error', { message: 'Zaten bir slota sahipsiniz' });
        return;
      }
    }

    if (!gameState.players[slot]) {
      gameState.players[slot] = {
        id: socket.id,
        slot: slot,
        cards: [],
        score: 0,
        bet: 0,
        status: 'waiting',
        totalScore: 0
      };
      socket.emit('playerJoined', { playerId: socket.id, slot: slot });
      io.emit('playerConnected', { slot: slot, playerId: socket.id });
      console.log(`Player ${socket.id} claimed slot ${slot}`);
    } else {
      socket.emit('error', { message: 'Bu kutu dolu' });
    }
  });

  // Oyuncu kartı çeker (Hit)
  socket.on('playerHit', (data) => {
    const slot = data.slot;
    if (gameState.players[slot]) {
      const newCard = drawCard();
      gameState.players[slot].cards.push(newCard);
      gameState.players[slot].score = calculateScore(gameState.players[slot].cards);

      socket.emit('playerCards', {
        slot: slot,
        cards: gameState.players[slot].cards,
        score: gameState.players[slot].score,
        bet: gameState.players[slot].bet
      });

      // Kart Yüksekliği Kontrol
      if (gameState.players[slot].score > 21) {
        socket.emit('gameResult', { slot: slot, result: 'bust' });
        gameState.players[slot].status = 'bust';
      }
    }
  });

  // Oyuncu Stand (Dur)
  socket.on('playerStand', (data) => {
    const slot = data.slot;
    if (gameState.players[slot]) {
      gameState.players[slot].status = 'stand';
      socket.emit('playerStand', { slot: slot });

      // Tüm oyuncular durdu mu?
      if (areAllPlayersFinished()) {
        io.emit('gameStatus', { status: 'Krupiye oynuyor...' });
        dealerPlay(io).then(() => {
          io.emit('gameStatus', { status: 'Oyun Bitti - Yeni Oyun Başlatabilirsiniz' });
        });
      }
    }
  });

  // Oyuncu Double
  socket.on('playerDouble', (data) => {
    const slot = data.slot;
    if (gameState.players[slot]) {
      gameState.players[slot].bet *= 2;
      const newCard = drawCard();
      gameState.players[slot].cards.push(newCard);
      gameState.players[slot].score = calculateScore(gameState.players[slot].cards);

      socket.emit('playerCards', {
        slot: slot,
        cards: gameState.players[slot].cards,
        score: gameState.players[slot].score,
        bet: gameState.players[slot].bet
      });

      // Double sonrası otomatik stand
      gameState.players[slot].status = 'stand';

      // Tüm oyuncular durdu mu?
      if (areAllPlayersFinished()) {
        io.emit('gameStatus', { status: 'Krupiye oynuyor...' });
        dealerPlay(io).then(() => {
          io.emit('gameStatus', { status: 'Oyun Bitti - Yeni Oyun Başlatabilirsiniz' });
        });
      }
    }
  });

  // Oyuncu Split
  socket.on('playerSplit', (data) => {
    const slot = data.slot;
    if (gameState.players[slot] && gameState.players[slot].cards.length === 2) {
      if (gameState.players[slot].cards[0].value === gameState.players[slot].cards[1].value) {
        socket.emit('splitAllowed', { slot: slot });
      } else {
        socket.emit('error', { message: 'Split için aynı değerde kartlar gerekli' });
      }
    }
  });

  // Bahis Yap
  socket.on('placeBet', (data) => {
    const slot = data.slot;
    const amount = data.amount;
    if (gameState.players[slot] && amount > 0 && amount <= 10000) {
      gameState.players[slot].bet = amount;
      gameState.players[slot].status = 'ready';
      socket.emit('betPlaced', { slot: slot, amount: amount, message: `${amount} TL bahis yaptınız` });
      console.log(`Player ${slot} placed bet: ${amount}`);
    } else {
      socket.emit('error', { message: 'Geçersiz bahis miktarı (1-10000)' });
    }
  });

  // Yeni Oyun
  socket.on('newGame', (data) => {
    const slot = data.slot;
    if (gameState.players[slot]) {
      // Bahis kontrol
      if (!gameState.players[slot].bet || gameState.players[slot].bet === 0) {
        socket.emit('error', { message: 'Lütfen önce bahis yapın' });
        return;
      }
      gameState.players[slot].cards = [drawCard(), drawCard()];
      gameState.players[slot].score = calculateScore(gameState.players[slot].cards);
      gameState.players[slot].status = 'active';

      socket.emit('playerCards', {
        slot: slot,
        cards: gameState.players[slot].cards,
        score: gameState.players[slot].score,
        bet: gameState.players[slot].bet
      });

      // Krupiye kartları (ikinci kart kapalı gösterilecek)
      gameState.dealer.cards = [drawCard(), drawCard()];
      gameState.dealer.score = calculateScore(gameState.dealer.cards);

      // Maskeli yayımlama: ikinci kart gizli
      const masked = [gameState.dealer.cards[0], { hidden: true }];
      io.emit('dealerCards', {
        cards: masked,
        score: null, // skoru gizle
        deckRemaining: gameState.deck.length
      });
    }
  });

  socket.on('disconnect', () => {
    console.log('Player disconnected:', socket.id);
    // Oyuncuyu tablosundan kaldır
    for (let slot in gameState.players) {
      if (gameState.players[slot].id === socket.id) {
        delete gameState.players[slot];
        io.emit('playerDisconnected', { slot: parseInt(slot) });
      }
    }
  });
});

// Start server
server.listen(port, () => {
  console.log(`🎰 Blackjack server listening on http://localhost:${port}`);
  gameState.deck = createDeck(); // Başlangıç destesini oluştur
});
