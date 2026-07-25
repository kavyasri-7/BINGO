import {
  doc,
  setDoc,
  getDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db, isRealFirebase } from '../firebase/config';
import { generateTambolaTicket, validateMarkNumber, evaluateWinningCategories } from '../utils/tambolaEngine';

// Unique 6-digit room code generator
export function generate6DigitCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Firestore Serialization Helpers
 * Firestore does NOT allow 2D nested arrays (`ticket: [[...], [...], [...]]`).
 * We convert 2D array `ticket` to `ticketJson` string before writing to Firestore,
 * and restore `ticket` 2D array when reading from Firestore.
 */
function serializeRoomForFirestore(roomData) {
  if (!roomData) return null;
  const cloned = JSON.parse(JSON.stringify(roomData));
  if (cloned.players && typeof cloned.players === 'object') {
    Object.keys(cloned.players).forEach((id) => {
      const p = cloned.players[id];
      if (p) {
        if (Array.isArray(p.ticket)) {
          p.ticketJson = JSON.stringify(p.ticket);
          delete p.ticket;
        }
      }
    });
  }
  return cloned;
}

function deserializeRoomFromFirestore(roomData) {
  if (!roomData) return null;
  const cloned = JSON.parse(JSON.stringify(roomData));
  if (cloned.players && typeof cloned.players === 'object') {
    Object.keys(cloned.players).forEach((id) => {
      const p = cloned.players[id];
      if (p) {
        if (p.ticketJson) {
          try {
            p.ticket = JSON.parse(p.ticketJson);
          } catch {
            p.ticket = [];
          }
        } else if (!p.ticket) {
          p.ticket = [];
        }
      }
    });
  }
  return cloned;
}

// ----------------------------------------------------
// LOCAL MOCK HOUSIE SIMULATOR (Offline / Local Fallback)
// ----------------------------------------------------
const HOUSIE_MOCK_KEY = 'housie_mock_db';
const bc = new BroadcastChannel('housie_network_simulator');
const hostTimers = new Map();
const activeCallbacks = {};

function registerCallback(roomCode, callback) {
  if (!activeCallbacks[roomCode]) {
    activeCallbacks[roomCode] = new Set();
  }
  activeCallbacks[roomCode].add(callback);
}

function unregisterCallback(roomCode, callback) {
  if (activeCallbacks[roomCode]) {
    activeCallbacks[roomCode].delete(callback);
    if (activeCallbacks[roomCode].size === 0) {
      delete activeCallbacks[roomCode];
    }
  }
}

function getMockDB() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const data = localStorage.getItem(HOUSIE_MOCK_KEY);
      return data ? JSON.parse(data) : {};
    }
  } catch {}
  return {};
}

function saveMockDB(dbData) {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem(HOUSIE_MOCK_KEY, JSON.stringify(dbData));
    }
  } catch (e) {
    console.error('Failed to save Housie mock state:', e);
  }
}

function broadcastUpdate(roomCode, data) {
  // 1. BroadcastChannel for other tabs
  try {
    bc.postMessage({ type: 'HOUSIE_ROOM_UPDATE', roomCode, data });
  } catch {}

  // 2. Direct callbacks for current tab
  if (activeCallbacks[roomCode]) {
    activeCallbacks[roomCode].forEach((cb) => {
      try {
        cb(data);
      } catch (err) {
        console.error('Error invoking local callback:', err);
      }
    });
  }
}

// BroadcastChannel listener
bc.onmessage = (event) => {
  if (event.data && event.data.type === 'HOUSIE_ROOM_UPDATE') {
    const { roomCode, data } = event.data;
    if (activeCallbacks[roomCode]) {
      activeCallbacks[roomCode].forEach((cb) => {
        try {
          cb(data);
        } catch (err) {
          console.error('Error in bc listener:', err);
        }
      });
    }
  }
};

