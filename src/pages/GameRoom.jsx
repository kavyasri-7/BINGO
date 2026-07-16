import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Copy, Check, LogOut, RefreshCw, Trophy, Users, 
  History, Wifi, WifiOff, AlertCircle, ArrowLeft 
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useGame } from '../hooks/useGame';
import { checkBingo } from '../utils/bingoEngine';

export default function GameRoom({ user }) {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState(null);
  
  // Custom game management hook
  const {
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
    actions
  } = useGame(roomCode.toUpperCase(), user);

  const historyEndRef = useRef(null);

  // Trigger toast notifications
  const triggerToast = (message, type = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Scroll to bottom of move history whenever it changes
  useEffect(() => {
    if (historyEndRef.current) {
      historyEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [roomData?.moveHistory]);

  // Victory Confetti
  useEffect(() => {
    if (isGameOver && isWinner) {
      // Fire confetti multiple times for celebration
      const duration = 3 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 1100 };

      const randomInRange = (min, max) => Math.random() * (max - min) + min;

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();

        if (timeLeft <= 0) {
          return clearInterval(interval);
        }

        const particleCount = 50 * (timeLeft / duration);
        // since particles fall down, start a bit higher than random
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
      }, 250);

      return () => clearInterval(interval);
    }
  }, [isGameOver, isWinner]);

  // Copy Room Code
  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode.toUpperCase());
    setCopied(true);
    triggerToast('Room code copied to clipboard!', 'success');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLeaveRoom = async () => {
    if (window.confirm('Are you sure you want to leave? This will end the game.')) {
      await actions.leaveRoom();
      navigate('/');
    }
  };

  if (loading) {
    return (
      <div className="room-loading-screen flex-center">
        <div className="spinner"></div>
        <p>SYNCHRONIZING WITH SERVER ROOM {roomCode}...</p>
        <style>{`
          .room-loading-screen {
            height: 80vh;
            flex-direction: column;
            gap: 20px;
            font-family: var(--font-heading);
            color: hsl(var(--text-secondary));
            letter-spacing: 0.05em;
          }
        `}</style>
      </div>
    );
  }

  if (error || !roomData) {
    return (
      <div className="room-error-screen flex-center">
        <AlertCircle size={48} className="error-icon" />
        <h2>Room Error</h2>
        <p>{error || 'This game lobby is no longer active.'}</p>
        <button className="btn btn-primary" onClick={() => navigate('/')}>
          <ArrowLeft size={16} /> Return to Main Menu
        </button>
        <style>{`
          .room-error-screen {
            height: 80vh;
            flex-direction: column;
            gap: 20px;
            padding: 20px;
            text-align: center;
          }
          .error-icon {
            color: hsl(var(--primary));
            filter: drop-shadow(0 0 10px hsla(var(--primary), 0.4));
          }
          .room-error-screen h2 {
            font-size: 1.8rem;
          }
          .room-error-screen p {
            color: hsl(var(--text-secondary));
            max-width: 400px;
          }
        `}</style>
      </div>
    );
  }

  // Calculate my board highlights
  const myBoard = me?.board || [];
  const crossedNumbers = roomData.crossedNumbers || [];
  const myBingo = checkBingo(myBoard, crossedNumbers);
  const myHighlightIndices = myBingo.completedIndices;

  // Bingo Letter List helper
  const renderBingoLetters = (count) => {
    const letters = ['B', 'I', 'N', 'G', 'O'];
    return (
      <div className="bingo-letters-container">
        {letters.map((char, index) => {
          const active = index < count;
          return (
            <span 
              key={char} 
              className={`bingo-letter-badge ${active ? 'letter-active' : ''}`}
            >
              {char}
            </span>
          );
        })}
      </div>
    );
  };

  return (
    <div className="room-container">
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            <AlertCircle size={16} />
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* LOBBY VIEW (WAITING FOR OPPONENT) */}
      {roomData.gameStatus === 'waiting' && (
        <div className="glass-panel lobby-panel">
          <div className="lobby-header">
            <Users className="lobby-icon animate-pulse" />
            <h2>Waiting for Opponent</h2>
            <p>Send the room code to your friend to begin the matches.</p>
          </div>

          <div className="code-box-container">
            <span className="code-label">Room Code</span>
            <div className="code-value-row">
              <span className="code-text">{roomCode.toUpperCase()}</span>
              <button className="copy-btn" onClick={handleCopyCode} title="Copy code">
                {copied ? <Check size={18} className="copy-success" /> : <Copy size={18} />}
              </button>
            </div>
          </div>

          <div className="lobby-status">
            <div className="pulse-loader"></div>
            <span>Listening for connection...</span>
          </div>

          <button className="btn btn-secondary" onClick={handleLeaveRoom}>
            <LogOut size={16} /> Leave Room
          </button>
        </div>
      )}

      {/* GAMEPLAY VIEW */}
      {(roomData.gameStatus === 'playing' || roomData.gameStatus === 'gameover') && (
        <div className="gameplay-grid">
          {/* Main game board column */}
          <div className="board-section">
            {/* Scoreboard / Players Header */}
            <div className="glass-panel scoreboard-card">
              <div className="player-score-block player-me">
                <span className="player-tag">YOU</span>
                <span className="player-name">{me?.name}</span>
                {renderBingoLetters(myCompletedCount)}
              </div>

              <div className="vs-badge flex-center">VS</div>

              <div className="player-score-block player-opponent">
                <span className="player-tag">OPPONENT</span>
                <span className="player-name">
                  {opponent ? opponent.name : 'Leaving Room...'}
                </span>
                {renderBingoLetters(opponentCompletedCount)}
              </div>
            </div>

            {/* Turn status indicator */}
            <div className="turn-banner-container">
              {roomData.gameStatus === 'gameover' ? (
                <div className="turn-badge turn-ended">Game Over</div>
              ) : isMyTurn ? (
                <div className="turn-badge turn-my">YOUR TURN</div>
              ) : (
                <div className="turn-badge turn-opponent">OPPONENT'S TURN</div>
              )}
            </div>

            {/* Bingo Grid */}
            <div className="glass-panel board-card">
              <div className="grid-5x5">
                {myBoard.map((number, index) => {
                  const isCrossed = crossedNumbers.includes(number);
                  const isWinning = myHighlightIndices.has(index);
                  
                  return (
                    <button
                      key={`${number}-${index}`}
                      onClick={() => actions.selectCell(number)}
                      disabled={!isMyTurn || isCrossed || roomData.gameStatus !== 'playing'}
                      className={`grid-cell 
                        ${isCrossed ? 'cell-crossed' : ''} 
                        ${isWinning ? 'cell-winning' : ''}
                        ${!isMyTurn && !isCrossed ? 'cell-disabled' : ''}
                      `}
                    >
                      <span className="cell-number">{number}</span>
                      {isCrossed && <div className="strike-marker"></div>}
                    </button>
                  );
                })}
              </div>
            </div>
            
            {/* Connection / Status Bar */}
            <div className="meta-bar">
              <button className="btn btn-secondary btn-sm" onClick={handleLeaveRoom}>
                <LogOut size={14} /> Leave
              </button>
              
              <div className="meta-right">
                {connectionStatus === 'connected' ? (
                  <span className="meta-badge meta-connected">
                    <Wifi size={14} /> Connected
                  </span>
                ) : (
                  <span className="meta-badge meta-reconnecting">
                    <WifiOff size={14} /> Reconnecting...
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar Panel (History & Controls) */}
          <div className="sidebar-section">
            <div className="glass-panel sidebar-card">
              <div className="sidebar-header">
                <History size={16} />
                <h3>Game Log</h3>
              </div>
              
              <div className="log-list">
                {roomData.moveHistory && roomData.moveHistory.length > 0 ? (
                  roomData.moveHistory.map((item, idx) => {
                    const isMe = item.playerUid === user.uid;
                    return (
                      <div key={idx} className="log-item">
                        <span className="log-time">
                          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <span className={`log-actor ${isMe ? 'actor-me' : 'actor-op'}`}>
                          {isMe ? 'You' : item.playerName}
                        </span>
                        <span className="log-action">
                          called <strong className="log-number">{item.number}</strong>
                        </span>
                      </div>
                    );
                  })
                ) : (
                  <div className="log-empty">
                    <p>No moves made yet.</p>
                    <p className="subtext">Select a number when it is your turn.</p>
                  </div>
                )}
                <div ref={historyEndRef} />
              </div>

              {roomData.gameStatus === 'playing' && (
                <div className="sidebar-footer">
                  <p className="turn-tip">
                    {isMyTurn 
                      ? "Select any remaining number to strike it on both grids." 
                      : "Wait for your opponent to select a number."}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* GAME OVER CELEBRATION / DEFEAT MODAL */}
      {isGameOver && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel gameover-modal text-center animate-zoom">
            <div className="gameover-badge">
              <Trophy size={40} className="trophy-gold" />
            </div>

            <h2 className="gameover-title">
              {isWinner ? (
                <span className="victory-text">BINGO!</span>
              ) : (
                <span className="defeat-text">GAME OVER</span>
              )}
            </h2>

            <p className="gameover-subtitle">
              {isWinner 
                ? "You matched 5 lines and claimed the victory!" 
                : `${winnerName || 'Your Opponent'} completed BINGO first!`}
            </p>

            <div className="gameover-stats">
              <div className="stat-box">
                <span className="stat-val">{myCompletedCount}</span>
                <span className="stat-lbl">Your Lines</span>
              </div>
              <div className="stat-box">
                <span className="stat-val">{opponentCompletedCount}</span>
                <span className="stat-lbl">Opponent Lines</span>
              </div>
            </div>

            {!opponent && (
              <div className="forfeit-notice">
                ⚠️ Opponent left the match. Won by forfeit.
              </div>
            )}

            <div className="gameover-actions">
              <button className="btn btn-secondary" onClick={handleLeaveRoom}>
                <LogOut size={16} /> Exit Lobby
              </button>
              <button className="btn btn-primary" onClick={actions.restartGame}>
                <RefreshCw size={16} /> Play Again
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        /* Overrides for header to keep it compact */
        .header-bar {
          margin: 10px auto !important;
          padding: 8px 20px !important;
        }

        .room-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 20px 10px 20px;
          width: 90%;
          height: calc(100vh - 90px);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        /* Lobby styles */
        .lobby-panel {
          max-width: 480px;
          margin: 30px auto;
          padding: 30px;
          text-align: center;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
        }

        .lobby-icon {
          width: 50px;
          height: 50px;
          color: hsl(var(--primary));
          filter: drop-shadow(0 0 12px hsla(var(--primary), 0.5));
          margin-bottom: 4px;
        }

        .lobby-header h2 {
          font-size: 1.4rem;
          margin-bottom: 4px;
        }

        .lobby-header p {
          color: hsl(var(--text-secondary));
          font-size: 0.85rem;
        }

        .code-box-container {
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid var(--border-color);
          border-radius: 14px;
          padding: 12px 20px;
          width: 100%;
        }

        .code-label {
          font-size: 0.7rem;
          color: hsl(var(--text-muted));
          text-transform: uppercase;
          letter-spacing: 0.1em;
          display: block;
          margin-bottom: 4px;
        }

        .code-value-row {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 12px;
        }

        .code-text {
          font-family: var(--font-heading);
          font-size: 1.8rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          color: white;
        }

        .copy-btn {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: white;
          width: 38px;
          height: 38px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: var(--transition-smooth);
        }

        .copy-btn:hover {
          background: rgba(255, 255, 255, 0.12);
          border-color: var(--card-border-hover);
        }

        .copy-success {
          color: #10b981;
          filter: drop-shadow(0 0 6px rgba(16, 185, 129, 0.4));
        }

        .lobby-status {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 0.8rem;
          color: hsl(var(--text-secondary));
        }

        .pulse-loader {
          width: 8px;
          height: 8px;
          background-color: hsl(var(--secondary));
          border-radius: 50%;
          animation: pulseGlow 1.5s infinite;
        }

        /* Gameplay layout */
        .gameplay-grid {
          display: grid;
          grid-template-columns: 1fr 300px;
          gap: 20px;
          align-items: stretch;
          flex: 1;
          min-height: 0;
          overflow: hidden;
          height: 100%;
        }

        .board-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
          min-height: 0;
          overflow: hidden;
          height: 100%;
        }

        .scoreboard-card {
          padding: 12px 24px;
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          align-items: center;
          gap: 16px;
          text-align: center;
          margin-bottom: 0;
        }

        .player-score-block {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .player-tag {
          font-size: 0.6rem;
          font-weight: 800;
          letter-spacing: 0.1em;
          color: hsl(var(--text-muted));
        }

        .player-name {
          font-family: var(--font-heading);
          font-size: 1rem;
          font-weight: 700;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .vs-badge {
          background: linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--accent)) 100%);
          width: 32px;
          height: 32px;
          border-radius: 50%;
          font-family: var(--font-heading);
          font-size: 0.7rem;
          font-weight: 800;
          color: white;
          box-shadow: 0 0 10px hsla(var(--primary), 0.3);
        }

        .bingo-letters-container {
          display: flex;
          justify-content: center;
          gap: 4px;
          margin-top: 4px;
        }

        .bingo-letter-badge {
          width: 24px;
          height: 24px;
          border-radius: 5px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.05);
          font-family: var(--font-heading);
          font-size: 0.8rem;
          font-weight: 800;
          color: hsl(var(--text-muted));
          display: flex;
          align-items: center;
          justify-content: center;
          transition: var(--transition-smooth);
        }

        .player-me .letter-active {
          background: linear-gradient(135deg, hsl(var(--secondary)) 0%, hsl(var(--primary)) 100%);
          color: #05050e;
          border-color: transparent;
          box-shadow: 0 0 8px hsla(var(--secondary), 0.5);
        }

        .player-opponent .letter-active {
          background: linear-gradient(135deg, hsl(var(--accent)) 0%, hsl(var(--primary)) 100%);
          color: white;
          border-color: transparent;
          box-shadow: 0 0 8px hsla(var(--accent), 0.4);
        }

        /* Turn banner */
        .turn-banner-container {
          display: flex;
          justify-content: center;
        }

        .turn-badge {
          font-family: var(--font-heading);
          font-size: 0.8rem;
          font-weight: 800;
          letter-spacing: 0.1em;
          padding: 6px 20px;
          border-radius: 30px;
          border: 1px solid transparent;
        }

        .turn-my {
          background: rgba(6, 182, 212, 0.1);
          border-color: rgba(6, 182, 212, 0.3);
          color: hsl(var(--secondary));
          animation: turnPulse 2s infinite ease-in-out;
          box-shadow: 0 0 10px rgba(6, 182, 212, 0.1);
        }

        .turn-opponent {
          background: rgba(255, 255, 255, 0.03);
          border-color: rgba(255, 255, 255, 0.08);
          color: hsl(var(--text-secondary));
        }

        .turn-ended {
          background: rgba(239, 68, 68, 0.1);
          border-color: rgba(239, 68, 68, 0.3);
          color: #f87171;
        }

        /* Bingo board card spacing */
        .board-card {
          padding: 12px;
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 0;
          overflow: hidden;
        }

        .grid-5x5 {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          grid-template-rows: repeat(5, 1fr);
          gap: 8px;
          width: 100%;
          height: 100%;
          max-width: min(48vh, 390px);
          max-height: min(48vh, 390px);
          aspect-ratio: 1;
        }

        .grid-cell {
          background: rgba(255, 255, 255, 0.02);
          border: 1.5px solid rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          color: white;
          font-family: var(--font-heading);
          font-size: 1.25rem;
          font-weight: 700;
          cursor: pointer;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: var(--transition-smooth);
          overflow: hidden;
          user-select: none;
          outline: none;
        }

        .grid-cell:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.08);
          border-color: hsl(var(--secondary));
          transform: translateY(-1px) scale(1.02);
          box-shadow: 0 4px 10px hsla(var(--secondary), 0.25);
        }

        .grid-cell:active:not(:disabled) {
          transform: scale(0.96);
        }

        .cell-disabled {
          cursor: not-allowed;
          opacity: 0.65;
        }

        .cell-crossed {
          background: rgba(25, 20, 45, 0.6) !important;
          border-color: rgba(255, 255, 255, 0.03) !important;
          color: hsl(var(--text-muted)) !important;
          cursor: not-allowed;
          transform: none !important;
          box-shadow: none !important;
          animation: stampPop 0.45s ease-out;
        }

        .strike-marker {
          position: absolute;
          width: 75%;
          height: 2px;
          background: linear-gradient(90deg, transparent, hsl(var(--primary)), transparent);
          border-radius: 2px;
          transform: rotate(-30deg);
          box-shadow: 0 0 8px hsla(var(--primary), 0.8);
        }

        .cell-winning {
          animation: winningLinePulsate 2s infinite ease-in-out !important;
          border-color: transparent !important;
          color: #05050e !important;
        }

        .cell-winning .strike-marker {
          background: #05050e;
          box-shadow: none;
        }

        /* Meta bar (Leave & Status) */
        .meta-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 4px;
        }

        .btn-sm {
          padding: 6px 12px;
          font-size: 0.8rem;
          border-radius: 8px;
        }

        .meta-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.75rem;
          font-weight: 600;
        }

        .meta-connected {
          color: #34d399;
        }

        .meta-reconnecting {
          color: #fbbf24;
          animation: pulse 1.5s infinite;
        }

        /* Sidebar & Move Logs (Flex container height constrained) */
        .sidebar-section {
          height: 100%;
          min-height: 0;
          overflow: hidden;
        }

        .sidebar-card {
          padding: 16px;
          display: flex;
          flex-direction: column;
          height: 100%;
          max-height: 100%;
          box-sizing: border-box;
        }

        .sidebar-header {
          display: flex;
          align-items: center;
          gap: 6px;
          border-bottom: 1px solid var(--border-color);
          padding-bottom: 8px;
          margin-bottom: 12px;
        }

        .sidebar-header h3 {
          font-size: 0.85rem;
          color: white;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .log-list {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 8px;
          padding-right: 4px;
          min-height: 0;
        }

        .log-item {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 8px;
          padding: 8px 10px;
          font-size: 0.75rem;
          display: flex;
          align-items: center;
          gap: 6px;
          line-height: 1.3;
        }

        .log-time {
          color: hsl(var(--text-muted));
          font-size: 0.7rem;
        }

        .log-actor {
          font-weight: 700;
        }

        .actor-me {
          color: hsl(var(--secondary));
        }

        .actor-op {
          color: hsl(var(--accent));
        }

        .log-action {
          color: hsl(var(--text-secondary));
        }

        .log-number {
          background: rgba(255, 255, 255, 0.08);
          padding: 1px 4px;
          border-radius: 3px;
          color: white;
        }

        .log-empty {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          text-align: center;
          color: hsl(var(--text-muted));
        }

        .log-empty p {
          font-size: 0.8rem;
        }

        .log-empty .subtext {
          font-size: 0.7rem;
          margin-top: 2px;
        }

        .sidebar-footer {
          margin-top: 10px;
          border-top: 1px solid var(--border-color);
          padding-top: 8px;
        }

        .turn-tip {
          font-size: 0.7rem;
          color: hsl(var(--text-muted));
          text-align: center;
          line-height: 1.3;
        }

        /* GameOver Modal */
        .gameover-modal {
          max-width: 400px;
          padding: 30px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }

        .gameover-badge {
          background: rgba(245, 158, 11, 0.12);
          border: 1.5px solid rgba(245, 158, 11, 0.3);
          border-radius: 50%;
          width: 60px;
          height: 60px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 15px rgba(245, 158, 11, 0.2);
        }

        .trophy-gold {
          color: hsl(var(--gold));
          animation: float 2.5s ease-in-out infinite;
          width: 30px;
          height: 30px;
        }

        .gameover-title {
          font-size: 1.8rem;
          font-weight: 900;
          letter-spacing: 0.05em;
        }

        .victory-text {
          background: linear-gradient(135deg, hsl(var(--gold)) 0%, hsl(var(--accent)) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0 0 10px rgba(245, 158, 11, 0.4));
        }

        .defeat-text {
          background: linear-gradient(135deg, #f87171 0%, hsl(var(--primary)) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .gameover-subtitle {
          color: hsl(var(--text-secondary));
          font-size: 0.85rem;
        }

        .gameover-stats {
          display: flex;
          width: 100%;
          gap: 12px;
          margin: 4px 0;
        }

        .stat-box {
          flex: 1;
          background: rgba(0, 0, 0, 0.35);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 10px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }

        .stat-val {
          font-family: var(--font-heading);
          font-size: 1.4rem;
          font-weight: 800;
          color: white;
        }

        .stat-lbl {
          font-size: 0.65rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: hsl(var(--text-muted));
        }

        .forfeit-notice {
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.2);
          border-radius: 8px;
          color: hsl(var(--gold));
          padding: 8px 12px;
          font-size: 0.75rem;
          width: 100%;
          text-align: center;
        }

        .gameover-actions {
          display: flex;
          width: 100%;
          gap: 10px;
          margin-top: 8px;
        }

        .gameover-actions button {
          flex: 1;
        }

        /* Animations */
        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: .7; transform: scale(1.05); }
        }

        .animate-zoom {
          animation: modalZoomIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        @media (max-width: 900px) {
          .gameplay-grid {
            grid-template-columns: 1fr;
            overflow-y: auto;
            align-items: start;
          }
          
          .room-container {
            height: auto;
            overflow-y: auto;
          }
          
          .sidebar-card {
            height: 280px;
            max-height: 280px;
          }
        }

        @media (max-width: 600px) {
          .scoreboard-card {
            grid-template-columns: 1fr;
            gap: 8px;
            padding: 10px 16px;
          }
          
          .vs-badge {
            display: none;
          }

          .grid-cell {
            font-size: 1.1rem;
            border-radius: 10px;
          }
          
          .grid-5x5 {
            gap: 6px;
          }
          
          .room-container {
            padding: 0 10px;
            width: 95%;
          }
          
          .lobby-panel {
            padding: 20px;
            margin: 15px auto;
          }
          
          .code-text {
            font-size: 1.6rem;
          }
        }
      `}</style>
    </div>
  );
}
