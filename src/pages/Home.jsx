import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PlusCircle,
  LogIn,
  Grid,
  Trophy,
  HelpCircle,
  Sparkles,
  Play,
  AlertCircle
} from 'lucide-react';
import { gameDb } from '../services/db';
import { housieDb } from '../services/housieDb';
import HousieCreateModal from '../components/HousieCreateModal';
import HousieJoinModal from '../components/HousieJoinModal';

export default function Home({ user, updateUsername }) {
  const navigate = useNavigate();

  // Mode Selection: 'housie' or 'bingo'
  const [activeGameMode, setActiveGameMode] = useState('housie');

  // Input States
  const [nameInput, setNameInput] = useState(user?.name || '');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  // Modals for Housie
  const [isHousieCreateOpen, setIsHousieCreateOpen] = useState(false);
  const [isHousieJoinOpen, setIsHousieJoinOpen] = useState(false);

  // Grid Bingo Settings
  const [selectedBoardSize, setSelectedBoardSize] = useState(5);
  const [selectedMaxPlayers] = useState(2);

  const triggerToast = (message, type = 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleNameChange = (e) => {
    const val = e.target.value.substring(0, 15);
    setNameInput(val);
    updateUsername(val);
  };

  // Housie Handlers
  const handleCreateHousie = async (config) => {
    setIsHousieCreateOpen(false);
    setLoading(true);
    try {
      const displayName = nameInput.trim() || user?.name || 'Host';
      const code = await housieDb.createRoom(config, { uid: user.uid, name: displayName });
      triggerToast('Housie Room Created! Opening Lobby...', 'success');
      navigate(`/housie/${code}`);
    } catch (err) {
      triggerToast(err.message || 'Failed to create Housie room.');
      setLoading(false);
    }
  };

  const handleJoinHousie = async (code, nickname) => {
    setIsHousieJoinOpen(false);
    setLoading(true);
    try {
      await housieDb.joinRoom(code, nickname, user.uid);
      triggerToast('Joined Housie Room!', 'success');
      navigate(`/housie/${code}`);
    } catch (err) {
      triggerToast(err.message || 'Room not found or locked.');
      setLoading(false);
    }
  };

  // Classic Grid Bingo Handlers
  const handleCreateBingo = async () => {
    const displayName = nameInput.trim() || user?.name || 'Player';
    setLoading(true);
    try {
      const code = await gameDb.createRoom(displayName, user.uid, {
        boardSize: selectedBoardSize,
        maxPlayers: selectedMaxPlayers
      });
      triggerToast('Bingo Room Created!', 'success');
      navigate(`/room/${code}`);
    } catch (err) {
      triggerToast(err.message || 'Failed to create room.');
      setLoading(false);
    }
  };

  const handleJoinBingo = async (e) => {
    e.preventDefault();
    const code = roomCodeInput.trim().toUpperCase();
    const displayName = nameInput.trim() || user?.name || 'Player';
    if (!code) {
      triggerToast('Please enter room code.');
      return;
    }
    setLoading(true);
    try {
      await gameDb.joinRoom(code, displayName, user.uid);
      navigate(`/room/${code}`);
    } catch (err) {
      triggerToast(err.message || 'Room not found or full.');
      setLoading(false);
    }
  };

  return (
    <div className="home-container">
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            <AlertCircle size={18} />
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {loading && (
        <div className="loading-overlay flex-center">
          <div className="spinner"></div>
          <p>INITIALIZING SECURE SESSION...</p>
        </div>
      )}

      {/* Hero Header */}
      <section className="hero-section text-center">
        <div className="badge hero-badge">
          <Sparkles size={16} /> REAL-TIME MULTIPLAYER GAMING HUB
        </div>
        <h1 className="hero-title">
          HOUSIE TAMBOLA <span className="glow-text">& BINGO PARTY</span>
        </h1>
        <p className="hero-subtitle">
          Experience 3x9 Tambola ticket generator, 3-second live number caller, automated server-side validation, live winner announcements, and zero-latency STOMP WebSockets.
        </p>
      </section>

      {/* User Nickname Input */}
      <div className="nickname-box glass-card margin-auto">
        <label>YOUR GAMER NICKNAME</label>
        <input
          type="text"
          value={nameInput}
          onChange={handleNameChange}
          placeholder="Enter Nickname"
          maxLength={15}
        />
      </div>

      {/* Game Mode Selector Tabs */}
      <div className="game-tabs flex-center margin-auto">
        <button
          className={`tab-btn ${activeGameMode === 'housie' ? 'active' : ''}`}
          onClick={() => setActiveGameMode('housie')}
        >
          <Trophy size={18} /> Real-Time Multiplayer Housie (Tambola)
        </button>
        <button
          className={`tab-btn ${activeGameMode === 'bingo' ? 'active' : ''}`}
          onClick={() => setActiveGameMode('bingo')}
        >
          <Grid size={18} /> Classic Dynamic Grid Bingo
        </button>
      </div>

      {/* GAME MODE 1: HOUSIE / TAMBOLA */}
      {activeGameMode === 'housie' && (
        <div className="housie-action-cards">
          <div className="action-card glass-card">
            <div className="card-icon glow-purple">
              <PlusCircle size={32} />
            </div>
            <h3>Host a Housie Room</h3>
            <p>Create a room with custom interval, unlimited players, and winning categories.</p>
            <button
              className="btn btn-primary glow-btn full-width"
              onClick={() => setIsHousieCreateOpen(true)}
            >
              <Play size={18} /> Create Housie Room
            </button>
          </div>

          <div className="action-card glass-card">
            <div className="card-icon glow-cyan">
              <LogIn size={32} />
            </div>
            <h3>Join a Housie Room</h3>
            <p>Have a 6-digit room code? Enter nickname & room code to get your 3x9 Tambola ticket.</p>
            <button
              className="btn btn-secondary full-width"
              onClick={() => setIsHousieJoinOpen(true)}
            >
              <LogIn size={18} /> Enter Room Code
            </button>
          </div>
        </div>
      )}

      {/* GAME MODE 2: CLASSIC GRID BINGO */}
      {activeGameMode === 'bingo' && (
        <div className="bingo-action-cards">
          <div className="action-card glass-card">
            <h3>Create Classic Bingo</h3>
            <div className="form-group">
              <label>Board Size</label>
              <div className="options-grid">
                {[5, 6, 7].map((sz) => (
                  <button
                    key={sz}
                    className={`opt-btn ${selectedBoardSize === sz ? 'selected' : ''}`}
                    onClick={() => setSelectedBoardSize(sz)}
                  >
                    {sz}x{sz}
                  </button>
                ))}
              </div>
            </div>
            <button className="btn btn-primary full-width" onClick={handleCreateBingo}>
              Create {selectedBoardSize}x{selectedBoardSize} Bingo
            </button>
          </div>

          <div className="action-card glass-card">
            <h3>Join Classic Bingo</h3>
            <form onSubmit={handleJoinBingo}>
              <div className="form-group">
                <input
                  type="text"
                  placeholder="Enter 6-char Room Code"
                  value={roomCodeInput}
                  onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                  maxLength={6}
                  required
                />
              </div>
              <button type="submit" className="btn btn-secondary full-width">
                Join Room
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Rules & Information Section */}
      <section className="info-section glass-card">
        <h2>
          <HelpCircle size={22} color="hsl(var(--primary))" /> Housie (Tambola) Rules & Winning Categories
        </h2>

        <div className="rules-grid">
          <div className="rule-box">
            <h4>🏆 Early Five</h4>
            <p>First player to successfully mark any 5 numbers on their ticket.</p>
          </div>
          <div className="rule-box">
            <h4>🥇 Top Line</h4>
            <p>First player to complete all 5 numbers in the 1st row.</p>
          </div>
          <div className="rule-box">
            <h4>🥈 Middle Line</h4>
            <p>First player to complete all 5 numbers in the 2nd row.</p>
          </div>
          <div className="rule-box">
            <h4>🥉 Bottom Line</h4>
            <p>First player to complete all 5 numbers in the 3rd row.</p>
          </div>
          <div className="rule-box full-house-box">
            <h4>👑 Full House</h4>
            <p>First player to complete all 15 numbers on their 3x9 ticket!</p>
          </div>
        </div>
      </section>

      {/* Modals */}
      <HousieCreateModal
        isOpen={isHousieCreateOpen}
        onClose={() => setIsHousieCreateOpen(false)}
        onCreate={handleCreateHousie}
        user={user}
      />
      <HousieJoinModal
        isOpen={isHousieJoinOpen}
        onClose={() => setIsHousieJoinOpen(false)}
        onJoin={handleJoinHousie}
        user={user}
      />
    </div>
  );
}
