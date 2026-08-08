import React, { useState } from 'react';
import { X, Play, Users, Grid, Sparkles } from 'lucide-react';

export default function BingoCreateModal({ isOpen, onClose, onCreate, user }) {
  const [hostName, setHostName] = useState(user?.name || 'Player');
  const [boardSize, setBoardSize] = useState(6);
  const [maxPlayers, setMaxPlayers] = useState(2);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onCreate({
      hostName: hostName.trim() || 'Player',
      boardSize: Number(boardSize),
      maxPlayers: maxPlayers ? Number(maxPlayers) : 999,
    });
  };

  const BOARD_SIZES = [5, 6, 7, 8, 9, 10];

  return (
    <div className="modal-overlay flex-center">
      <div className="modal-content glass-card bingo-create-modal">
        <div className="modal-header">
          <div className="flex-center-y gap-2">
            <Sparkles size={20} className="icon-primary" />
            <h3>Create Classic Bingo Room</h3>
          </div>
          <button className="btn-icon" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label>Host Nickname</label>
            <input
              type="text"
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              placeholder="Your gamer tag"
              maxLength={15}
              required
            />
          </div>

          <div className="form-group">
            <label className="flex-center-y gap-2">
              <Grid size={16} className="icon-accent" />
              Board Grid Size (6x6 to 10x10)
            </label>
            <div className="board-size-grid">
              {BOARD_SIZES.map((sz) => (
                <button
                  key={sz}
                  type="button"
                  className={`size-chip ${boardSize === sz ? 'selected' : ''}`}
                  onClick={() => setBoardSize(sz)}
                >
                  <span className="size-dim">{sz}×{sz}</span>
                  <span className="size-label">{sz * sz} Numbers</span>
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label className="flex-center-y gap-2">
              <Users size={16} className="icon-secondary" />
              Maximum Players Allowed
            </label>
            <select
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(e.target.value)}
              className="styled-select"
            >
              <option value="2">2 Players (1v1 Duel)</option>
              <option value="3">3 Players</option>
              <option value="4">4 Players</option>
              <option value="5">5 Players</option>
              <option value="6">6 Players</option>
              <option value="8">8 Players</option>
              <option value="10">10 Players Party</option>
              <option value="15">15 Players</option>
              <option value="20">20 Players</option>
              <option value="50">50 Players Mega</option>
              <option value="999">Unlimited Players</option>
            </select>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary glow-btn">
              <Play size={16} /> Create {boardSize}x{boardSize} Room
            </button>
          </div>
        </form>
      </div>

      <style>{`
        .bingo-create-modal {
          max-width: 480px;
          width: 90%;
        }

        .board-size-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          margin-top: 6px;
        }

        .size-chip {
          background: rgba(255, 255, 255, 0.03);
          border: 1.5px solid rgba(255, 255, 255, 0.08);
          border-radius: 12px;
          padding: 10px 8px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          cursor: pointer;
          transition: var(--transition-smooth);
        }

        .size-chip:hover {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(255, 255, 255, 0.2);
          transform: translateY(-2px);
        }

        .size-chip.selected {
          background: rgba(6, 182, 212, 0.15);
          border-color: hsl(var(--secondary));
          box-shadow: 0 0 15px hsla(var(--secondary), 0.3);
        }

        .size-dim {
          font-family: var(--font-heading);
          font-weight: 800;
          font-size: 1.1rem;
          color: white;
        }

        .size-chip.selected .size-dim {
          color: hsl(var(--secondary));
        }

        .size-label {
          font-size: 0.68rem;
          color: hsl(var(--text-muted));
          text-transform: uppercase;
        }

        .styled-select {
          width: 100%;
          padding: 12px 14px;
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid var(--border-color);
          border-radius: 12px;
          color: white;
          font-size: 0.95rem;
          outline: none;
        }

        .styled-select option {
          background: #0f172a;
          color: white;
        }
      `}</style>
    </div>
  );
}
