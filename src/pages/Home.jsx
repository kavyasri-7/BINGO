import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, ArrowRight, User, AlertCircle, Grid, Users } from 'lucide-react';
import { gameDb } from '../services/db';

export default function Home({ user, updateUsername }) {
  const navigate = useNavigate();
  const [nameInput, setNameInput] = useState(user?.name || '');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  
  // Host Configuration State
  const [selectedBoardSize, setSelectedBoardSize] = useState(5);
  const [selectedMaxPlayers, setSelectedMaxPlayers] = useState(2);
  
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const triggerToast = (message, type = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleNameChange = (e) => {
    const val = e.target.value.substring(0, 15);
    setNameInput(val);
    updateUsername(val);
  };

  const handleCreateGame = async () => {
    const displayName = nameInput.trim() || user?.name || 'Player';
    setLoading(true);
    try {
      const code = await gameDb.createRoom(displayName, user.uid, {
        boardSize: selectedBoardSize,
        maxPlayers: selectedMaxPlayers,
      });
      triggerToast('Room created! Entering lobby...', 'success');
      navigate(`/room/${code}`);
    } catch (err) {
      console.error(err);
      triggerToast(err.message || 'Failed to create game room.');
      setLoading(false);
    }
  };

  const handleJoinGame = async (e) => {
    e.preventDefault();
    const code = roomCodeInput.trim().toUpperCase();
    const displayName = nameInput.trim() || user?.name || 'Player';

    if (!code) {
      triggerToast('Please enter a room code.');
      return;
    }

    if (code.length !== 6) {
      triggerToast('Room code must be exactly 6 characters.');
      return;
    }

    setLoading(true);

    try {
      await gameDb.joinRoom(code, displayName, user.uid);
      triggerToast('Joined room! Entering lobby...', 'success');
      navigate(`/room/${code}`);
    } catch (err) {
      console.error(err);
      // Requirement 6: Display exact error if full
      triggerToast(err.message || 'Room not found or room is full.');
      setLoading(false);
    }
  };

  const BOARD_SIZES = [5, 6, 7, 8, 9, 10];
  const PLAYER_LIMITS = [2, 3, 4, 5, 6, 8, 10];

  return (
    <div className="home-container">
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            <AlertCircle size={16} />
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {loading && (
        <div className="loading-overlay">
          <div className="spinner"></div>
          <p>ESTABLISHING GAME LINK...</p>
        </div>
      )}

      <div className="hero-section">
        <h2 className="hero-title">
          REAL-TIME MULTIPLAYER <br />
          <span className="glow-text">DYNAMIC BINGO</span>
        </h2>
        <p className="hero-subtitle">
          Configure dynamic board dimensions, set player limits, share the room code, and compete in real-time.
        </p>
      </div>

      <div className="home-grid">
        {/* Name/Profile Panel */}
        <div className="glass-panel profile-card">
          <div className="card-header">
            <User className="icon-accent" />
            <h3>Your Profile</h3>
          </div>
          <div className="input-group">
            <label className="input-label">Display Name</label>
            <input
              type="text"
              className="input-field"
              placeholder="Enter your gaming name..."
              value={nameInput}
              onChange={handleNameChange}
            />
          </div>
          <p className="profile-tip">
            This name will be visible to all players in the game room and live leaderboard.
          </p>
        </div>

        {/* Action Panel */}
        <div className="action-cards-container">
          {/* Create Card */}
          <div className="glass-panel action-card create-card">
            <div className="card-content">
              <h3>Host a New Game</h3>
              <p>Customize your game rules before creating the lobby.</p>

              {/* Host Settings Selectors */}
              <div className="host-options-block">
                {/* Board Size Selector */}
                <div className="option-group">
                  <label className="option-label">
                    <Grid size={14} className="icon-accent" />
                    <span>Board Size: {selectedBoardSize} × {selectedBoardSize}</span>
                  </label>
                  <div className="pill-selector">
                    {BOARD_SIZES.map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        className={`pill-btn ${selectedBoardSize === sz ? 'pill-active' : ''}`}
                        onClick={() => setSelectedBoardSize(sz)}
                      >
                        {sz}×{sz}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Max Players Selector */}
                <div className="option-group">
                  <label className="option-label">
                    <Users size={14} className="icon-secondary" />
                    <span>Max Players: {selectedMaxPlayers} Players</span>
                  </label>
                  <div className="pill-selector">
                    {PLAYER_LIMITS.map((num) => (
                      <button
                        key={num}
                        type="button"
                        className={`pill-btn ${selectedMaxPlayers === num ? 'pill-active' : ''}`}
                        onClick={() => setSelectedMaxPlayers(num)}
                      >
                        {num}P
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button 
                className="btn btn-primary btn-full mt-16"
                onClick={handleCreateGame}
                disabled={loading}
              >
                <PlusCircle size={20} />
                Create Game Room ({selectedBoardSize}×{selectedBoardSize}, {selectedMaxPlayers}P)
              </button>
            </div>
          </div>

          {/* Join Card */}
          <div className="glass-panel action-card join-card">
            <form onSubmit={handleJoinGame} className="card-content">
              <h3>Join Existing Game</h3>
              <p>Enter the 6-character room code from your host to enter the lobby.</p>
              <div className="join-form-row">
                <input
                  type="text"
                  className="input-field code-input"
                  placeholder="CODE"
                  maxLength={6}
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                />
                <button 
                  type="submit" 
                  className="btn btn-accent join-btn"
                  disabled={loading}
                >
                  <ArrowRight size={20} />
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <style>{`
        .home-container {
          max-width: 960px;
          margin: 30px auto;
          padding: 0 20px;
          display: flex;
          flex-direction: column;
          gap: 32px;
        }

        .hero-section {
          text-align: center;
        }

        .hero-title {
          font-size: 2.8rem;
          line-height: 1.15;
          font-weight: 900;
          letter-spacing: -0.03em;
          margin-bottom: 12px;
        }

        .glow-text {
          background: linear-gradient(135deg, hsl(var(--secondary)) 0%, hsl(var(--primary)) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          filter: drop-shadow(0 0 15px hsla(var(--primary), 0.4));
        }

        .hero-subtitle {
          font-size: 1.05rem;
          color: hsl(var(--text-secondary));
          max-width: 640px;
          margin: 0 auto;
        }

        .home-grid {
          display: grid;
          grid-template-columns: 1fr 1.1fr;
          gap: 24px;
          align-items: start;
        }

        .profile-card {
          padding: 28px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .card-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 20px;
        }

        .card-header h3 {
          font-size: 1.3rem;
          font-weight: 700;
        }

        .icon-accent {
          color: hsl(var(--secondary));
          filter: drop-shadow(0 0 8px hsla(var(--secondary), 0.5));
        }

        .profile-tip {
          font-size: 0.8rem;
          color: hsl(var(--text-muted));
          margin-top: 8px;
        }

        .action-cards-container {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .action-card {
          padding: 24px;
        }

        .action-card h3 {
          font-size: 1.25rem;
          font-weight: 700;
          margin-bottom: 6px;
        }

        .action-card p {
          font-size: 0.85rem;
          color: hsl(var(--text-secondary));
          margin-bottom: 14px;
          line-height: 1.4;
        }

        .host-options-block {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-bottom: 16px;
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          padding: 12px;
        }

        .option-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .option-label {
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.06em;
          color: hsl(var(--text-secondary));
          display: flex;
          align-items: center;
          gap: 6px;
          text-transform: uppercase;
        }

        .pill-selector {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }

        .pill-btn {
          flex: 1;
          min-width: 44px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          color: hsl(var(--text-muted));
          font-family: var(--font-heading);
          font-size: 0.78rem;
          font-weight: 700;
          padding: 6px 8px;
          cursor: pointer;
          transition: var(--transition-smooth);
        }

        .pill-btn:hover {
          background: rgba(255, 255, 255, 0.08);
          color: white;
        }

        .pill-active {
          background: linear-gradient(135deg, hsl(var(--secondary)) 0%, hsl(var(--primary)) 100%) !important;
          border-color: transparent !important;
          color: #05050e !important;
          box-shadow: 0 0 10px hsla(var(--secondary), 0.4);
        }

        .mt-16 {
          margin-top: 16px;
        }

        .btn-full {
          width: 100%;
        }

        .join-form-row {
          display: flex;
          gap: 12px;
        }

        .code-input {
          flex: 1;
          font-family: var(--font-heading);
          font-weight: 800;
          font-size: 1.3rem;
          letter-spacing: 0.15em;
          text-align: center;
          text-transform: uppercase;
          padding: 10px;
        }

        .join-btn {
          padding: 12px 18px;
          border-radius: 12px;
        }

        .loading-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(4, 3, 8, 0.85);
          backdrop-filter: blur(10px);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 20px;
          z-index: 1000;
          font-family: var(--font-heading);
          color: hsl(var(--text-secondary));
          letter-spacing: 0.05em;
        }

        @media (max-width: 768px) {
          .home-grid {
            grid-template-columns: 1fr;
          }
          .hero-title {
            font-size: 2.1rem;
          }
        }
      `}</style>
    </div>
  );
}
