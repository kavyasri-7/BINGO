import { useState, useEffect, useCallback } from 'react';
import { gameDb } from '../services/db';

export function useGame(roomCode, user) {
  const [roomData, setRoomData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('connected');

  // Create room
  const createRoom = useCallback(async (playerName) => {
    if (!user) return null;
    setLoading(true);
    setError(null);
    try {
      const code = await gameDb.createRoom(playerName, user.uid);
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
  const players = roomData?.players || {};
  
  let myPlayerKey = null;
  let opponentPlayerKey = null;

  if (players.player1?.uid === user?.uid) {
    myPlayerKey = 'player1';
    opponentPlayerKey = 'player2';
  } else if (players.player2?.uid === user?.uid) {
    myPlayerKey = 'player2';
    opponentPlayerKey = 'player1';
  }

  const me = myPlayerKey ? players[myPlayerKey] : null;
  const opponent = opponentPlayerKey ? players[opponentPlayerKey] : null;

  const isMyTurn = roomData?.currentTurn === user?.uid && roomData?.gameStatus === 'playing';
  const hasOpponentJoined = !!opponent;
  
  const myCompletedCount = myPlayerKey === 'player1' 
    ? roomData?.player1CompletedLines || 0 
    : roomData?.player2CompletedLines || 0;

  const opponentCompletedCount = myPlayerKey === 'player1' 
    ? roomData?.player2CompletedLines || 0 
    : roomData?.player1CompletedLines || 0;

  const isWinner = roomData?.winner === user?.uid;
  const isGameOver = roomData?.gameStatus === 'gameover';
  const winnerName = roomData?.winner 
    ? (roomData.winner === players.player1?.uid 
        ? players.player1.name 
        : players.player2?.name || 'Opponent') 
    : null;

  return {
    roomData,
    loading,
    error,
    connectionStatus,
    me,
    opponent,
    isMyTurn,
    hasOpponentJoined,
    myCompletedCount,
    opponentCompletedCount,
    isWinner,
    isGameOver,
    winnerName,
    actions: {
      createRoom,
      joinRoom,
      selectCell,
      restartGame,
      leaveRoom,
    },
  };
}
