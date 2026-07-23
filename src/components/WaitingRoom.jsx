import React, { useState } from 'react';
import { Copy, Check, Users, Play, LogOut, Grid, Crown, CheckCircle2, Clock } from 'lucide-react';

export default function WaitingRoom({
  roomCode,
  boardSize = 5,
  maxPlayers = 2,
  playersList = [],
  hostName,
  isHost,
  me,
  onStartGame,
  onToggleReady,
  onLeaveRoom,
}) {
  const [copied, setCopied] = useState(false);

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode.toUpperCase());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentJoinedCount = playersList.length;
  const canStartGame = isHost && currentJoinedCount >= 2;
  const isMyReady = me?.isReady || isHost;

  return (
    <div className="glass-panel waiting-room-container">
      <div className="waiting-room-header text-center">
        <div className="lobby-badge">
          <Users className="animate-pulse icon-primary" size={28} />
        </div>
        <h2>GAME LOBBY</h2>
        <p className="subtitle">Waiting for players to join the match...</p>
      </div>

      {/* Main Room Metadata Grid */}
      <div className="room-meta-grid">
        {/* Room Code Card */}
        <div className="meta-card code-card">
          <span className="meta-card-label">ROOM CODE</span>
          <div className="code-display-row">
            <span className="code-value">{roomCode.toUpperCase()}</span>
            <button className="copy-code-btn" onClick={handleCopyCode} title="Copy Code">
              {copied ? <Check size={18} className="text-success" /> : <Copy size={18} />}
            </button>
          </div>
        </div>

        {/* Board Size */}
        <div className="meta-card">
          <div className="meta-icon-label">
            <Grid size={14} className="icon-accent" />
            <span>BOARD SIZE</span>
          </div>
          <span className="meta-value">{boardSize} × {boardSize}</span>
        </div>

        {/* Max Players */}
        <div className="meta-card">
          <div className="meta-icon-label">
            <Users size={14} className="icon-secondary" />
            <span>MAX PLAYERS</span>
          </div>
          <span className="meta-value">{maxPlayers} Players</span>
        </div>
      </div>

      {/* Player List Card */}
      <div className="player-roster-section">
        <div className="roster-header flex-between">
          <div className="roster-title-group">
            <Users size={16} />
            <h3>PLAYERS JOINED</h3>
          </div>
          <span className="roster-count-pill">{currentJoinedCount} / {maxPlayers}</span>
        </div>

        <div className="player-list">
          {playersList.map((player) => {
            const isPlayerHost = player.uid === (playersList[0]?.uid);
            const isMe = player.uid === me?.uid;

            return (
              <div key={player.uid} className={`player-row ${isMe ? 'player-me-row' : ''}`}>
                <div className="player-info flex-center-y">
                  <span className="status-icon">
                    {(player.isReady || isPlayerHost) ? (
                      <CheckCircle2 size={18} className="text-success" />
                    ) : (
                      <Clock size={18} className="text-warning animate-pulse" />
                    )}
                  </span>

                  <span className="player-display-name">
                    {player.name} {isMe && <span className="you-tag">(You)</span>}
                  </span>

                  {isPlayerHost && (
                    <span className="host-badge flex-center-y" title="Room Host">
                      <Crown size={12} /> Host
                    </span>
                  )}
                </div>

                <div className="player-ready-status">
                  {(player.isReady || isPlayerHost) ? (
                    <span className="ready-tag ready-yes">READY</span>
                  ) : (
                    <span className="ready-tag ready-no">WAITING</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Waiting Indicator Banner */}
      <div className="status-footer-banner text-center">
        {currentJoinedCount < 2 ? (
          <div className="status-message text-muted flex-center">
            <div className="pulse-dot"></div>
            <span>Waiting for at least 1 more player to join...</span>
          </div>
        ) : isHost ? (
          <div className="status-message text-ready flex-center">
            <span>Room is ready! Click below to start the game.</span>
          </div>
        ) : (
          <div className="status-message text-muted flex-center">
            <div className="pulse-dot"></div>
            <span>Waiting for host ({hostName}) to start the game...</span>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="waiting-room-actions flex-gap">
        <button className="btn btn-secondary flex-1" onClick={onLeaveRoom}>
          <LogOut size={16} /> Leave Room
        </button>

        {!isHost && (
          <button 
            className={`btn ${isMyReady ? 'btn-secondary' : 'btn-accent'} flex-1`}
            onClick={() => onToggleReady(!isMyReady)}
          >
            {isMyReady ? 'Mark Unready' : 'Ready Up'}
          </button>
        )}

        {isHost && (
          <button
            className="btn btn-primary flex-1 start-game-btn"
            disabled={!canStartGame}
            onClick={onStartGame}
          >
            <Play size={18} /> Start Game
          </button>
        )}
      </div>

      <style>{`
        .waiting-room-container {
          max-width: 520px;
          margin: 20px auto;
          padding: 28px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .lobby-badge {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          background: rgba(139, 92, 246, 0.12);
          border: 1px solid rgba(139, 92, 246, 0.25);
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 8px auto;
        }

        .waiting-room-header h2 {
          font-size: 1.5rem;
          font-weight: 800;
          letter-spacing: 0.05em;
        }

        .subtitle {
          color: hsl(var(--text-secondary));
          font-size: 0.85rem;
          margin-top: 2px;
        }

        .room-meta-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }

        .code-card {
          grid-column: span 2;
          background: rgba(0, 0, 0, 0.4) !important;
        }

        .meta-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 14px;
          padding: 12px 16px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .meta-card-label, .meta-icon-label {
          font-size: 0.68rem;
          font-weight: 700;
          letter-spacing: 0.08em;
          color: hsl(var(--text-muted));
          display: flex;
          align-items: center;
          gap: 6px;
          text-transform: uppercase;
        }

        .code-display-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .code-value {
          font-family: var(--font-heading);
          font-size: 1.8rem;
          font-weight: 900;
          letter-spacing: 0.12em;
          color: white;
        }

        .copy-code-btn {
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: white;
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: var(--transition-smooth);
        }

        .copy-code-btn:hover {
          background: rgba(255, 255, 255, 0.15);
        }

        .meta-value {
          font-family: var(--font-heading);
          font-size: 1.1rem;
          font-weight: 700;
          color: white;
        }

        .player-roster-section {
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid rgba(255, 255, 255, 0.06);
          border-radius: 16px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .roster-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .roster-title-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .roster-title-group h3 {
          font-size: 0.8rem;
          font-weight: 800;
          letter-spacing: 0.06em;
          color: white;
        }

        .roster-count-pill {
          font-family: var(--font-heading);
          font-size: 0.75rem;
          font-weight: 700;
          background: rgba(255, 255, 255, 0.08);
          padding: 2px 8px;
          border-radius: 10px;
          color: hsl(var(--secondary));
        }

        .player-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          max-height: 220px;
          overflow-y: auto;
        }

        .player-row {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 10px;
          padding: 8px 12px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          transition: var(--transition-smooth);
        }

        .player-me-row {
          background: rgba(6, 182, 212, 0.05);
          border-color: rgba(6, 182, 212, 0.2);
        }

        .player-info {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .status-icon {
          display: flex;
          align-items: center;
        }

        .player-display-name {
          font-weight: 600;
          font-size: 0.9rem;
          color: white;
        }

        .you-tag {
          font-size: 0.75rem;
          color: hsl(var(--secondary));
          margin-left: 4px;
        }

        .host-badge {
          background: rgba(245, 158, 11, 0.15);
          color: hsl(var(--gold));
          border: 1px solid rgba(245, 158, 11, 0.3);
          font-size: 0.65rem;
          font-weight: 800;
          padding: 1px 6px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 4px;
          text-transform: uppercase;
        }

        .ready-tag {
          font-size: 0.65rem;
          font-weight: 800;
          letter-spacing: 0.05em;
          padding: 2px 8px;
          border-radius: 6px;
        }

        .ready-yes {
          background: rgba(16, 185, 129, 0.12);
          color: #34d399;
          border: 1px solid rgba(16, 185, 129, 0.25);
        }

        .ready-no {
          background: rgba(245, 158, 11, 0.1);
          color: #fbbf24;
          border: 1px solid rgba(245, 158, 11, 0.2);
        }

        .status-footer-banner {
          background: rgba(0, 0, 0, 0.3);
          border-radius: 12px;
          padding: 10px;
          font-size: 0.8rem;
        }

        .status-message {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }

        .pulse-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: hsl(var(--secondary));
          animation: pulse 1.5s infinite;
        }

        .text-ready {
          color: #34d399;
          font-weight: 600;
        }

        .waiting-room-actions {
          display: flex;
          gap: 12px;
        }

        .start-game-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
