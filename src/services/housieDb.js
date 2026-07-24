/**
 * Real-Time Multiplayer Housie Data & Engine Manager
 * 
 * Multi-Tiered Synchronization Architecture:
 * 1. Vite Dev Server Memory API (/api/housie-rooms) - Instant local network/incognito sync
 * 2. Firebase Firestore ('games' & 'housie_rooms' collections)
 * 3. High-Availability Cloud KV Relay Network (https://kvdb.io)
 * 4. Browser LocalStorage & BroadcastChannel
 */

import { doc, setDoc, getDoc, onSnapshot } from 'firebase/firestore';
import { db, isRealFirebase } from '../firebase/config';
import { generateTambolaTicket, validateMarkNumber, evaluateWinningCategories } from '../utils/tambolaEngine';
import { stompService } from './stompService';

const HOUSIE_STORAGE_KEY = 'housie_rooms_db';
const KV_STORE_BUCKET = 'HousieBingoNexus2026';
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
    console.error('Failed to save Housie local state:', e);
  }
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

/**
 * Dev Server Memory API Helpers (/api/housie-rooms)
 */
async function saveToDevServer(roomCode, roomData) {
  try {
    await fetch('/api/housie-rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(roomData)
    });
  } catch {
    // Silent catch
  }
}

async function getFromDevServer(roomCode) {
  try {
    const res = await fetch(`/api/housie-rooms/${roomCode}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.roomCode) return data;
    }
  } catch {
    // Silent catch
  }
  return null;
}

/**
 * Cloud KV Store Backup Helpers
 */
async function saveToCloudKV(roomCode, roomData) {
  try {
    await fetch(`https://kvdb.io/${KV_STORE_BUCKET}/HOUSIE_${roomCode}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(roomData)
    });
  } catch {
    // Silent catch
  }
}

