// Socket.IO bağlantısı
const socket = io();

// Oyun durumu
let gameState = {
  playerId: null,
  playerSlot: null,
  cards: [],
  score: 0,
  bet: 0,
  gameActive: false
};

// Kart gösterimi
const cardSuits = {
  'H': '♥',  // Hearts
  'D': '♦',  // Diamonds
  'C': '♣',  // Clubs
  'S': '♠'   // Spades
};

// Socket Event Handlers
socket.on('connect', () => {
  console.log('Sunucuya bağlanıldı:', socket.id);
  document.getElementById('playerInfo').textContent = `Oyuncu ID: ${socket.id.substring(0, 8)}...`;
});

socket.on('playerJoined', (data) => {
  console.log('Oyuncu katıldı:', data);
  gameState.playerId = data.playerId;
  gameState.playerSlot = data.slot;
  document.getElementById(`player-${data.slot}`).classList.add('active');
  document.querySelector(`#player-${data.slot} .player-status`).textContent = 'Bağlandı';
  document.querySelector(`#player-${data.slot} .player-status`).classList.add('connected');
  document.getElementById('playerInfo').textContent = `Oyuncu ${data.slot} - ID: ${socket.id.substring(0, 8)}...`;
});

socket.on('dealerCards', (data) => {
  console.log('Krupiye kartları:', data);
  displayDealerCards(data.cards);
  document.getElementById('dealerScore').textContent = `Puan: ${data.score}`;
  document.getElementById('deckCount').textContent = data.deckRemaining || 52;
});

socket.on('playerCards', (data) => {
  console.log('Oyuncu kartları:', data);
  gameState.cards = data.cards;
  gameState.score = data.score;
  gameState.bet = data.bet;
  
  const slot = data.slot;
  displayPlayerCards(slot, data.cards);
  document.getElementById(`playerScore-${slot}`).textContent = `Puan: ${data.score}`;
  document.getElementById(`playerBet-${slot}`).textContent = `Bahis: ${data.bet}`;
  
  if (data.slot === gameState.playerSlot) {
    enablePlayerActions(slot, true);
  }
});

socket.on('gameResult', (data) => {
  console.log('Oyun sonucu:', data);
  const slot = data.slot;
  const resultEl = document.querySelector(`#player-${slot} .player-status`);
  
  if (data.result === 'bust') {
    document.getElementById(`player-${slot}`).classList.add('bust');
    resultEl.textContent = 'Kart Yüksekliği';
    resultEl.style.color = 'red';
  } else if (data.result === 'win') {
    resultEl.textContent = 'Kazandı! 🎉';
    resultEl.style.color = '#00ff00';
  } else if (data.result === 'loss') {
    resultEl.textContent = 'Kaybetti';
    resultEl.style.color = '#ff6b6b';
  } else if (data.result === 'push') {
    resultEl.textContent = 'Eşitlik';
    resultEl.style.color = '#ffa500';
  }
});

socket.on('disconnect', () => {
  console.log('Sunucudan bağlantı kesildi');
  document.getElementById('gameStatus').textContent = 'Oyun Durumu: Bağlantı Kesildi';
});

// UI İşlevleri
function displayPlayerCards(slot, cards) {
  const cardsContainer = document.getElementById(`playerCards-${slot}`);
  cardsContainer.innerHTML = '';
  
  if (cards.length === 0) {
    cardsContainer.innerHTML = '<p class="empty">Kartlar görüntülenecek</p>';
    return;
  }
  
  cards.forEach(card => {
    const cardEl = createCardElement(card);
    cardsContainer.appendChild(cardEl);
  });
}

function displayDealerCards(cards) {
  const cardsContainer = document.getElementById('dealerCards');
  cardsContainer.innerHTML = '';
  
  if (cards.length === 0) {
    cardsContainer.innerHTML = '<p class="empty">Kartlar görüntülenecek</p>';
    return;
  }
  
  cards.forEach(card => {
    const cardEl = createCardElement(card);
    cardsContainer.appendChild(cardEl);
  });
}

function createCardElement(card) {
  const cardEl = document.createElement('div');
  cardEl.className = `card ${card.suit.toLowerCase()}`;
  
  // Kart değeri ve sembolü
  const value = card.value === 'T' ? '10' : card.value;
  const suitSymbol = cardSuits[card.suit] || '♠';
  
  cardEl.textContent = `${value}${suitSymbol}`;
  cardEl.title = `${getCardName(card.value)} ${getSuitName(card.suit)}`;
  
  return cardEl;
}

function getCardName(value) {
  const names = {
    'A': 'As',
    'K': 'Kız',
    'Q': 'Prenses',
    'J': 'Vale',
    'T': '10'
  };
  return names[value] || value;
}

function getSuitName(suit) {
  const names = {
    'H': 'Kupa',
    'D': 'Karo',
    'C': 'Trefoil',
    'S': 'Spade'
  };
  return names[suit] || suit;
}

function enablePlayerActions(slot, enable) {
  const buttonsContainer = document.getElementById(`playerActions-${slot}`);
  const buttons = buttonsContainer.querySelectorAll('button');
  
  buttons.forEach(button => {
    button.disabled = !enable;
  });
}

// Buton Event Listeners
document.getElementById('btnNewGame').addEventListener('click', () => {
  socket.emit('newGame', { slot: gameState.playerSlot });
  document.getElementById('gameStatus').textContent = 'Oyun Durumu: Yeni Oyun Başlatılıyor...';
});

document.getElementById('btnPlaceBet').addEventListener('click', () => {
  const bet = prompt('Bahis miktarını girin (100-10000):');
  if (bet && !isNaN(bet)) {
    socket.emit('placeBet', { slot: gameState.playerSlot, amount: parseInt(bet) });
  }
});

// Hit, Stand, Double, Split butonları
document.querySelectorAll('.btn-hit').forEach((button, index) => {
  button.addEventListener('click', () => {
    const slot = index + 1;
    if (slot === gameState.playerSlot) {
      socket.emit('playerHit', { slot: gameState.playerSlot });
    }
  });
});

document.querySelectorAll('.btn-stand').forEach((button, index) => {
  button.addEventListener('click', () => {
    const slot = index + 1;
    if (slot === gameState.playerSlot) {
      socket.emit('playerStand', { slot: gameState.playerSlot });
      enablePlayerActions(gameState.playerSlot, false);
    }
  });
});

document.querySelectorAll('.btn-double').forEach((button, index) => {
  button.addEventListener('click', () => {
    const slot = index + 1;
    if (slot === gameState.playerSlot) {
      socket.emit('playerDouble', { slot: gameState.playerSlot });
      enablePlayerActions(gameState.playerSlot, false);
    }
  });
});

document.querySelectorAll('.btn-split').forEach((button, index) => {
  button.addEventListener('click', () => {
    const slot = index + 1;
    if (slot === gameState.playerSlot) {
      socket.emit('playerSplit', { slot: gameState.playerSlot });
    }
  });
});

// Test için demo kart göster
function showDemoCards() {
  const demoCards = [
    { value: '7', suit: 'H' },
    { value: 'K', suit: 'D' }
  ];
  
  displayPlayerCards(1, demoCards);
  
  const dealerCards = [
    { value: 'A', suit: 'S' },
    { value: '5', suit: 'C' }
  ];
  
  displayDealerCards(dealerCards);
}

// Sayfa yüklenince başlat
document.addEventListener('DOMContentLoaded', () => {
  console.log('Client yüklendi');
  // Opsiyon: demo görünüm için aşağıdaki satırı açabilirsin
  // showDemoCards();
});
