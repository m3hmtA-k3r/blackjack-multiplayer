// Socket.IO bağlantısı
const socket = io();

// Oyun durumu (çoklu slot desteği)
let gameState = {
  playerId: null,
  playerSlots: new Set(), // Sahibi olunan slot'lar
  currentSlot: null, // Aktif slot (UI etkileşimi için)
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
  console.log('Oyuncu katıldı (slot):', data);
  gameState.playerId = data.playerId;
  gameState.playerSlots.add(data.slot); // Slot'u ekle
  gameState.currentSlot = data.slot; // Aktif slot'u ayarla
  document.getElementById(`player-${data.slot}`).classList.add('active');
  document.querySelector(`#player-${data.slot} .player-status`).textContent = 'Bağlandı';
  document.querySelector(`#player-${data.slot} .player-status`).classList.add('connected');
  document.getElementById('playerInfo').textContent = `Oyuncu ID: ${socket.id.substring(0, 8)}... (Slot: ${Array.from(gameState.playerSlots).join(', ')})`;
});

// When any player occupies a slot
socket.on('playerConnected', (data) => {
  const slot = data.slot;
  const statusEl = document.querySelector(`#player-${slot} .player-status`);
  if (statusEl) {
    statusEl.textContent = 'Bağlandı';
    statusEl.classList.add('connected');
  }
});

// When a player leaves a slot, mark it empty
socket.on('playerDisconnected', (data) => {
  const slot = data.slot;
  const box = document.getElementById(`player-${slot}`);
  if (box) {
    box.classList.remove('active', 'bust');
    const statusEl = box.querySelector('.player-status');
    statusEl.textContent = 'Boş';
    statusEl.classList.remove('connected');
    const cardsContainer = box.querySelector('.player-cards');
    cardsContainer.innerHTML = '<p class="empty">Kartlar görüntülenecek</p>';
    box.querySelector(`.player-info #playerScore-${slot}`).textContent = `Puan: 0`;
    box.querySelector(`.player-info #playerBet-${slot}`);
  }
  // If this client was in that slot, remove from owned slots and adjust currentSlot
  if (gameState.playerSlots.has(slot)) {
    gameState.playerSlots.delete(slot);
    if (gameState.currentSlot === slot) {
      gameState.currentSlot = Array.from(gameState.playerSlots)[0] || null;
    }
  }
});

socket.on('dealerCards', (data) => {
  console.log('Krupiye kartları:', data);
  displayDealerCards(data.cards);
  const scoreText = (data.score === null || data.score === undefined) ? '?' : data.score;
  document.getElementById('dealerScore').textContent = `Puan: ${scoreText}`;
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
  
  if (gameState.playerSlots.has(slot)) {
    enablePlayerActions(slot, true);
  }
});

socket.on('betPlaced', (data) => {
  console.log('Bahis kaydedildi:', data);
  document.getElementById(`playerBet-${data.slot}`).textContent = `Bahis: ${data.amount}`;
  alert(`Bahis başarılı: ${data.message}`);
});

socket.on('error', (data) => {
  console.error('Hata:', data.message);
  alert(`Hata: ${data.message}`);
});

socket.on('updateScores', (scores) => {
  console.log('Skorlar güncellendi:', scores);
  updateLeaderboard(scores);
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

socket.on('gameStatus', (data) => {
  console.log('Oyun durumu:', data.status);
  document.getElementById('gameStatus').textContent = `Oyun Durumu: ${data.status}`;
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
    let cardEl;
    if (card && card.hidden) {
      cardEl = document.createElement('div');
      cardEl.className = 'card card-back';
    } else {
      cardEl = createCardElement(card);
    }
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

function updateLeaderboard(scores) {
  const scoreList = document.getElementById('scoreList');
  scoreList.innerHTML = '';
  
  if (Object.keys(scores).length === 0) {
    scoreList.innerHTML = '<p class="empty">Skorlar görüntülenecek</p>';
    return;
  }
  
  // Skorları sırala (yüksekten düşüğe)
  const sortedScores = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 7); // En iyi 7 oyuncu
  
  sortedScores.forEach(([slot, score], index) => {
    const scoreEl = document.createElement('div');
    scoreEl.className = 'score-item';
    scoreEl.innerHTML = `<strong>#${index + 1}</strong> Oyuncu ${slot}: <strong>${score} TL</strong>`;
    scoreList.appendChild(scoreEl);
  });
}

// Buton Event Listeners
document.getElementById('btnNewGame').addEventListener('click', () => {
  if (!gameState.currentSlot) {
    alert('Lütfen önce bir kutu seçin');
    return;
  }
  socket.emit('newGame', { slot: gameState.currentSlot });
  document.getElementById('gameStatus').textContent = 'Oyun Durumu: Yeni Oyun Başlatılıyor...';
});

document.getElementById('btnPlaceBet').addEventListener('click', () => {
  if (!gameState.currentSlot) {
    alert('Lütfen önce bir kutu seçin');
    return;
  }
  const bet = prompt('Bahis miktarını girin (100-10000):');
  if (bet && !isNaN(bet)) {
    socket.emit('placeBet', { slot: gameState.currentSlot, amount: parseInt(bet) });
  }
});

// Hit, Stand, Double, Split butonları
document.querySelectorAll('.btn-hit').forEach((button, index) => {
  button.addEventListener('click', () => {
    const slot = index + 1;
    if (gameState.playerSlots.has(slot)) {
      socket.emit('playerHit', { slot });
    }
  });
});

document.querySelectorAll('.btn-stand').forEach((button, index) => {
  button.addEventListener('click', () => {
    const slot = index + 1;
    if (gameState.playerSlots.has(slot)) {
      socket.emit('playerStand', { slot });
      enablePlayerActions(slot, false);
    }
  });
});

document.querySelectorAll('.btn-double').forEach((button, index) => {
  button.addEventListener('click', () => {
    const slot = index + 1;
    if (gameState.playerSlots.has(slot)) {
      socket.emit('playerDouble', { slot });
      enablePlayerActions(slot, false);
    }
  });
});

document.querySelectorAll('.btn-split').forEach((button, index) => {
  button.addEventListener('click', () => {
    const slot = index + 1;
    if (gameState.playerSlots.has(slot)) {
      socket.emit('playerSplit', { slot });
    }
  });
});

// Allow clicking on empty player boxes to claim the seat (multiple seats allowed)
document.querySelectorAll('.player-box').forEach((box) => {
  box.addEventListener('click', () => {
    const statusEl = box.querySelector('.player-status');
    const statusText = statusEl ? statusEl.textContent.trim() : '';
    const slot = parseInt(box.id.replace('player-', ''), 10);

    // Eğer bu slot'u sahibi ise, aktif slot olarak ayarla
    if (gameState.playerSlots.has(slot)) {
      gameState.currentSlot = slot;
      console.log(`Aktif slot değişti: ${slot}`);
      return;
    }

    // Boş ise talep gönder
    if (statusText === 'Boş') {
      socket.emit('claimSeat', { slot });
    } else {
      alert('Bu kutu dolu');
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