const mockHousieDb = {
  createRoom: async (config, hostUser) => {
    const roomCode = generate6DigitCode();
    const hostPlayerId = hostUser.uid || `user_${Date.now()}`;
    const hostTicket = generateTambolaTicket();

    const newRoom = {
      roomCode,
      gameName: config.gameName || `${hostUser.name}'s Housie Party`,
      hostId: hostPlayerId,
      hostName: hostUser.name || 'Host',
      maxPlayers: config.maxPlayers || null,
      callingInterval: config.callingInterval || 3000,
      autoCalling: config.autoCalling !== false,
      categories: config.categories || ['Early Five', 'Top Line', 'Middle Line', 'Bottom Line', 'Full House'],
      status: 'WAITING',
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

    const mockDatabase = getMockDB();
    mockDatabase[roomCode] = newRoom;
    saveMockDB(mockDatabase);
    broadcastUpdate(roomCode, newRoom);
    return roomCode;
  },

  joinRoom: async (roomCode, nickname, userId) => {
    const cleanCode = (roomCode || '').trim().toUpperCase();
    const mockDatabase = getMockDB();
    let room = mockDatabase[cleanCode];

    if (!room) {
      throw new Error(`Room (${cleanCode}) not found. Please verify the code or check if the host created it.`);
    }

    const playerId = userId || `user_${Date.now()}`;
    if (room.players && room.players[playerId]) {
      return room;
    }

    if (room.status !== 'WAITING') {
      throw new Error('This room is locked because the game has already started.');
    }

    const currentCount = Object.keys(room.players || {}).length;
    if (room.maxPlayers && currentCount >= room.maxPlayers) {
      throw new Error(`Room is full (Max limit: ${room.maxPlayers} players).`);
    }

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
    mockDatabase[cleanCode] = room;
    saveMockDB(mockDatabase);
    broadcastUpdate(cleanCode, room);
    return room;
  },

  startGame: async (roomCode, hostId) => {
    const cleanCode = (roomCode || '').trim().toUpperCase();
    const mockDatabase = getMockDB();
    let room = mockDatabase[cleanCode];

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

    mockDatabase[cleanCode] = room;
    saveMockDB(mockDatabase);
    broadcastUpdate(cleanCode, room);
    startCallingLoop(cleanCode);
  },

  markNumber: async (roomCode, playerId, number) => {
    const cleanCode = (roomCode || '').trim().toUpperCase();
    const mockDatabase = getMockDB();
    let room = mockDatabase[cleanCode];

    if (!room) throw new Error('Room not found');
    const player = room.players[playerId];
    if (!player) throw new Error('Player not found in room');

    const calledSet = new Set(room.calledNumbers);
    const markedSet = new Set(player.markedNumbers);

    const validation = validateMarkNumber(player.ticket, calledSet, markedSet, number);
    if (!validation.valid) {
      throw new Error(validation.reason);
    }

    player.markedNumbers.push(number);
    markedSet.add(number);

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

    mockDatabase[cleanCode] = room;
    saveMockDB(mockDatabase);
    broadcastUpdate(cleanCode, room);
    return { success: true, newWins };
  },

  subscribeToRoom: (roomCode, callback) => {
    const cleanCode = (roomCode || '').trim().toUpperCase();

    setTimeout(() => {
      const mockDatabase = getMockDB();
      const room = mockDatabase[cleanCode];
      if (room) callback(room);
    }, 0);

    registerCallback(cleanCode, callback);

    const handleStorage = (event) => {
      if (event.key === HOUSIE_MOCK_KEY) {
        const mockDatabase = getMockDB();
        const room = mockDatabase[cleanCode];
        if (room) callback(room);
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorage);
    }

    return () => {
      unregisterCallback(cleanCode, callback);
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', handleStorage);
      }
    };
  }
};

