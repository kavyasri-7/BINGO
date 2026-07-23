import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  deleteDoc,
} from 'firebase/firestore';
import { db, isRealFirebase } from '../firebase/config';
import { generateBoard, checkBingo } from '../utils/bingoEngine';

// Unique 6-character room code generator
export function generateRoomCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// ----------------------------------------------------
// LOCAL MOCK FIRESTORE SIMULATOR (for Offline Demo)
// ----------------------------------------------------
const MOCK_DB_KEY = 'bingo_mock_db';
const bc = new BroadcastChannel('bingo_network_simulator');

// Registry of active subscriptions in the current tab
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
  const data = localStorage.getItem(MOCK_DB_KEY);
  return data ? JSON.parse(data) : {};
}

function saveMockDB(dbData) {
  localStorage.setItem(MOCK_DB_KEY, JSON.stringify(dbData));
}

function broadcastUpdate(roomCode, data) {
  // 1. Post to BroadcastChannel for OTHER tabs/windows
  bc.postMessage({ type: 'ROOM_UPDATE', roomCode, data });
  
  // 2. Fire local callbacks directly for THIS tab
  if (activeCallbacks[roomCode]) {
    activeCallbacks[roomCode].forEach((cb) => {
      try {
        cb(data);
      } catch (err) {
        console.error('Error invoking local mock callback:', err);
      }
    });
  }
}

// Helper to normalize legacy room objects (for backwards compatibility if any exist in storage)
function normalizeRoomData(room) {
  if (!room) return null;
  
  const boardSize = Number(room.boardSize) || 5;
  const maxPlayers = Number(room.maxPlayers) || 2;
  
  let playersList = [];
  if (Array.isArray(room.players)) {
    playersList = room.players;
  } else if (room.players && typeof room.players === 'object') {
    if (room.players.player1) {
      playersList.push({
        uid: room.players.player1.uid,
        name: room.players.player1.name,
        board: room.players.player1.board || generateBoard(boardSize),
        isReady: true,
        joinedAt: Date.now() - 1000,
      });
    }
    if (room.players.player2) {
      playersList.push({
        uid: room.players.player2.uid,
        name: room.players.player2.name,
        board: room.players.player2.board || generateBoard(boardSize),
        isReady: true,
        joinedAt: Date.now(),
      });
    }
  }

  const hostId = room.hostId || (playersList[0] ? playersList[0].uid : null);
  const hostName = room.hostName || (playersList[0] ? playersList[0].name : 'Host');

  const completedLinesMap = room.completedLines || {};
  if (room.player1CompletedLines !== undefined && playersList[0]) {
    completedLinesMap[playersList[0].uid] = room.player1CompletedLines;
  }
  if (room.player2CompletedLines !== undefined && playersList[1]) {
    completedLinesMap[playersList[1].uid] = room.player2CompletedLines;
  }

  return {
    ...room,
    boardSize,
    maxPlayers,
    hostId,
    hostName,
    players: playersList,
    completedLines: completedLinesMap,
    turnIndex: typeof room.turnIndex === 'number' ? room.turnIndex : 0,
    crossedNumbers: room.crossedNumbers || [],
    moveHistory: room.moveHistory || [],
  };
}

