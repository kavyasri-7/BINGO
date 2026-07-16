import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  onSnapshot,
  deleteDoc,
  serverTimestamp
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

// Mock implementation of db operations
const mockDb = {
  createRoom: async (playerName, playerUid) => {
    const roomCode = generateRoomCode();
    const mockDatabase = getMockDB();

    const newRoom = {
      roomCode,
      gameStatus: 'waiting',
      players: {
        player1: { uid: playerUid, name: playerName, board: generateBoard() },
        player2: null,
      },
      crossedNumbers: [],
      currentTurn: playerUid,
      player1CompletedLines: 0,
      player2CompletedLines: 0,
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
    const mockDatabase = getMockDB();
    const room = mockDatabase[roomCode];

    if (!room) {
      throw new Error('Room not found');
    }
    if (room.players.player2 && room.players.player2.uid !== playerUid && room.players.player1.uid !== playerUid) {
      throw new Error('Room is full');
    }

    // If player is already player1, let them stay as player1
    if (room.players.player1.uid === playerUid) {
      return room;
    }

    // If player is already player2, return room
    if (room.players.player2 && room.players.player2.uid === playerUid) {
      return room;
    }

    // Set player 2 and set status to playing
    room.players.player2 = {
      uid: playerUid,
      name: playerName,
      board: generateBoard(),
    };
    room.gameStatus = 'playing';

    mockDatabase[roomCode] = room;
    saveMockDB(mockDatabase);
    broadcastUpdate(roomCode, room);
    return room;
  },

  subscribeToRoom: (roomCode, callback) => {
    // Return initial value in microtask
    setTimeout(() => {
      const mockDatabase = getMockDB();
      const room = mockDatabase[roomCode];
      if (room) {
        callback(room);
      }
    }, 0);

    registerCallback(roomCode, callback);

    const handleMessage = (event) => {
      if (event.data && event.data.type === 'ROOM_UPDATE' && event.data.roomCode === roomCode) {
        callback(event.data.data);
      }
    };

    bc.addEventListener('message', handleMessage);

    // Also listen to storage events in case tabs are on different processes/domains
    const handleStorage = (event) => {
      if (event.key === MOCK_DB_KEY) {
        const mockDatabase = getMockDB();
        const room = mockDatabase[roomCode];
        if (room) {
          callback(room);
        }
      }
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      unregisterCallback(roomCode, callback);
      bc.removeEventListener('message', handleMessage);
      window.removeEventListener('storage', handleStorage);
    };
  },

  makeMove: async (roomCode, number, playerUid, playerName) => {
    const mockDatabase = getMockDB();
    const room = mockDatabase[roomCode];

    if (!room) throw new Error('Room not found');
    if (room.gameStatus !== 'playing') throw new Error('Game is not active');
    if (room.currentTurn !== playerUid) throw new Error('Not your turn');
    if (room.crossedNumbers.includes(number)) return room; // Already clicked

    room.crossedNumbers.push(number);

    // Calculate completed lines
    const p1Result = checkBingo(room.players.player1.board, room.crossedNumbers);
    const p2Result = checkBingo(room.players.player2.board, room.crossedNumbers);

    room.player1CompletedLines = p1Result.count;
    room.player2CompletedLines = p2Result.count;

    // Check winner
    let p1Wins = p1Result.count >= 5;
    let p2Wins = p2Result.count >= 5;

    if (p1Wins && p2Wins) {
      // If both completed 5 lines on the same turn, whoever made the move wins
      room.winner = playerUid;
      room.gameStatus = 'gameover';
    } else if (p1Wins) {
      room.winner = room.players.player1.uid;
      room.gameStatus = 'gameover';
    } else if (p2Wins) {
      room.winner = room.players.player2.uid;
      room.gameStatus = 'gameover';
    }

    // Toggle turn
    const nextTurn = playerUid === room.players.player1.uid 
      ? room.players.player2.uid 
      : room.players.player1.uid;
    
    room.currentTurn = nextTurn;

    // Move history
    room.moveHistory.push({
      number,
      playerUid,
      playerName,
      timestamp: Date.now(),
    });

    mockDatabase[roomCode] = room;
    saveMockDB(mockDatabase);
    broadcastUpdate(roomCode, room);
    return room;
  },

  restartRoom: async (roomCode) => {
    const mockDatabase = getMockDB();
    const room = mockDatabase[roomCode];

    if (!room) throw new Error('Room not found');

    room.crossedNumbers = [];
    room.player1CompletedLines = 0;
    room.player2CompletedLines = 0;
    room.winner = null;
    room.moveHistory = [];
    room.players.player1.board = generateBoard();
    if (room.players.player2) {
      room.players.player2.board = generateBoard();
      room.gameStatus = 'playing';
    } else {
      room.gameStatus = 'waiting';
    }
    // Randomize starting turn
    room.currentTurn = Math.random() < 0.5 
      ? room.players.player1.uid 
      : (room.players.player2 ? room.players.player2.uid : room.players.player1.uid);

    mockDatabase[roomCode] = room;
    saveMockDB(mockDatabase);
    broadcastUpdate(roomCode, room);
    return room;
  },

  leaveRoom: async (roomCode, playerUid) => {
    const mockDatabase = getMockDB();
    const room = mockDatabase[roomCode];

    if (!room) return;

    // If P1 leaves
    if (room.players.player1.uid === playerUid) {
      if (room.players.player2) {
        // Promote player 2 to player 1 and win by forfeit
        room.winner = room.players.player2.uid;
        room.gameStatus = 'gameover';
        room.players.player1 = room.players.player2;
        room.players.player2 = null;
      } else {
        // Delete room
        delete mockDatabase[roomCode];
        saveMockDB(mockDatabase);
        broadcastUpdate(roomCode, null);
        return;
      }
    } else if (room.players.player2 && room.players.player2.uid === playerUid) {
      // Player 2 leaves, Player 1 wins by forfeit
      room.winner = room.players.player1.uid;
      room.gameStatus = 'gameover';
      room.players.player2 = null;
    }

    mockDatabase[roomCode] = room;
    saveMockDB(mockDatabase);
    broadcastUpdate(roomCode, room);
  }
};

// ----------------------------------------------------
// REAL FIREBASE FIRESTORE OPERATIONS
// ----------------------------------------------------
const firebaseDb = {
  createRoom: async (playerName, playerUid) => {
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

    const roomRef = doc(db, 'games', roomCode);
    const newRoom = {
      roomCode,
      gameStatus: 'waiting',
      players: {
        player1: { uid: playerUid, name: playerName, board: generateBoard() },
        player2: null,
      },
      crossedNumbers: [],
      currentTurn: playerUid,
      player1CompletedLines: 0,
      player2CompletedLines: 0,
      winner: null,
      moveHistory: [],
      createdAt: Date.now(),
    };

    await setDoc(roomRef, newRoom);
    return roomCode;
  },

  joinRoom: async (roomCode, playerName, playerUid) => {
    const roomRef = doc(db, 'games', roomCode.toUpperCase());
    const roomSnap = await getDoc(roomRef);

    if (!roomSnap.exists()) {
      throw new Error('Room not found');
    }

    const room = roomSnap.data();
    
    // Check if player is already in this room
    if (room.players.player1.uid === playerUid) {
      return room;
    }
    if (room.players.player2 && room.players.player2.uid === playerUid) {
      return room;
    }

    // Check if room is full
    if (room.players.player2) {
      throw new Error('Room is full');
    }

    // Add Player 2
    const updatedPlayers = {
      ...room.players,
      player2: {
        uid: playerUid,
        name: playerName,
        board: generateBoard()
      }
    };

    await updateDoc(roomRef, {
      players: updatedPlayers,
      gameStatus: 'playing'
    });

    return {
      ...room,
      players: updatedPlayers,
      gameStatus: 'playing'
    };
  },

  subscribeToRoom: (roomCode, callback, onError) => {
    const roomRef = doc(db, 'games', roomCode.toUpperCase());
    return onSnapshot(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.data());
      } else {
        // Room deleted
        callback(null);
      }
    }, onError);
  },

  makeMove: async (roomCode, number, playerUid, playerName) => {
    const roomRef = doc(db, 'games', roomCode.toUpperCase());
    const roomSnap = await getDoc(roomRef);

    if (!roomSnap.exists()) throw new Error('Room not found');
    
    const room = roomSnap.data();
    if (room.gameStatus !== 'playing') throw new Error('Game is not active');
    if (room.currentTurn !== playerUid) throw new Error('Not your turn');
    if (room.crossedNumbers.includes(number)) return room;

    const newCrossed = [...room.crossedNumbers, number];

    // Compute lines
    const p1Result = checkBingo(room.players.player1.board, newCrossed);
    const p2Result = checkBingo(room.players.player2.board, newCrossed);

    let winner = null;
    let status = 'playing';

    const p1Wins = p1Result.count >= 5;
    const p2Wins = p2Result.count >= 5;

    if (p1Wins && p2Wins) {
      winner = playerUid;
      status = 'gameover';
    } else if (p1Wins) {
      winner = room.players.player1.uid;
      status = 'gameover';
    } else if (p2Wins) {
      winner = room.players.player2.uid;
      status = 'gameover';
    }

    const nextTurn = playerUid === room.players.player1.uid 
      ? room.players.player2.uid 
      : room.players.player1.uid;

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
      player1CompletedLines: p1Result.count,
      player2CompletedLines: p2Result.count,
      winner,
      gameStatus: status,
      currentTurn: nextTurn,
      moveHistory: newHistory
    });
  },

  restartRoom: async (roomCode) => {
    const roomRef = doc(db, 'games', roomCode.toUpperCase());
    const roomSnap = await getDoc(roomRef);

    if (!roomSnap.exists()) throw new Error('Room not found');
    const room = roomSnap.data();

    const startingTurn = Math.random() < 0.5 
      ? room.players.player1.uid 
      : (room.players.player2 ? room.players.player2.uid : room.players.player1.uid);

    const updatedPlayers = {
      player1: {
        ...room.players.player1,
        board: generateBoard()
      },
      player2: room.players.player2 ? {
        ...room.players.player2,
        board: generateBoard()
      } : null
    };

    await updateDoc(roomRef, {
      crossedNumbers: [],
      player1CompletedLines: 0,
      player2CompletedLines: 0,
      winner: null,
      moveHistory: [],
      gameStatus: room.players.player2 ? 'playing' : 'waiting',
      currentTurn: startingTurn,
      players: updatedPlayers
    });
  },

  leaveRoom: async (roomCode, playerUid) => {
    const roomRef = doc(db, 'games', roomCode.toUpperCase());
    const roomSnap = await getDoc(roomRef);

    if (!roomSnap.exists()) return;
    const room = roomSnap.data();

    // If P1 leaves
    if (room.players.player1.uid === playerUid) {
      if (room.players.player2) {
        // Promote player 2 to player 1 and win by forfeit
        await updateDoc(roomRef, {
          players: {
            player1: room.players.player2,
            player2: null
          },
          winner: room.players.player2.uid,
          gameStatus: 'gameover'
        });
      } else {
        // Delete room
        await deleteDoc(roomRef);
      }
    } else if (room.players.player2 && room.players.player2.uid === playerUid) {
      // Player 2 leaves, Player 1 wins by forfeit
      await updateDoc(roomRef, {
        players: {
          player1: room.players.player1,
          player2: null
        },
        winner: room.players.player1.uid,
        gameStatus: 'gameover'
      });
    }
  }
};

// Export operations based on whether real Firebase is loaded
export const gameDb = isRealFirebase ? firebaseDb : mockDb;
export { isRealFirebase };