async function getFromCloudKV(roomCode) {
  try {
    const res = await fetch(`https://kvdb.io/${KV_STORE_BUCKET}/HOUSIE_${roomCode}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.roomCode) return data;
    }
  } catch {
    // Silent catch
  }
  return null;
}

export function generate6DigitCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export const housieDb = {
  /**
   * Create a new Housie Room
   */
  async createRoom(config, hostUser) {
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
      winners: {},
      lastWinnerEvent: null
    };

    // 1. Dev Server Memory API
    await saveToDevServer(roomCode, newRoom);

    // 2. Firebase Firestore
    if (isRealFirebase && db) {
      try {
        await setDoc(doc(db, 'games', `HOUSIE_${roomCode}`), newRoom);
        await setDoc(doc(db, 'housie_rooms', roomCode), newRoom);
      } catch (err) {
        console.error('Firestore createRoom error:', err);
      }
    }

    // 3. Cloud KV Store & Local Storage
    saveToCloudKV(roomCode, newRoom);

    const localDb = getStoredHousieDB();
    localDb[roomCode] = newRoom;
    saveHousieDB(localDb);

    // Broadcast
    housieChannel.postMessage({ type: 'HOUSIE_ROOM_UPDATE', roomCode, data: newRoom });
    if (stompService.connected) {
      stompService.send(`/app/room/${roomCode}/update`, newRoom);
    }
    notifyLocalCallbacks(roomCode, newRoom);

    return roomCode;
  },

  /**
   * Fetch Room Data across all layers
   */
  async getRoomData(roomCode) {
    const cleanCode = (roomCode || '').trim().toUpperCase();
    if (!cleanCode) return null;

    // Layer 1: Dev Server Memory API
    const devServerData = await getFromDevServer(cleanCode);
    if (devServerData) return devServerData;

    // Layer 2: Firebase Firestore check
    if (isRealFirebase && db) {
      try {
        const snap1 = await getDoc(doc(db, 'games', `HOUSIE_${cleanCode}`));
        if (snap1.exists()) return snap1.data();

        const snap2 = await getDoc(doc(db, 'housie_rooms', cleanCode));
        if (snap2.exists()) return snap2.data();
      } catch (err) {
        console.warn('Firestore getRoom warning:', err);
      }
    }

    // Layer 3: Cloud KV Store check
    const kvData = await getFromCloudKV(cleanCode);
    if (kvData) return kvData;

    // Layer 4: Local Storage check
    const localDb = getStoredHousieDB();
    return localDb[cleanCode] || null;
  },

  /**
   * Sync Room Data across all layers
   */
  async syncRoom(roomCode, roomData) {
    const cleanCode = (roomCode || '').trim().toUpperCase();

    saveToDevServer(cleanCode, roomData);

    if (isRealFirebase && db) {
      try {
        await setDoc(doc(db, 'games', `HOUSIE_${cleanCode}`), roomData, { merge: true });
        await setDoc(doc(db, 'housie_rooms', cleanCode), roomData, { merge: true });
      } catch (err) {
        console.error('Firestore syncRoom error:', err);
      }
    }

    saveToCloudKV(cleanCode, roomData);

    const localDb = getStoredHousieDB();
    localDb[cleanCode] = roomData;
    saveHousieDB(localDb);

    housieChannel.postMessage({ type: 'HOUSIE_ROOM_UPDATE', roomCode: cleanCode, data: roomData });
    if (stompService.connected) {
      stompService.send(`/app/room/${cleanCode}/update`, roomData);
    }
    notifyLocalCallbacks(cleanCode, roomData);
  },

  /**
   * Join an existing Housie Room
   */
  async joinRoom(roomCode, nickname, userId) {
    const cleanCode = (roomCode || '').trim().toUpperCase();
    let room = await this.getRoomData(cleanCode);

    if (!room) {
      throw new Error(`Room (${cleanCode}) not found. Please verify the code or check if the host created it.`);
    }

    const playerId = userId || `user_${Date.now()}`;

    // If player is already inside room, return current room state
    if (room.players && room.players[playerId]) {
      return room;
    }

    if (room.status !== 'WAITING') {
      throw new Error('This room is locked because the game has already started.');
    }

    // Capacity check
    const currentCount = Object.keys(room.players || {}).length;
    if (room.maxPlayers && currentCount >= room.maxPlayers) {
      throw new Error(`Room is full (Max limit: ${room.maxPlayers} players).`);
    }

    // Add new player with unique ticket
    const newPlayer = {
      playerId,
      nickname: nickname || `Player ${currentCount + 1}`,
      isHost: room.hostId === playerId,
      ticket: generateTambolaTicket(),
      markedNumbers: [],
      joinedAt: Date.now(),
      wins: []
    };

    room.players[playerId] = newPlayer;

    await this.syncRoom(cleanCode, room);
    return room;
  },

  /**
   * Start Game by Host
   */
  async startGame(roomCode, hostId) {
    const cleanCode = (roomCode || '').trim().toUpperCase();
    let room = await this.getRoomData(cleanCode);

    if (!room) throw new Error('Room not found');
    if (room.hostId !== hostId) throw new Error('Only the Host can start the game');
    if (room.status === 'PLAYING') return;

    const numbersArray = Array.from({ length: 90 }, (_, i) => i + 1);
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

    await this.syncRoom(cleanCode, room);
    this.startCallingLoop(cleanCode);
  },

  /**
   * Automatic Number Calling Loop
   */
  startCallingLoop(roomCode) {
    const cleanCode = (roomCode || '').trim().toUpperCase();

    if (hostTimers.has(cleanCode)) {
      clearInterval(hostTimers.get(cleanCode));
    }

    const timer = setInterval(async () => {
      let room = await this.getRoomData(cleanCode);

      if (!room || room.status !== 'PLAYING') {
        clearInterval(timer);
        hostTimers.delete(cleanCode);
        return;
      }

      const nextIndex = room.currentCallIndex + 1;
      if (nextIndex >= room.sequence.length) {
        room.status = 'FINISHED';
        clearInterval(timer);
        hostTimers.delete(cleanCode);
      } else {
        const nextNum = room.sequence[nextIndex];
        room.currentCallIndex = nextIndex;
        room.currentNumber = nextNum;
        room.calledNumbers.push(nextNum);
        room.lastCallTimestamp = Date.now();
      }

      await this.syncRoom(cleanCode, room);
    }, 3000);

    hostTimers.set(cleanCode, timer);
  },

  /**
   * Mark Number on Ticket (with Server-Side Validation)
   */
  async markNumber(roomCode, playerId, number) {
    const cleanCode = (roomCode || '').trim().toUpperCase();
    let room = await this.getRoomData(cleanCode);

    if (!room) throw new Error('Room not found');
    const player = room.players[playerId];
    if (!player) throw new Error('Player not found in room');

    const calledSet = new Set(room.calledNumbers);
    const markedSet = new Set(player.markedNumbers);

    // Validation
    const validation = validateMarkNumber(player.ticket, calledSet, markedSet, number);
    if (!validation.valid) {
      throw new Error(validation.reason);
    }

    player.markedNumbers.push(number);
    markedSet.add(number);

    // Auto Evaluate Wins
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
            if (hostTimers.has(cleanCode)) {
              clearInterval(hostTimers.get(cleanCode));
              hostTimers.delete(cleanCode);
            }
          }
        }
      });
    }

    await this.syncRoom(cleanCode, room);
    return { success: true, newWins };
  },

  /**
   * Subscribe to real-time room updates
   */
  subscribeToRoom(roomCode, callback) {
    const cleanCode = (roomCode || '').trim().toUpperCase();

    if (!roomCallbacks.has(cleanCode)) {
      roomCallbacks.set(cleanCode, new Set());
    }
    roomCallbacks.get(cleanCode).add(callback);

    let unsubFirestore1 = null;
    let unsubFirestore2 = null;

    if (isRealFirebase && db) {
      try {
        unsubFirestore1 = onSnapshot(doc(db, 'games', `HOUSIE_${cleanCode}`), (snapshot) => {
          if (snapshot.exists()) {
            notifyLocalCallbacks(cleanCode, snapshot.data());
          }
        });
        unsubFirestore2 = onSnapshot(doc(db, 'housie_rooms', cleanCode), (snapshot) => {
          if (snapshot.exists()) {
            notifyLocalCallbacks(cleanCode, snapshot.data());
          }
        });
      } catch (err) {
        console.error('Firestore snapshot listener error:', err);
      }
    }

    // Dev Server & Cloud Polling (every 1 second) for fast multi-window / incognito sync
    const pollTimer = setInterval(async () => {
      const devData = await getFromDevServer(cleanCode);
      if (devData) {
        notifyLocalCallbacks(cleanCode, devData);
      }
    }, 1000);

    // Initial delivery
    this.getRoomData(cleanCode).then((localData) => {
      if (localData) {
        callback(localData);
      }
    });

    return () => {
      if (unsubFirestore1) unsubFirestore1();
      if (unsubFirestore2) unsubFirestore2();
      clearInterval(pollTimer);
      if (roomCallbacks.has(cleanCode)) {
        roomCallbacks.get(cleanCode).delete(callback);
      }
    };
  }
};
