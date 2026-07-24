/**
 * Real-Time Multiplayer Housie Data & Engine Manager
 * Manages game state, room creation, joining, ticket assignment,
 * 3-second automatic number generation timer, server-side claim validation,
 * winner tracking, and cross-tab/WebSocket real-time synchronization.
 */

import { generateTambolaTicket, validateMarkNumber, evaluateWinningCategories } from '../utils/tambolaEngine';
import { stompService } from './stompService';

const HOUSIE_STORAGE_KEY = 'housie_rooms_db';
const housieChannel = new BroadcastChannel('housie_realtime_network');

// Active local room timers for host instances
const hostTimers = new Map();
// Active tab callbacks for room updates
const roomCallbacks = new Map();

function getStoredHousieDB() {
  try {
    const data = localStorage.getItem(HOUSIE_STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

function saveHousieDB(dbData) {
  try {
    localStorage.setItem(HOUSIE_STORAGE_KEY, JSON.stringify(dbData));
  } catch (e) {
    console.error('Failed to save Housie state:', e);
  }
}

function broadcastHousieRoom(roomCode, roomData) {
  // 1. Post to BroadcastChannel for multi-tab sync
  housieChannel.postMessage({ type: 'HOUSIE_ROOM_UPDATE', roomCode, data: roomData });

  // 2. STOMP Send if connected to Spring Boot backend
  if (stompService.connected) {
    stompService.send(`/app/room/${roomCode}/update`, roomData);
  }

  // 3. Local tab callbacks
  notifyLocalCallbacks(roomCode, roomData);
}

function notifyLocalCallbacks(roomCode, roomData) {
  if (roomCallbacks.has(roomCode)) {
    const callbacks = roomCallbacks.get(roomCode);
    callbacks.forEach((cb) => {
      try {
        cb(roomData);
      } catch (err) {
        console.error('Callback error:', err);
      }
    });
  }
}

// Global listener for BroadcastChannel messages
housieChannel.onmessage = (event) => {
  if (event.data && event.data.type === 'HOUSIE_ROOM_UPDATE') {
    const { roomCode, data } = event.data;
    notifyLocalCallbacks(roomCode, data);
  }
};

export function generate6DigitCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export const housieDb = {
  /**
   * Create a new Housie Room
   */
  async createRoom(config, hostUser) {
    const db = getStoredHousieDB();
    const roomCode = generate6DigitCode();

    const hostPlayerId = hostUser.uid || `user_${Date.now()}`;
    const hostTicket = generateTambolaTicket();

    const newRoom = {
      roomCode,
      gameName: config.gameName || `${hostUser.name}'s Housie Party`,
      hostId: hostPlayerId,
      hostName: hostUser.name || 'Host',
      maxPlayers: config.maxPlayers || null, // null = unlimited
      callingInterval: config.callingInterval || 3000,
      autoCalling: config.autoCalling !== false,
      categories: config.categories || ['Early Five', 'Top Line', 'Middle Line', 'Bottom Line', 'Full House'],
      status: 'WAITING', // 'WAITING', 'PLAYING', 'FINISHED'
      createdAt: Date.now(),
      sequence: [],
      currentCallIndex: -1,
      currentNumber: null,
      calledNumbers: [],
      players: {
        [hostPlayerId]: {
          playerId: hostPlayerId,
          nickname: hostUser.name || 'Host',
          isHost: true,
          ticket: hostTicket,
          markedNumbers: [],
          joinedAt: Date.now(),
          wins: []
        }
      },
      winners: {}, // { 'Early Five': { playerId, nickname, category, time } }
      lastWinnerEvent: null
    };

    db[roomCode] = newRoom;
    saveHousieDB(db);
    broadcastHousieRoom(roomCode, newRoom);

    return roomCode;
  },

  /**
   * Join an existing Housie Room
   */
  async joinRoom(roomCode, nickname, userId) {
    const db = getStoredHousieDB();
    const room = db[roomCode];

    if (!room) {
      throw new Error('Room not found. Please check the room code.');
    }

    if (room.status !== 'WAITING') {
      throw new Error('This room is locked because the game has already started.');
    }

    const playerId = userId || `user_${Date.now()}`;

    // Check player capacity if maxPlayers set
    const currentCount = Object.keys(room.players || {}).length;
    if (room.maxPlayers && currentCount >= room.maxPlayers && !room.players[playerId]) {
      throw new Error(`Room is full (Max limit: ${room.maxPlayers} players).`);
    }

    // Generate unique random ticket for player if not already joined
    if (!room.players[playerId]) {
      room.players[playerId] = {
        playerId,
        nickname: nickname || `Player ${currentCount + 1}`,
        isHost: room.hostId === playerId,
        ticket: generateTambolaTicket(),
        markedNumbers: [],
        joinedAt: Date.now(),
        wins: []
      };

      db[roomCode] = room;
      saveHousieDB(db);
      broadcastHousieRoom(roomCode, room);
    }

    return room;
  },

  /**
   * Start Game by Host (Locks the room and initiates number calling)
   */
  async startGame(roomCode, hostId) {
    const db = getStoredHousieDB();
    const room = db[roomCode];

    if (!room) throw new Error('Room not found');
    if (room.hostId !== hostId) throw new Error('Only the Host can start the game');
    if (room.status === 'PLAYING') return;

    // Lock Room & prepare 1-90 sequence
    const numbersArray = Array.from({ length: 90 }, (_, i) => i + 1);
    // Shuffle array (Fisher-Yates)
    for (let i = numbersArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [numbersArray[i], numbersArray[j]] = [numbersArray[j], numbersArray[i]];
    }

    room.status = 'PLAYING';
    room.sequence = numbersArray;
    room.currentCallIndex = -1;
    room.calledNumbers = [];
    room.currentNumber = null;
    room.gameStartedAt = Date.now();

    db[roomCode] = room;
    saveHousieDB(db);
    broadcastHousieRoom(roomCode, room);

    // Launch host background timer for calling numbers
    this.startCallingLoop(roomCode);
  },

  /**
   * Automatic Number Calling Loop
   */
  startCallingLoop(roomCode) {
    if (hostTimers.has(roomCode)) {
      clearInterval(hostTimers.get(roomCode));
    }

    const timer = setInterval(() => {
      const db = getStoredHousieDB();
      const room = db[roomCode];

      if (!room || room.status !== 'PLAYING') {
        clearInterval(timer);
        hostTimers.delete(roomCode);
        return;
      }

      const nextIndex = room.currentCallIndex + 1;
      if (nextIndex >= room.sequence.length) {
        // All 90 numbers called
        room.status = 'FINISHED';
        clearInterval(timer);
        hostTimers.delete(roomCode);
        db[roomCode] = room;
        saveHousieDB(db);
        broadcastHousieRoom(roomCode, room);
        return;
      }

      const nextNum = room.sequence[nextIndex];
      room.currentCallIndex = nextIndex;
      room.currentNumber = nextNum;
      room.calledNumbers.push(nextNum);
      room.lastCallTimestamp = Date.now();

      db[roomCode] = room;
      saveHousieDB(db);
      broadcastHousieRoom(roomCode, room);
    }, 3000);

    hostTimers.set(roomCode, timer);
  },

  /**
   * Mark Number on Ticket (with Server-Side Validation)
   */
  async markNumber(roomCode, playerId, number) {
    const db = getStoredHousieDB();
    const room = db[roomCode];

    if (!room) throw new Error('Room not found');
    const player = room.players[playerId];
    if (!player) throw new Error('Player not found in room');

    const calledSet = new Set(room.calledNumbers);
    const markedSet = new Set(player.markedNumbers);

    // Server-Side Validation
    const validation = validateMarkNumber(player.ticket, calledSet, markedSet, number);
    if (!validation.valid) {
      throw new Error(validation.reason);
    }

    // Accept mark
    player.markedNumbers.push(number);
    markedSet.add(number);

    // Auto Evaluate Winning Categories
    const newWins = evaluateWinningCategories(player.ticket, markedSet, room.winners);

    if (newWins.length > 0) {
      newWins.forEach((cat) => {
        if (!room.winners[cat]) {
          const winObj = {
            category: cat,
            playerId,
            nickname: player.nickname,
            winningTime: Date.now(),
            numberCalledAtWin: room.currentNumber
          };
          room.winners[cat] = winObj;
          player.wins.push(cat);

          room.lastWinnerEvent = winObj;

          if (cat === 'Full House') {
            room.status = 'FINISHED';
            if (hostTimers.has(roomCode)) {
              clearInterval(hostTimers.get(roomCode));
              hostTimers.delete(roomCode);
            }
          }
        }
      });
    }

    db[roomCode] = room;
    saveHousieDB(db);
    broadcastHousieRoom(roomCode, room);

    return { success: true, newWins };
  },

  /**
   * Subscribe to real-time room updates
   */
  subscribeToRoom(roomCode, callback) {
    if (!roomCallbacks.has(roomCode)) {
      roomCallbacks.set(roomCode, new Set());
    }
    roomCallbacks.get(roomCode).add(callback);

    // Initial delivery
    const db = getStoredHousieDB();
    if (db[roomCode]) {
      callback(db[roomCode]);
    }

    return () => {
      if (roomCallbacks.has(roomCode)) {
        roomCallbacks.get(roomCode).delete(callback);
      }
    };
  }
};
