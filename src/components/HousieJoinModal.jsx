import React, { useState } from 'react';
import { X, LogIn, Hash, User } from 'lucide-react';

export default function HousieJoinModal({ isOpen, onClose, onJoin, user, initialCode = '' }) {
  const [roomCode, setRoomCode] = useState(initialCode);
  const [nickname, setNickname] = useState(user?.name || '');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanCode = roomCode.trim().toUpperCase();
    if (!cleanCode) return;
    onJoin(cleanCode, nickname.trim() || 'Player');
  };

  return (
    <div className="modal-overlay flex-center">
      <div className="modal-content glass-card">
        <div className="modal-header">
          <h3>Join Housie Room</h3>
          <button className="btn-icon" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label>
              <Hash size={14} /> 6-Digit Room Code
            </label>
            <input
              type="text"
              maxLength={6}
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="e.g. 458921"
              style={{ letterSpacing: '0.25em', textTransform: 'uppercase', fontSize: '1.2rem', textAlign: 'center', fontWeight: 'bold' }}
              required
            />
          </div>

          <div className="form-group">
            <label>
              <User size={14} /> Your Nickname
            </label>
            <input
              type="text"
              maxLength={15}
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Enter your nickname"
              required
            />
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary glow-btn">
              <LogIn size={16} /> Enter Waiting Lobby
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
