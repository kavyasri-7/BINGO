import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Play, PlusCircle, ArrowRight, User, AlertCircle, Copy } from 'lucide-react';
import { gameDb } from '../services/db';

export default function Home({ user, updateUsername }) {
  const navigate = useNavigate();
  const [nameInput, setNameInput] = useState(user?.name || '');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const triggerToast = (message, type = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleNameChange = (e) => {
    const val = e.target.value.substring(0, 15); // Limit name to 15 chars
    setNameInput(val);
    updateUsername(val);
  };

  const handleCreateGame = async () => {
    const displayName = nameInput.trim() || user?.name || 'Player';
    setLoading(true);
    try {
      const code = await gameDb.createRoom(displayName, user.uid);
      triggerToast('Room created! Redirecting...', 'success');
      setTimeout(() => {
        navigate(`/room/${code}`);
      }, 8000);
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

    setLoading(false);
    setLoading(true);

    try {
      await gameDb.joinRoom(code, displayName, user.uid);
      triggerToast('Joined room! Loading board...', 'success');
      navigate(`/room/${code}`);
    } catch (err) {
      console.error(err);
      triggerToast(err.message || 'Room not found or room is full.');
      setLoading(false);
    }
  };

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
          MULTIPLAYER BINGO <br />
          <span className="glow-text">IN REAL TIME</span>
        </h2>
        <p className="hero-subtitle">
          Create a private battlefield, share the invite key, and challenge your friends in real-time.
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
            This name will be visible to your opponent on the scoreboard.
          </p>
        </div>

        {/* Action Panel */}
        <div className="action-cards-container">
          {/* Create Card */}
          <div className="glass-panel action-card create-card">
            <div className="card-content">
              <h3>Host a Game</h3>
              <p>Spin up a new lobby and get a 6-digit room code to invite your opponent.</p>
              <button 
                className="btn btn-primary btn-full"
                onClick={handleCreateGame}
                disabled={loading}
              >
                <PlusCircle size={20} />
                Create Game Room
              </button>
            </div>
          </div>

          {/* Join Card */}
          <div className="glass-panel action-card join-card">
            <form onSubmit={handleJoinGame} className="card-content">
              <h3>Join a Game</h3>
              <p>Enter the 6-character room code from your friend to jump directly into battle.</p>
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
          max-width: 900px;
          margin: 40px auto;
          padding: 0 20px;
          display: flex;
          flex-direction: column;
          gap: 40px;
        }

        .hero-section {
          text-align: center;
        }

        .hero-title {
          font-size: 2.8rem;
          line-height: 1.15;
          font-weight: 800;
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
          font-size: 1.1rem;
          color: hsl(var(--text-secondary));
          max-width: 600px;
          margin: 0 auto;
        }

        .home-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 24px;
        }

        .profile-card {
          padding: 32px;
          display: flex;
          flex-direction: column;
          justify-content: center;
        }

        .card-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 24px;
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
          gap: 24px;
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
          font-size: 0.88rem;
          color: hsl(var(--text-secondary));
          margin-bottom: 16px;
          line-height: 1.4;
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

        /* Loading Screen overlay */
        .loading-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(4, 3, 8, 0.8);
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
            font-size: 2.2rem;
          }
          .profile-card {
            padding: 24px;
          }
        }
      `}</style>
    </div>
  );
}
