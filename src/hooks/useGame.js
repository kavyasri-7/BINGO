import { useState, useEffect, useCallback } from 'react';
import { gameDb } from '../services/db';

export function useGame(roomCode, user) {
  const [roomData, setRoomData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connected');

  // Create room with custom board size and max players
  const createRoom = useCallback(async (playerName, options = {}) => {
    if (!user) return null;
    setLoading(true);
    setError(null);
    try {
      const code = await gameDb.createRoom(playerName, user.uid, options);
      setLoading(false);
      return code;
    } catch (err) {
      console.error('Error creating room:', err);
      setError(err.message || 'Failed to create game room.');
      setLoading(false);
      throw err;
    }
  }, [user]);

  // Join room
  const joinRoom = useCallback(async (code, playerName) => {
    if (!user) return null;
    setLoading(true);
    setError(null);
    try {
      const room = await gameDb.joinRoom(code, playerName, user.uid);
      setLoading(false);
      return room;
    } catch (err) {
      console.error('Error joining room:', err);
      setError(err.message || 'Failed to join game room.');
      setLoading(false);
      throw err;
    }
  }, [user]);

  // Toggle ready status
  const toggleReady = useCallback(async (isReady) => {
    if (!roomCode || !user) return;
    try {
      await gameDb.toggleReady(roomCode, user.uid, isReady);
    } catch (err) {
      console.error('Error toggling ready:', err);
      setError(err.message || 'Failed to update ready status.');
    }
  }, [roomCode, user]);

  // Start game (Host only)
  const startGame = useCallback(async () => {
    if (!roomCode || !user) return;
    try {
      await gameDb.startGame(roomCode, user.uid);
    } catch (err) {
      console.error('Error starting game:', err);
      setError(err.message || 'Failed to start game.');
    }
  }, [roomCode, user]);

  // Select number/cell
  const selectCell = useCallback(async (number) => {
    if (!roomCode || !user || !roomData) return;
    if (roomData.gameStatus !== 'playing') return;
    if (roomData.currentTurn !== user.uid) return;
    if (roomData.crossedNumbers.includes(number)) return;

    try {
      await gameDb.makeMove(roomCode, number, user.uid, user.name);
    } catch (err) {
      console.error('Error selecting cell:', err);
      setError(err.message || 'Failed to make move.');
    }
  }, [roomCode, user, roomData]);

  // Restart room
  const restartGame = useCallback(async () => {
    if (!roomCode) return;
    try {
      await gameDb.restartRoom(roomCode);
    } catch (err) {
      console.error('Error restarting game:', err);
      setError(err.message || 'Failed to restart game.');
    }
  }, [roomCode]);

  // Leave room
  const leaveRoom = useCallback(async () => {
    if (!roomCode || !user) return;
    try {
      await gameDb.leaveRoom(roomCode, user.uid);
      setRoomData(null);
    } catch (err) {
      console.error('Error leaving room:', err);
    }
  }, [roomCode, user]);

  // Subscribe to room updates
  useEffect(() => {
    if (!roomCode || !user) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setConnectionStatus('connected');

    const unsubscribe = gameDb.subscribeToRoom(
      roomCode,
      (data) => {
        if (!data) {
          setError('This room has been closed or does not exist.');
          setRoomData(null);
        } else {
          setRoomData(data);
          setError(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error('Firestore subscription error:', err);
        setError('Connection error. Retrying...');
        setConnectionStatus('disconnected');
        setLoading(false);
      }
    );

    // Monitor online/offline status
    const handleOnline = () => setConnectionStatus('connected');
    const handleOffline = () => setConnectionStatus('disconnected');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [roomCode, user]);

  // Derived states
  const playersList = Array.isArray(roomData?.players) ? roomData.players : [];
  const me = playersList.find(p => p.uid === user?.uid) || null;
  const isHost = roomData?.hostId === user?.uid;
  const hostName = roomData?.hostName || (playersList[0] ? playersList[0].name : 'Host');

  const boardSize = Number(roomData?.boardSize) || 5;
  const maxPlayers = Number(roomData?.maxPlayers) || 2;
  const targetLines = boardSize;

  const isMyTurn = roomData?.currentTurn === user?.uid && roomData?.gameStatus === 'playing';
  const currentTurnPlayer = playersList.find(p => p.uid === roomData?.currentTurn) || null;

  const myCompletedCount = (roomData?.completedLines && me) 
    ? (roomData.completedLines[me.uid] || 0) 
    : 0;

  const isWinner = roomData?.winner === user?.uid;
  const isGameOver = roomData?.gameStatus === 'gameover';
  const winnerPlayer = roomData?.winner 
    ? playersList.find(p => p.uid === roomData.winner) 
    : null;
  const winnerName = winnerPlayer ? winnerPlayer.name : (roomData?.winner ? 'Player' : null);

  return {
    roomData,
    loading,
    error,
    connectionStatus,
    me,
    isHost,
    hostName,
    playersList,
    boardSize,
    maxPlayers,
    targetLines,
    isMyTurn,
    currentTurnPlayer,
    myCompletedCount,
    isWinner,
    isGameOver,
    winnerName,
    winnerPlayer,
    actions: {
      createRoom,
      joinRoom,
      toggleReady,
      startGame,
      selectCell,
      restartGame,
      leaveRoom,
    },
  };
}