// ----------------------------------------------------
// REAL FIREBASE FIRESTORE OPERATIONS
// ----------------------------------------------------
const firebaseHousieDb = {
  createRoom: async (config, hostUser) => {
    let roomCode = generate6DigitCode();
    let codeAvailable = false;
    let attempts = 0;

    // Check code uniqueness in Firestore
    while (!codeAvailable && attempts < 5) {
      try {
        const roomRef = doc(db, 'housie_rooms', roomCode);
        const roomSnap = await getDoc(roomRef);
        if (!roomSnap.exists()) {
          codeAvailable = true;
        } else {
          roomCode = generate6DigitCode();
          attempts++;
        }
      } catch {
        codeAvailable = true;
      }
    }

    const hostPlayerId = hostUser.uid || `user_${Date.now()}`;
    const hostTicket = generateTambolaTicket();

    const newRoom = {
      roomCode,
      gameName: config.gameName || `${hostUser.name}'s Housie Party`,
      hostId: hostPlayerId,
      hostName: hostUser.name || 'Host',
      maxPlayers: config.maxPlayers || null,
      callingInterval: config.callingInterval || 3000,
      autoCalling: config.autoCalling !== false,
      categories: config.categories || ['Early Five', 'Top Line', 'Middle Line', 'Bottom Line', 'Full House'],
      status: 'WAITING',
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

    // Serialize for Firestore (convert 2D ticket arrays to ticketJson)
    const serializedRoom = serializeRoomForFirestore(newRoom);

    // Save to Firestore collections 'housie_rooms' & 'games'
    await Promise.all([
      setDoc(doc(db, 'housie_rooms', roomCode), serializedRoom),
      setDoc(doc(db, 'games', `HOUSIE_${roomCode}`), serializedRoom)
    ]);

    // Also update mockDb local cache for instant local tab sync
    const mockDatabase = getMockDB();
    mockDatabase[roomCode] = newRoom;
    saveMockDB(mockDatabase);
    broadcastUpdate(roomCode, newRoom);

    return roomCode;
  },

  joinRoom: async (roomCode, nickname, userId) => {
    const cleanCode = (roomCode || '').trim().toUpperCase();
    let room = null;

    try {
      let snap = await getDoc(doc(db, 'housie_rooms', cleanCode));
      if (!snap.exists()) {
        snap = await getDoc(doc(db, 'games', `HOUSIE_${cleanCode}`));
      }
      if (snap.exists()) {
        room = deserializeRoomFromFirestore(snap.data());
      }
    } catch (err) {
      console.warn('Firestore joinRoom lookup warning:', err);
    }

    // Fallback to local mock database if not found in Firestore
    if (!room) {
      const mockDatabase = getMockDB();
      room = mockDatabase[cleanCode];
    }

    if (!room) {
      throw new Error(`Room (${cleanCode}) not found. Please verify the code or check if the host created it.`);
    }

    const playerId = userId || `user_${Date.now()}`;
    if (room.players && room.players[playerId]) {
      return room;
    }

    if (room.status !== 'WAITING') {
      throw new Error('This room is locked because the game has already started.');
    }

    const currentCount = Object.keys(room.players || {}).length;
    if (room.maxPlayers && currentCount >= room.maxPlayers) {
      throw new Error(`Room is full (Max limit: ${room.maxPlayers} players).`);
    }

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

    // Sync to Firestore
    try {
      const serialized = serializeRoomForFirestore(room);
      await Promise.all([
        setDoc(doc(db, 'housie_rooms', cleanCode), serialized, { merge: true }),
        setDoc(doc(db, 'games', `HOUSIE_${cleanCode}`), serialized, { merge: true })
      ]);
    } catch (err) {
      console.error('Firestore joinRoom update error:', err);
    }

    // Sync local cache & broadcast
    const mockDatabase = getMockDB();
    mockDatabase[cleanCode] = room;
    saveMockDB(mockDatabase);
    broadcastUpdate(cleanCode, room);

    return room;
  },

  startGame: async (roomCode, hostId) => {
    const cleanCode = (roomCode || '').trim().toUpperCase();
    let room = null;

    try {
      let snap = await getDoc(doc(db, 'housie_rooms', cleanCode));
      if (!snap.exists()) snap = await getDoc(doc(db, 'games', `HOUSIE_${cleanCode}`));
      if (snap.exists()) room = deserializeRoomFromFirestore(snap.data());
    } catch {}

    if (!room) {
      const mockDatabase = getMockDB();
      room = mockDatabase[cleanCode];
    }

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

    try {
      const serialized = serializeRoomForFirestore(room);
      await Promise.all([
        setDoc(doc(db, 'housie_rooms', cleanCode), serialized, { merge: true }),
        setDoc(doc(db, 'games', `HOUSIE_${cleanCode}`), serialized, { merge: true })
      ]);
    } catch (err) {
      console.error('Firestore startGame error:', err);
    }

    const mockDatabase = getMockDB();
    mockDatabase[cleanCode] = room;
    saveMockDB(mockDatabase);
    broadcastUpdate(cleanCode, room);

    startCallingLoop(cleanCode);
  },

  markNumber: async (roomCode, playerId, number) => {
    const cleanCode = (roomCode || '').trim().toUpperCase();
    let room = null;

    try {
      let snap = await getDoc(doc(db, 'housie_rooms', cleanCode));
      if (!snap.exists()) snap = await getDoc(doc(db, 'games', `HOUSIE_${cleanCode}`));
      if (snap.exists()) room = deserializeRoomFromFirestore(snap.data());
    } catch {}

    if (!room) {
      const mockDatabase = getMockDB();
      room = mockDatabase[cleanCode];
    }

    if (!room) throw new Error('Room not found');
    const player = room.players[playerId];
    if (!player) throw new Error('Player not found in room');

    const calledSet = new Set(room.calledNumbers);
    const markedSet = new Set(player.markedNumbers);

    const validation = validateMarkNumber(player.ticket, calledSet, markedSet, number);
    if (!validation.valid) {
      throw new Error(validation.reason);
    }

    player.markedNumbers.push(number);
    markedSet.add(number);

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

    try {
      const serialized = serializeRoomForFirestore(room);
      await Promise.all([
        setDoc(doc(db, 'housie_rooms', cleanCode), serialized, { merge: true }),
        setDoc(doc(db, 'games', `HOUSIE_${cleanCode}`), serialized, { merge: true })
      ]);
    } catch (err) {
      console.error('Firestore markNumber error:', err);
    }

    const mockDatabase = getMockDB();
    mockDatabase[cleanCode] = room;
    saveMockDB(mockDatabase);
    broadcastUpdate(cleanCode, room);

    return { success: true, newWins };
  },

  subscribeToRoom: (roomCode, callback, onError) => {
    const cleanCode = (roomCode || '').trim().toUpperCase();

    // 1. Realtime Firestore listener
    let unsub1 = null;
    let unsub2 = null;
    try {
      unsub1 = onSnapshot(doc(db, 'housie_rooms', cleanCode), (snapshot) => {
        if (snapshot.exists()) {
          callback(deserializeRoomFromFirestore(snapshot.data()));
        }
      }, onError);

      unsub2 = onSnapshot(doc(db, 'games', `HOUSIE_${cleanCode}`), (snapshot) => {
        if (snapshot.exists()) {
          callback(deserializeRoomFromFirestore(snapshot.data()));
        }
      }, onError);
    } catch (err) {
      console.warn('Firestore snapshot listener warning:', err);
    }

    // 2. Local tab callback registration & initial delivery
    registerCallback(cleanCode, callback);

    setTimeout(() => {
      const mockDatabase = getMockDB();
      const room = mockDatabase[cleanCode];
      if (room) callback(room);
    }, 0);

    const handleStorage = (event) => {
      if (event.key === HOUSIE_MOCK_KEY) {
        const mockDatabase = getMockDB();
        const room = mockDatabase[cleanCode];
        if (room) callback(room);
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', handleStorage);
    }

    return () => {
      if (unsub1) unsub1();
      if (unsub2) unsub2();
      unregisterCallback(cleanCode, callback);
      if (typeof window !== 'undefined') {
        window.removeEventListener('storage', handleStorage);
      }
    };
  }
};

function startCallingLoop(roomCode) {
  const cleanCode = (roomCode || '').trim().toUpperCase();
  if (hostTimers.has(cleanCode)) {
    clearInterval(hostTimers.get(cleanCode));
  }

  const timer = setInterval(async () => {
    let room = null;
    if (isRealFirebase && db) {
      try {
        let snap = await getDoc(doc(db, 'housie_rooms', cleanCode));
        if (!snap.exists()) snap = await getDoc(doc(db, 'games', `HOUSIE_${cleanCode}`));
        if (snap.exists()) room = deserializeRoomFromFirestore(snap.data());
      } catch {}
    }

    if (!room) {
      const mockDatabase = getMockDB();
      room = mockDatabase[cleanCode];
    }

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

    if (isRealFirebase && db) {
      try {
        const serialized = serializeRoomForFirestore(room);
        await Promise.all([
          setDoc(doc(db, 'housie_rooms', cleanCode), serialized, { merge: true }),
          setDoc(doc(db, 'games', `HOUSIE_${cleanCode}`), serialized, { merge: true })
        ]);
      } catch {}
    }

    const mockDatabase = getMockDB();
    mockDatabase[cleanCode] = room;
    saveMockDB(mockDatabase);
    broadcastUpdate(cleanCode, room);
  }, 3000);

  hostTimers.set(cleanCode, timer);
}

// Export housieDb matching gameDb pattern from db.js
export const housieDb = isRealFirebase ? firebaseHousieDb : mockHousieDb;
export { isRealFirebase };
