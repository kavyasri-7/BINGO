import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import confetti from 'canvas-confetti';
import {
  Copy,
  Check,
  Play,
  Volume2,
  VolumeX,
  Trophy,
  Users,
  Award,
  LogOut,
  Sparkles,
  AlertCircle,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { housieDb } from '../services/housieDb';
import { audioService } from '../utils/audioService';

export default function HousieRoom({ user }) {
  const { roomCode } = useParams();
  const navigate = useNavigate();

  const [room, setRoom] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [muted, setMuted] = useState(false);
  const [toast, setToast] = useState(null);
  const [winnerModal, setWinnerModal] = useState(null);

  // Countdown timer for 3s interval
  const [secondsRemaining, setSecondsRemaining] = useState(3);

  const prevCalledCountRef = useRef(0);
  const prevWinnerCountRef = useRef(0);

  const triggerToast = (message, type = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Subscribe to real-time room updates
  useEffect(() => {
    const currentUserId = user?.uid || `guest_${Date.now()}`;
    const cleanCode = (roomCode || '').trim().toUpperCase();

    // Join room or load room state
    housieDb
      .joinRoom(cleanCode, user?.name || 'Player', currentUserId)
      .then((roomData) => {
        setRoom(roomData);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message || 'Failed to join room.');
        setLoading(false);
      });

    const unsubscribe = housieDb.subscribeToRoom(cleanCode, (updatedRoom) => {
      if (!updatedRoom) return;
      setRoom(updatedRoom);

      // Play audio on new called number
      const newCalledLength = updatedRoom.calledNumbers?.length || 0;
      if (newCalledLength > prevCalledCountRef.current) {
        prevCalledCountRef.current = newCalledLength;
        audioService.playNumberCallSound();
        setSecondsRemaining(3);
      }

      // Check new winners for popup & confetti
      const winnerCount = Object.keys(updatedRoom.winners || {}).length;
      if (winnerCount > prevWinnerCountRef.current && updatedRoom.lastWinnerEvent) {
        prevWinnerCountRef.current = winnerCount;
        const win = updatedRoom.lastWinnerEvent;

        setWinnerModal(win);
        audioService.playWinSound();

        // Confetti celebration
        try {
          confetti({
            particleCount: 120,
            spread: 80,
            origin: { y: 0.6 }
          });
        } catch {}

        setTimeout(() => setWinnerModal(null), 5000);
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [roomCode, user]);

  // Timer countdown tick effect
  useEffect(() => {
    if (room?.status !== 'PLAYING') return;

    const interval = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          audioService.playTickSound();
          return 3;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [room?.status, room?.currentCallIndex]);

  const cleanRoomCode = (roomCode || '').trim().toUpperCase();

  const handleCopyCode = () => {
    const shareUrl = `${window.location.origin}/housie/${cleanRoomCode}`;
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    triggerToast('Room Link Copied! Send it to your friends.', 'success');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleStartGame = async () => {
    try {
      audioService.playGameStartSound();
      await housieDb.startGame(cleanRoomCode, user.uid);
    } catch (err) {
      triggerToast(err.message || 'Failed to start game.');
    }
  };

  const handleMarkNumber = async (num) => {
    if (!room || room.status !== 'PLAYING') return;

    const myPlayerId = user.uid;
    const myPlayer = room.players[myPlayerId];
    if (!myPlayer) return;

    if (myPlayer.markedNumbers.includes(num)) {
      triggerToast('Number is already marked.', 'info');
      return;
    }

    try {
      const result = await housieDb.markNumber(roomCode, myPlayerId, num);
      audioService.playMarkSound();

      if (result.newWins && result.newWins.length > 0) {
        triggerToast(`🎉 Congratulations! You won: ${result.newWins.join(', ')}`, 'success');
      }
    } catch (err) {
      audioService.playErrorSound();
      triggerToast(err.message || 'Invalid selection', 'error');
    }
  };

  const toggleSound = () => {
    const isMuted = audioService.toggleMute();
    setMuted(isMuted);
  };

  if (loading) {
    return (
      <div className="housie-loading-screen flex-center">
        <div className="spinner"></div>
        <p className="loading-text">CONNECTING TO HOUSIE ROOM...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="housie-error-screen flex-center">
        <div className="error-card glass-card">
          <AlertCircle size={48} color="hsl(var(--primary))" />
          <h2>Room Access Locked</h2>
          <p>{error}</p>
          <button className="btn btn-primary" onClick={() => navigate('/')}>
            Back to Lobby
          </button>
        </div>
      </div>
    );
  }

  if (!room) return null;

  const myPlayerId = user.uid;
  const myPlayer = room.players[myPlayerId] || { ticket: [], markedNumbers: [] };
  const isHost = room.hostId === myPlayerId;
  const playersList = Object.values(room.players || {});
  const calledNumbersSet = new Set(room.calledNumbers || []);
  const markedNumbersSet = new Set(myPlayer.markedNumbers || []);
  const last5Called = (room.calledNumbers || []).slice(-5).reverse();

  return (
    <div className="housie-room-container">
      {/* Toast notification */}
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            <AlertCircle size={18} />
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Animated Winner Celebration Modal */}
      {winnerModal && (
        <div className="winner-overlay flex-center">
          <div className="winner-popup-card glass-card">
            <Trophy size={64} className="trophy-bounce" color="#f59e0b" />
            <h2 className="glow-title">WINNER ANNOUNCED!</h2>
            <div className="winner-details">
              <span className="winner-name">{winnerModal.nickname}</span>
              <span className="winner-category">Won {winnerModal.category}</span>
            </div>
            <p className="winner-sub">Winning Number: #{winnerModal.numberCalledAtWin}</p>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <header className="housie-header glass-card">
        <div className="header-left">
          <h2 className="room-title">{room.gameName}</h2>
          <div className="room-code-badge" onClick={handleCopyCode} title="Click to copy">
            <span>CODE: <strong>{roomCode}</strong></span>
            {copied ? <Check size={16} color="#10b981" /> : <Copy size={16} />}
          </div>
        </div>

        <div className="header-right">
          <div className="badge player-count-badge">
            <Users size={16} /> {playersList.length} Joined
          </div>

          <button className="btn-icon" onClick={toggleSound} title={muted ? 'Unmute Audio' : 'Mute Audio'}>
            {muted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>

          <button className="btn btn-secondary btn-sm" onClick={() => navigate('/')}>
            <LogOut size={16} /> Exit
          </button>
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* STATE 1: WAITING LOBBY */}
      {/* ------------------------------------------------------------- */}
      {room.status === 'WAITING' && (
        <div className="waiting-lobby-container">
          <div className="lobby-hero glass-card">
            <div className="code-display-box">
              <p className="code-label">SHARE THIS ROOM CODE WITH FRIENDS</p>
              <div className="big-code-box" onClick={handleCopyCode}>
                <span className="big-code">{roomCode}</span>
                <button className="btn btn-sm btn-primary">
                  {copied ? <Check size={16} /> : <Copy size={16} />} {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="lobby-status-banner">
              <Sparkles size={20} className="spin-slow" />
              <span>Waiting for Host ({room.hostName}) to start the game...</span>
            </div>

            {isHost && (
              <div className="host-action-box">
                <button className="btn btn-primary btn-lg glow-btn" onClick={handleStartGame}>
                  <Play size={20} /> START HOUSIE GAME NOW
                </button>
              </div>
            )}
          </div>

          <div className="lobby-grid">
            {/* Joined Players List */}
            <div className="players-card glass-card">
              <h3>
                <Users size={18} /> Joined Players ({playersList.length})
              </h3>
              <div className="players-list">
                {playersList.map((p) => (
                  <div key={p.playerId} className="player-chip">
                    <div className="avatar flex-center">{p.nickname.charAt(0).toUpperCase()}</div>
                    <span className="player-name">{p.nickname}</span>
                    {p.isHost && <span className="host-tag">HOST</span>}
                  </div>
                ))}
              </div>
            </div>

            {/* Player's Ticket Preview */}
            <div className="ticket-preview-card glass-card">
              <h3>
                <ShieldCheck size={18} /> Your Unique Tambola Ticket
              </h3>
              <p className="sub-text">15 numbers randomly generated & verified for you</p>
              <TicketGrid ticket={myPlayer.ticket} markedNumbersSet={new Set()} onMark={() => {}} disabled={true} />
            </div>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* STATE 2: ACTIVE GAME / FINISHED */}
      {/* ------------------------------------------------------------- */}
      {(room.status === 'PLAYING' || room.status === 'FINISHED') && (
        <div className="game-active-layout">
          {/* Top Control Bar: Caller Display & Live 1-90 Board */}
          <div className="caller-section glass-card">
            {/* Current Number Caller Circle */}
            <div className="current-caller-box">
              <div className="caller-circle flex-center glowing-number">
                <span className="current-num">{room.currentNumber || '--'}</span>
                {room.status === 'PLAYING' && (
                  <svg className="timer-svg" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="45" className="timer-bg" />
                    <circle
                      cx="50"
                      cy="50"
                      r="45"
                      className="timer-ring"
                      style={{
                        strokeDashoffset: (282 * (3 - secondsRemaining)) / 3
                      }}
                    />
                  </svg>
                )}
              </div>
              <p className="caller-label">CURRENT NUMBER</p>
              <span className="countdown-text">{room.status === 'PLAYING' ? `Next in ${secondsRemaining}s` : 'GAME ENDED'}</span>
            </div>

            {/* History Strip */}
            <div className="caller-history-box">
              <p className="section-subtitle">RECENTS CALLED</p>
              <div className="recent-pills">
                {last5Called.map((num, idx) => (
                  <div key={idx} className={`recent-pill ${idx === 0 ? 'latest' : ''}`}>
                    #{num}
                  </div>
                ))}
              </div>
              <span className="called-count-badge">
                Total Called: {room.calledNumbers?.length || 0} / 90
              </span>
            </div>

            {/* 1 - 90 Live Board */}
            <div className="board-90-container">
              <p className="section-subtitle">LIVE CALLED NUMBERS BOARD (1-90)</p>
              <div className="board-90-grid">
                {Array.from({ length: 90 }, (_, i) => i + 1).map((n) => {
                  const isCalled = calledNumbersSet.has(n);
                  const isLatest = room.currentNumber === n;
                  return (
                    <div
                      key={n}
                      className={`board-cell ${isCalled ? 'called' : ''} ${isLatest ? 'latest-pulse' : ''}`}
                    >
                      {n}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Main Gameplay Grid: Ticket + Live Winners + Player Progress */}
          <div className="gameplay-main-grid">
            {/* Player's Interactive Ticket */}
            <div className="player-ticket-section glass-card">
              <div className="section-header">
                <h3>
                  <Sparkles size={18} /> YOUR TAMBOLA TICKET
                </h3>
                <span className="marked-tracker">
                  Marked: {markedNumbersSet.size} / 15
                </span>
              </div>
              <TicketGrid
                ticket={myPlayer.ticket}
                markedNumbersSet={markedNumbersSet}
                onMark={handleMarkNumber}
                disabled={room.status === 'FINISHED'}
              />
            </div>

            {/* Live Winners Panel */}
            <div className="winners-panel-section glass-card">
              <h3>
                <Trophy size={18} color="#f59e0b" /> LIVE WINNERS
              </h3>
              <div className="winners-list">
                {room.categories.map((cat) => {
                  const win = room.winners[cat];
                  return (
                    <div key={cat} className={`winner-card ${win ? 'claimed' : 'unclaimed'}`}>
                      <div className="category-title">
                        <Award size={16} />
                        <strong>{cat}</strong>
                      </div>
                      {win ? (
                        <div className="winner-info">
                          <span className="winner-nick">🏆 {win.nickname}</span>
                          <span className="win-num">#{win.numberCalledAtWin}</span>
                        </div>
                      ) : (
                        <span className="unclaimed-text">In Progress...</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Player Progress Leaderboard */}
            <div className="progress-section glass-card">
              <h3>
                <Users size={18} /> PLAYER PROGRESS
              </h3>
              <div className="progress-list">
                {playersList.map((p) => {
                  const markedCount = p.markedNumbers?.length || 0;
                  return (
                    <div key={p.playerId} className="progress-row">
                      <span className="p-name">{p.nickname}</span>
                      <div className="progress-bar-wrap">
                        <div
                          className="progress-fill"
                          style={{ width: `${(markedCount / 15) * 100}%` }}
                        ></div>
                      </div>
                      <span className="p-count">{markedCount}/15</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------------
// 3 x 9 Tambola Ticket Render Component
// -------------------------------------------------------------------
function TicketGrid({ ticket, markedNumbersSet, onMark, disabled }) {
  if (!ticket || ticket.length === 0) {
    return <div className="ticket-placeholder">Generating ticket matrix...</div>;
  }

  return (
    <div className="tambola-ticket-grid">
      {ticket.map((row, rIdx) => (
        <div key={rIdx} className="ticket-row">
          {row.map((cellNum, cIdx) => {
            const isBlank = cellNum === null || cellNum === undefined;
            const isMarked = !isBlank && markedNumbersSet.has(cellNum);

            return (
              <div
                key={cIdx}
                className={`ticket-cell ${isBlank ? 'blank-cell' : 'number-cell'} ${isMarked ? 'marked-cell' : ''}`}
                onClick={() => !isBlank && !disabled && onMark(cellNum)}
              >
                {!isBlank && (
                  <>
                    <span className="num-val">{cellNum}</span>
                    {isMarked && <CheckCircle2 size={22} className="check-icon" />}
                  </>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
