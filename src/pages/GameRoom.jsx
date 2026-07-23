import React, { useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  LogOut, RefreshCw, Trophy, 
  History, Wifi, WifiOff, AlertCircle, ArrowLeft, Crown
} from 'lucide-react';
import confetti from 'canvas-confetti';

import { useGame } from '../hooks/useGame';
import { checkBingo } from '../utils/bingoEngine';
import WaitingRoom from '../components/WaitingRoom';
import BingoBoard from '../components/BingoBoard';
import ProgressBar from '../components/ProgressBar';

export default function GameRoom({ user }) {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  
  // Custom game management hook
  const {
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
    actions
  } = useGame(roomCode?.toUpperCase(), user);

  const historyEndRef = useRef(null);

  // Scroll to bottom of move history whenever it changes
  useEffect(() => {
    if (historyEndRef.current) {
      historyEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [roomData?.moveHistory]);

  // Victory Confetti Celebration
  useEffect(() => {
    if (isGameOver && isWinner) {
      const duration = 3.5 * 1000;
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 1100 };

      const randomInRange = (min, max) => Math.random() * (max - min) + min;

      const interval = setInterval(() => {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) {
          return clearInterval(interval);
        }
        const particleCount = 50 * (timeLeft / duration);
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 } });
        confetti({ ...defaults, particleCount, origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 } });
      }, 250);

      return () => clearInterval(interval);
    }
  }, [isGameOver, isWinner]);

  const handleLeaveRoom = async () => {
    if (window.confirm('Are you sure you want to leave?')) {
      await actions.leaveRoom();
      navigate('/');
    }
  };

  if (loading) {
    return (
      <div className="room-loading-screen flex-center">
        <div className="spinner"></div>
        <p>SYNCHRONIZING GAME LOBBY {roomCode?.toUpperCase()}...</p>
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
        <h2>Room Notification</h2>
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
            max-width: 440px;
          }
        `}</style>
      </div>
    );
  }

  // Calculate my board highlights
  const myBoard = me?.board || [];
  const crossedNumbers = roomData.crossedNumbers || [];
  const myBingoResult = checkBingo(myBoard, crossedNumbers, boardSize);
  const highlightIndices = myBingoResult.completedIndices;

  return (
    <div className="room-container">
      {/* LOBBY VIEW (WAITING FOR PLAYERS) */}
      {roomData.gameStatus === 'waiting' && (
        <WaitingRoom
          roomCode={roomCode}
          boardSize={boardSize}
          maxPlayers={maxPlayers}
          playersList={playersList}
          hostName={hostName}
          isHost={isHost}
          me={me}
          onStartGame={actions.startGame}
          onToggleReady={actions.toggleReady}
          onLeaveRoom={handleLeaveRoom}
        />
      )}

      {/* GAMEPLAY VIEW */}
      {(roomData.gameStatus === 'playing' || roomData.gameStatus === 'gameover') && (
        <div className="gameplay-grid">
          {/* Main game board column */}
          <div className="board-section">
            {/* Scoreboard Header for Multi-players */}
            <div className="glass-panel scoreboard-card">
              <div className="scoreboard-players-row">
                {playersList.map((player) => {
                  const isMe = player.uid === me?.uid;
                  const linesCount = (roomData.completedLines && roomData.completedLines[player.uid]) || 0;
                  const isCurrentTurn = roomData.currentTurn === player.uid;

                  return (
                    <div 
                      key={player.uid} 
                      className={`player-score-block ${isMe ? 'player-me' : ''} ${isCurrentTurn ? 'turn-active-player' : ''}`}
                    >
                      <div className="player-top-line">
                        <span className="player-tag">{isMe ? 'YOU' : 'PLAYER'}</span>
                        {player.uid === roomData.hostId && <Crown size={10} className="icon-gold" />}
                      </div>
                      <span className="player-name" title={player.name}>{player.name}</span>
                      <div className="player-lines-count">
                        {linesCount} / {targetLines} Lines
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Dynamic Progress Bar for Current User */}
            <div className="glass-panel progress-card">
              <ProgressBar 
                completedCount={myCompletedCount} 
                targetLines={targetLines} 
                label={`Your Progress (${boardSize}x${boardSize} Board)`}
              />
            </div>

            {/* Turn status indicator */}
            <div className="turn-banner-container">
              {roomData.gameStatus === 'gameover' ? (
                <div className="turn-badge turn-ended">Game Over</div>
              ) : isMyTurn ? (
                <div className="turn-badge turn-my">YOUR TURN - SELECT A NUMBER</div>
              ) : (
                <div className="turn-badge turn-opponent">
                  {currentTurnPlayer ? `${currentTurnPlayer.name.toUpperCase()}'S TURN` : "OPPONENT'S TURN"}
                </div>
              )}
            </div>

            {/* Bingo Grid */}
            <BingoBoard
              board={myBoard}
              boardSize={boardSize}
              crossedNumbers={crossedNumbers}
              highlightIndices={highlightIndices}
              isMyTurn={isMyTurn}
              gameStatus={roomData.gameStatus}
              onSelectCell={actions.selectCell}
            />
            
            {/* Meta Bar */}
            <div className="meta-bar">
              <button className="btn btn-secondary btn-sm" onClick={handleLeaveRoom}>
                <LogOut size={14} /> Leave Match
              </button>
              
              <div className="meta-right">
                {connectionStatus === 'connected' ? (
                  <span className="meta-badge meta-connected">
                    <Wifi size={14} /> Synced Realtime
                  </span>
                ) : (
                  <span className="meta-badge meta-reconnecting">
                    <WifiOff size={14} /> Reconnecting...
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar Panel (Game Log & Controls) */}
          <div className="sidebar-section">
            <div className="glass-panel sidebar-card">
              <div className="sidebar-header">
                <History size={16} />
                <h3>Game Log</h3>
              </div>
              
              <div className="log-list">
                {roomData.moveHistory && roomData.moveHistory.length > 0 ? (
                  roomData.moveHistory.map((item, idx) => {
                    const isMe = item.playerUid === user?.uid;
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
                    <p className="subtext">Numbers clicked will be struck on all boards.</p>
                  </div>
                )}
                <div ref={historyEndRef} />
              </div>

              {roomData.gameStatus === 'playing' && (
                <div className="sidebar-footer">
                  <p className="turn-tip">
                    {isMyTurn 
                      ? "Select any uncrossed number to mark it for all players." 
                      : `Waiting for ${currentTurnPlayer?.name || 'opponent'} to pick a number...`}
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
                <span className="victory-text">BINGO VICTORY!</span>
              ) : (
                <span className="defeat-text">MATCH ENDED</span>
              )}
            </h2>

            <p className="gameover-subtitle">
              {isWinner 
                ? `You completed ${targetLines} lines first and won the match!` 
                : `${winnerName || 'Opponent'} completed ${targetLines} lines and claimed BINGO!`}
            </p>

            <div className="gameover-stats">
              {playersList.map((player) => {
                const count = (roomData.completedLines && roomData.completedLines[player.uid]) || 0;
                const isMe = player.uid === user?.uid;
                const isWin = player.uid === roomData.winner;

                return (
                  <div key={player.uid} className={`stat-box ${isWin ? 'stat-winner' : ''}`}>
                    <span className="stat-val">{count} / {targetLines}</span>
                    <span className="stat-lbl">{player.name} {isMe ? '(You)' : ''}</span>
                  </div>
                );
              })}
            </div>

            {playersList.length < 2 && (
              <div className="forfeit-notice">
                ⚠️ Other players left the match. Victory claimed by forfeit.
              </div>
            )}

            <div className="gameover-actions">
              <button className="btn btn-secondary" onClick={handleLeaveRoom}>
                <LogOut size={16} /> Exit Lobby
              </button>
              {isHost && (
                <button className="btn btn-primary" onClick={actions.restartGame}>
                  <RefreshCw size={16} /> Play Again
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .room-container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 20px 10px 20px;
          width: 92%;
          height: calc(100vh - 90px);
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .gameplay-grid {
          display: grid;
          grid-template-columns: 1fr 300px;
          gap: 16px;
          align-items: stretch;
          flex: 1;
          min-height: 0;
          overflow: hidden;
          height: 100%;
        }

        .board-section {
          display: flex;
          flex-direction: column;
          gap: 10px;
          min-height: 0;
          overflow: hidden;
          height: 100%;
        }

        .scoreboard-card {
          padding: 10px 16px;
          overflow-x: auto;
        }

        .scoreboard-players-row {
          display: flex;
          gap: 10px;
          justify-content: center;
          align-items: center;
        }

        .player-score-block {
          flex: 1;
          min-width: 100px;
          max-width: 160px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 10px;
          padding: 6px 10px;
          text-align: center;
          display: flex;
          flex-direction: column;
          gap: 2px;
          transition: var(--transition-smooth);
        }

        .player-me {
          background: rgba(6, 182, 212, 0.08);
          border-color: rgba(6, 182, 212, 0.25);
        }

        .turn-active-player {
          border-color: hsl(var(--secondary)) !important;
          box-shadow: 0 0 10px hsla(var(--secondary), 0.3);
        }

        .player-top-line {
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 4px;
        }

        .player-tag {
          font-size: 0.6rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          color: hsl(var(--text-muted));
        }

        .icon-gold {
          color: hsl(var(--gold));
        }

        .player-name {
          font-family: var(--font-heading);
          font-size: 0.88rem;
          font-weight: 700;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .player-lines-count {
          font-size: 0.72rem;
          font-weight: 800;
          color: hsl(var(--secondary));
        }

        .progress-card {
          padding: 10px 16px;
        }

        /* Turn banner */
        .turn-banner-container {
          display: flex;
          justify-content: center;
        }

        .turn-badge {
          font-family: var(--font-heading);
          font-size: 0.78rem;
          font-weight: 800;
          letter-spacing: 0.08em;
          padding: 5px 18px;
          border-radius: 30px;
          border: 1px solid transparent;
        }

        .turn-my {
          background: rgba(6, 182, 212, 0.12);
          border-color: rgba(6, 182, 212, 0.35);
          color: hsl(var(--secondary));
          animation: turnPulse 2s infinite ease-in-out;
          box-shadow: 0 0 10px rgba(6, 182, 212, 0.15);
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

        .meta-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 0 4px;
        }

        .btn-sm {
          padding: 5px 10px;
          font-size: 0.75rem;
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
          max-width: 440px;
          padding: 28px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }

        .gameover-badge {
          background: rgba(245, 158, 11, 0.12);
          border: 1.5px solid rgba(245, 158, 11, 0.3);
          border-radius: 50%;
          width: 58px;
          height: 58px;
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
          font-size: 1.7rem;
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
          gap: 8px;
          flex-wrap: wrap;
          margin: 4px 0;
        }

        .stat-box {
          flex: 1;
          min-width: 90px;
          background: rgba(0, 0, 0, 0.35);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          padding: 8px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }

        .stat-winner {
          border-color: hsl(var(--gold));
          background: rgba(245, 158, 11, 0.1);
        }

        .stat-val {
          font-family: var(--font-heading);
          font-size: 1.25rem;
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
          margin-top: 6px;
        }

        .gameover-actions button {
          flex: 1;
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
            height: 250px;
            max-height: 250px;
          }
        }
      `}</style>
    </div>
  );
}
