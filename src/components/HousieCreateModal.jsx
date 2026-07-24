import React, { useState } from 'react';
import { X, Play, Users, Clock, ShieldCheck } from 'lucide-react';

export default function HousieCreateModal({ isOpen, onClose, onCreate, user }) {
  const [gameName, setGameName] = useState(`${user?.name || 'Player'}'s Tambola Party`);
  const [hostName, setHostName] = useState(user?.name || 'Host');
  const [maxPlayers, setMaxPlayers] = useState(''); // empty = unlimited
  const [callingInterval, setCallingInterval] = useState(3); // 3s default
  const [autoCalling] = useState(true);
  const [categories, setCategories] = useState([
    'Early Five',
    'Top Line',
    'Middle Line',
    'Bottom Line',
    'Full House'
  ]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    onCreate({
      gameName: gameName.trim() || 'Housie Party',
      hostName: hostName.trim() || 'Host',
      maxPlayers: maxPlayers ? parseInt(maxPlayers, 10) : null,
      callingInterval: parseInt(callingInterval, 10) * 1000,
      autoCalling,
      categories
    });
  };

  const toggleCategory = (cat) => {
    if (categories.includes(cat)) {
      if (categories.length > 1) {
        setCategories(categories.filter((c) => c !== cat));
      }
    } else {
      setCategories([...categories, cat]);
    }
  };

  const CATEGORY_LIST = [
    { id: 'Early Five', label: 'Early Five', desc: 'First 5 numbers marked anywhere' },
    { id: 'Top Line', label: 'Top Line', desc: 'All 5 numbers in Row 1' },
    { id: 'Middle Line', label: 'Middle Line', desc: 'All 5 numbers in Row 2' },
    { id: 'Bottom Line', label: 'Bottom Line', desc: 'All 5 numbers in Row 3' },
    { id: 'Full House', label: 'Full House', desc: 'All 15 numbers on ticket' },
  ];

  return (
    <div className="modal-overlay flex-center">
      <div className="modal-content glass-card">
        <div className="modal-header">
          <h3>Create Housie Room</h3>
          <button className="btn-icon" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label>Game Title</label>
            <input
              type="text"
              value={gameName}
              onChange={(e) => setGameName(e.target.value)}
              placeholder="e.g. Saturday Night Tambola"
              required
            />
          </div>

          <div className="form-group">
            <label>Host Nickname</label>
            <input
              type="text"
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              placeholder="Your name"
              required
            />
          </div>

          <div className="form-row">
            <div className="form-group flex-1">
              <label>
                <Users size={14} /> Player Limit
              </label>
              <select
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(e.target.value)}
              >
                <option value="">Unlimited Players</option>
                <option value="5">5 Players</option>
                <option value="10">10 Players</option>
                <option value="20">20 Players</option>
                <option value="50">50 Players</option>
              </select>
            </div>

            <div className="form-group flex-1">
              <label>
                <Clock size={14} /> Interval (Seconds)
              </label>
              <select
                value={callingInterval}
                onChange={(e) => setCallingInterval(e.target.value)}
              >
                <option value="2">2 Seconds</option>
                <option value="3">3 Seconds (Standard)</option>
                <option value="5">5 Seconds</option>
                <option value="7">7 Seconds</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Winning Categories Enabled</label>
            <div className="categories-grid">
              {CATEGORY_LIST.map((item) => (
                <div
                  key={item.id}
                  className={`category-chip ${categories.includes(item.id) ? 'selected' : ''}`}
                  onClick={() => toggleCategory(item.id)}
                >
                  <ShieldCheck size={16} />
                  <div>
                    <strong>{item.label}</strong>
                    <span>{item.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary glow-btn">
              <Play size={16} /> Create Room & Get Code
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