// Mock implementation of db operations
const mockDb = {
  createRoom: async (playerName, playerUid, options = {}) => {
    const boardSize = Number(options.boardSize) || 5;
    const maxPlayers = Number(options.maxPlayers) || 2;
    const roomCode = generateRoomCode();
    const mockDatabase = getMockDB();

    const hostPlayer = {
      uid: playerUid,
      name: playerName,
      board: generateBoard(boardSize),
      isReady: true,
      joinedAt: Date.now(),
    };

    const newRoom = {
      roomCode,
      hostId: playerUid,
      hostName: playerName,
      boardSize,
      maxPlayers,
      gameStatus: 'waiting',
      players: [hostPlayer],
      completedLines: { [playerUid]: 0 },
      crossedNumbers: [],
      currentTurn: playerUid,
      turnIndex: 0,
      winner: null,
      moveHistory: [],
      createdAt: Date.now(),
    };

    mockDatabase[roomCode] = newRoom;
    saveMockDB(mockDatabase);
    broadcastUpdate(roomCode, newRoom);
    return roomCode;
  },

  joinRoom: async (roomCode, playerName, playerUid) => {
    const code = roomCode.toUpperCase();
    const mockDatabase = getMockDB();
    let room = normalizeRoomData(mockDatabase[code]);

    if (!room) {
      throw new Error('Room not found');
    }

    const existingIndex = room.players.findIndex(p => p.uid === playerUid);
    if (existingIndex !== -1) {
      // Player is already in room, update name if needed
      room.players[existingIndex].name = playerName;
      mockDatabase[code] = room;
      saveMockDB(mockDatabase);
      broadcastUpdate(code, room);
      return room;
    }

    // Check if room has reached maximum players
    if (room.players.length >= room.maxPlayers) {
      throw new Error('This room has reached its maximum number of players.');
    }

    // Add new player
    const newPlayer = {
      uid: playerUid,
      name: playerName,
      board: generateBoard(room.boardSize),
      isReady: false,
      joinedAt: Date.now(),
    };

    room.players.push(newPlayer);
    room.completedLines[playerUid] = 0;

    mockDatabase[code] = room;
    saveMockDB(mockDatabase);
    broadcastUpdate(code, room);
    return room;
  },

  toggleReady: async (roomCode, playerUid, isReady) => {
    const code = roomCode.toUpperCase();
    const mockDatabase = getMockDB();
    const room = normalizeRoomData(mockDatabase[code]);

    if (!room) throw new Error('Room not found');

    const player = room.players.find(p => p.uid === playerUid);
    if (player) {
      player.isReady = typeof isReady === 'boolean' ? isReady : !player.isReady;
      mockDatabase[code] = room;
      saveMockDB(mockDatabase);
      broadcastUpdate(code, room);
    }
    return room;
  },

  startGame: async (roomCode, hostUid) => {
    const code = roomCode.toUpperCase();
    const mockDatabase = getMockDB();
    const room = normalizeRoomData(mockDatabase[code]);

    if (!room) throw new Error('Room not found');
    if (room.hostId !== hostUid) throw new Error('Only the host can start the game');
    if (room.players.length < 2) throw new Error('Need at least 2 players to start');

    room.gameStatus = 'playing';
    room.currentTurn = room.players[0].uid;
    room.turnIndex = 0;

    mockDatabase[code] = room;
    saveMockDB(mockDatabase);
    broadcastUpdate(code, room);
    return room;
  },

  subscribeToRoom: (roomCode, callback) => {
    const code = roomCode.toUpperCase();

    // Return initial value in microtask
    setTimeout(() => {
      const mockDatabase = getMockDB();
      const room = normalizeRoomData(mockDatabase[code]);
      if (room) {
        callback(room);
      }
    }, 0);

    registerCallback(code, callback);

    const handleMessage = (event) => {
      if (event.data && event.data.type === 'ROOM_UPDATE' && event.data.roomCode === code) {
        callback(normalizeRoomData(event.data.data));
      }
    };

    bc.addEventListener('message', handleMessage);

    const handleStorage = (event) => {
      if (event.key === MOCK_DB_KEY) {
        const mockDatabase = getMockDB();
        const room = normalizeRoomData(mockDatabase[code]);
        if (room) {
          callback(room);
        }
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      unregisterCallback(code, callback);
      bc.removeEventListener('message', handleMessage);
      window.removeEventListener('storage', handleStorage);
    };
  },

  makeMove: async (roomCode, number, playerUid, playerName) => {
    const code = roomCode.toUpperCase();
    const mockDatabase = getMockDB();
    const room = normalizeRoomData(mockDatabase[code]);

    if (!room) throw new Error('Room not found');
    if (room.gameStatus !== 'playing') throw new Error('Game is not active');
    if (room.currentTurn !== playerUid) throw new Error('Not your turn');
    if (room.crossedNumbers.includes(number)) return room;

    room.crossedNumbers.push(number);

    // Calculate completed lines for all players
    const winners = [];
    room.players.forEach(player => {
      const result = checkBingo(player.board, room.crossedNumbers, room.boardSize);
      room.completedLines[player.uid] = result.count;
      if (result.isBingo) {
        winners.push(player);
      }
    });

    if (winners.length > 0) {
      // If player who made the move is among winners, they win; otherwise first winner
      const moveMakerWinner = winners.find(w => w.uid === playerUid);
      room.winner = moveMakerWinner ? moveMakerWinner.uid : winners[0].uid;
      room.gameStatus = 'gameover';
    } else {
      // Advance turn to next player in array
      const currentIdx = room.players.findIndex(p => p.uid === playerUid);
      const nextIdx = (currentIdx + 1) % room.players.length;
      room.turnIndex = nextIdx;
      room.currentTurn = room.players[nextIdx].uid;
    }

    room.moveHistory.push({
      number,
      playerUid,
      playerName,
      timestamp: Date.now(),
    });

    mockDatabase[code] = room;
    saveMockDB(mockDatabase);
    broadcastUpdate(code, room);
    return room;
  },

  restartRoom: async (roomCode) => {
    const code = roomCode.toUpperCase();
    const mockDatabase = getMockDB();
    const room = normalizeRoomData(mockDatabase[code]);

    if (!room) throw new Error('Room not found');

    room.crossedNumbers = [];
    room.winner = null;
    room.moveHistory = [];
    
    // Regenerate boards for all players
    room.players.forEach(p => {
      p.board = generateBoard(room.boardSize);
      room.completedLines[p.uid] = 0;
    });

    room.gameStatus = room.players.length >= 2 ? 'playing' : 'waiting';
    room.turnIndex = Math.floor(Math.random() * room.players.length);
    room.currentTurn = room.players[room.turnIndex] ? room.players[room.turnIndex].uid : room.hostId;

    mockDatabase[code] = room;
    saveMockDB(mockDatabase);
    broadcastUpdate(code, room);
    return room;
  },

  leaveRoom: async (roomCode, playerUid) => {
    const code = roomCode.toUpperCase();
    const mockDatabase = getMockDB();
    const room = normalizeRoomData(mockDatabase[code]);

    if (!room) return;

    room.players = room.players.filter(p => p.uid !== playerUid);
    delete room.completedLines[playerUid];

    if (room.players.length === 0) {
      delete mockDatabase[code];
      saveMockDB(mockDatabase);
      broadcastUpdate(code, null);
      return;
    }

    // Host transfer if host leaves
    if (room.hostId === playerUid) {
      room.hostId = room.players[0].uid;
      room.hostName = room.players[0].name;
    }

    if (room.players.length === 1 && room.gameStatus === 'playing') {
      // Remaining player wins by forfeit
      room.winner = room.players[0].uid;
      room.gameStatus = 'gameover';
    } else if (room.currentTurn === playerUid) {
      room.turnIndex = 0;
      room.currentTurn = room.players[0].uid;
    }

    mockDatabase[code] = room;
    saveMockDB(mockDatabase);
    broadcastUpdate(code, room);
  }
};

// ----------------------------------------------------
// REAL FIREBASE FIRESTORE OPERATIONS
// ----------------------------------------------------
const firebaseDb = {
  createRoom: async (playerName, playerUid, options = {}) => {
    const boardSize = Number(options.boardSize) || 5;
    const maxPlayers = Number(options.maxPlayers) || 2;
    let roomCode = generateRoomCode();
    let codeAvailable = false;
    let attempts = 0;

    // Ensure room code uniqueness
    while (!codeAvailable && attempts < 5) {
      const roomRef = doc(db, 'games', roomCode);
      const roomSnap = await getDoc(roomRef);
      if (!roomSnap.exists()) {
        codeAvailable = true;
      } else {
        roomCode = generateRoomCode();
        attempts++;
      }
    }

    const hostPlayer = {
      uid: playerUid,
      name: playerName,
      board: generateBoard(boardSize),
      isReady: true,
      joinedAt: Date.now(),
    };

    const roomRef = doc(db, 'games', roomCode);
    const newRoom = {
      roomCode,
      hostId: playerUid,
      hostName: playerName,
      boardSize,
      maxPlayers,
      gameStatus: 'waiting',
      players: [hostPlayer],
      completedLines: { [playerUid]: 0 },
      crossedNumbers: [],
      currentTurn: playerUid,
      turnIndex: 0,
      winner: null,
      moveHistory: [],
      createdAt: Date.now(),
    };

    await setDoc(roomRef, newRoom);
    return roomCode;
  },

  joinRoom: async (roomCode, playerName, playerUid) => {
    const code = roomCode.toUpperCase();
    const roomRef = doc(db, 'games', code);
    const roomSnap = await getDoc(roomRef);

    if (!roomSnap.exists()) {
      throw new Error('Room not found');
    }

    const room = normalizeRoomData(roomSnap.data());
    
    // Check if player is already in this room
    const existingIndex = room.players.findIndex(p => p.uid === playerUid);
    if (existingIndex !== -1) {
      room.players[existingIndex].name = playerName;
      await updateDoc(roomRef, { players: room.players });
      return room;
    }

    // Check if room is full
    if (room.players.length >= room.maxPlayers) {
      throw new Error('This room has reached its maximum number of players.');
    }

    // Add Player
    const newPlayer = {
      uid: playerUid,
      name: playerName,
      board: generateBoard(room.boardSize),
      isReady: false,
      joinedAt: Date.now(),
    };

    const updatedPlayers = [...room.players, newPlayer];
    const updatedCompletedLines = { ...room.completedLines, [playerUid]: 0 };

    await updateDoc(roomRef, {
      players: updatedPlayers,
      completedLines: updatedCompletedLines,
    });

    return {
      ...room,
      players: updatedPlayers,
      completedLines: updatedCompletedLines,
    };
  },

  toggleReady: async (roomCode, playerUid, isReady) => {
    const code = roomCode.toUpperCase();
    const roomRef = doc(db, 'games', code);
    const roomSnap = await getDoc(roomRef);

    if (!roomSnap.exists()) throw new Error('Room not found');
    const room = normalizeRoomData(roomSnap.data());

    const updatedPlayers = room.players.map(p => {
      if (p.uid === playerUid) {
        return { ...p, isReady: typeof isReady === 'boolean' ? isReady : !p.isReady };
      }
      return p;
    });

    await updateDoc(roomRef, { players: updatedPlayers });
  },

  startGame: async (roomCode, hostUid) => {
    const code = roomCode.toUpperCase();
    const roomRef = doc(db, 'games', code);
    const roomSnap = await getDoc(roomRef);

    if (!roomSnap.exists()) throw new Error('Room not found');
    const room = normalizeRoomData(roomSnap.data());

    if (room.hostId !== hostUid) throw new Error('Only the host can start the game');
    if (room.players.length < 2) throw new Error('Need at least 2 players to start');

    await updateDoc(roomRef, {
      gameStatus: 'playing',
      currentTurn: room.players[0].uid,
      turnIndex: 0,
    });
  },

  subscribeToRoom: (roomCode, callback, onError) => {
    const code = roomCode.toUpperCase();
    const roomRef = doc(db, 'games', code);
    return onSnapshot(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        callback(normalizeRoomData(snapshot.data()));
      } else {
        // Room deleted
        callback(null);
      }
    }, onError);
  },

  makeMove: async (roomCode, number, playerUid, playerName) => {
    const code = roomCode.toUpperCase();
    const roomRef = doc(db, 'games', code);
    const roomSnap = await getDoc(roomRef);

    if (!roomSnap.exists()) throw new Error('Room not found');
    
    const room = normalizeRoomData(roomSnap.data());
    if (room.gameStatus !== 'playing') throw new Error('Game is not active');
    if (room.currentTurn !== playerUid) throw new Error('Not your turn');
    if (room.crossedNumbers.includes(number)) return room;

    const newCrossed = [...room.crossedNumbers, number];
    const updatedCompletedLines = { ...room.completedLines };

    const winners = [];
    room.players.forEach(player => {
      const result = checkBingo(player.board, newCrossed, room.boardSize);
      updatedCompletedLines[player.uid] = result.count;
      if (result.isBingo) {
        winners.push(player);
      }
    });

    let winner = null;
    let status = 'playing';
    let nextTurn = room.currentTurn;
    let nextTurnIndex = room.turnIndex;

    if (winners.length > 0) {
      const moveMakerWinner = winners.find(w => w.uid === playerUid);
      winner = moveMakerWinner ? moveMakerWinner.uid : winners[0].uid;
      status = 'gameover';
    } else {
      const currentIdx = room.players.findIndex(p => p.uid === playerUid);
      nextTurnIndex = (currentIdx + 1) % room.players.length;
      nextTurn = room.players[nextTurnIndex].uid;
    }

    const newHistory = [
      ...room.moveHistory,
      {
        number,
        playerUid,
        playerName,
        timestamp: Date.now()
      }
    ];

    await updateDoc(roomRef, {
      crossedNumbers: newCrossed,
      completedLines: updatedCompletedLines,
      winner,
      gameStatus: status,
      currentTurn: nextTurn,
      turnIndex: nextTurnIndex,
      moveHistory: newHistory
    });
  },

  restartRoom: async (roomCode) => {
    const code = roomCode.toUpperCase();
    const roomRef = doc(db, 'games', code);
    const roomSnap = await getDoc(roomRef);

    if (!roomSnap.exists()) throw new Error('Room not found');
    const room = normalizeRoomData(roomSnap.data());

    const startingTurnIndex = Math.floor(Math.random() * room.players.length);
    const startingTurn = room.players[startingTurnIndex] ? room.players[startingTurnIndex].uid : room.hostId;

    const updatedPlayers = room.players.map(p => ({
      ...p,
      board: generateBoard(room.boardSize),
    }));

    const resetCompletedLines = {};
    updatedPlayers.forEach(p => { resetCompletedLines[p.uid] = 0; });

    await updateDoc(roomRef, {
      crossedNumbers: [],
      completedLines: resetCompletedLines,
      winner: null,
      moveHistory: [],
      gameStatus: updatedPlayers.length >= 2 ? 'playing' : 'waiting',
      currentTurn: startingTurn,
      turnIndex: startingTurnIndex,
      players: updatedPlayers
    });
  },

  leaveRoom: async (roomCode, playerUid) => {
    const code = roomCode.toUpperCase();
    const roomRef = doc(db, 'games', code);
    const roomSnap = await getDoc(roomRef);

    if (!roomSnap.exists()) return;
    const room = normalizeRoomData(roomSnap.data());

    const remainingPlayers = room.players.filter(p => p.uid !== playerUid);
    const updatedCompletedLines = { ...room.completedLines };
    delete updatedCompletedLines[playerUid];

    if (remainingPlayers.length === 0) {
      await deleteDoc(roomRef);
      return;
    }

    let newHostId = room.hostId;
    let newHostName = room.hostName;
    if (room.hostId === playerUid) {
      newHostId = remainingPlayers[0].uid;
      newHostName = remainingPlayers[0].name;
    }

    let winner = room.winner;
    let status = room.gameStatus;
    let nextTurn = room.currentTurn;

    if (remainingPlayers.length === 1 && status === 'playing') {
      winner = remainingPlayers[0].uid;
      status = 'gameover';
    } else if (room.currentTurn === playerUid) {
      nextTurn = remainingPlayers[0].uid;
    }

    await updateDoc(roomRef, {
      hostId: newHostId,
      hostName: newHostName,
      players: remainingPlayers,
      completedLines: updatedCompletedLines,
      winner,
      gameStatus: status,
      currentTurn: nextTurn,
      turnIndex: 0,
    });
  }
};

// Export operations based on whether real Firebase is loaded
export const gameDb = isRealFirebase ? firebaseDb : mockDb;
export { isRealFirebase };
