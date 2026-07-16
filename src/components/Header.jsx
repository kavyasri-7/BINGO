import React, { useState } from 'react';
import { Settings, Info, CloudLightning, Database, X, HelpCircle } from 'lucide-react';
import { isRealFirebase, getFirebaseConfig } from '../firebase/config';

export default function Header() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [configText, setConfigText] = useState(() => {
    const config = getFirebaseConfig();
    return config ? JSON.stringify(config, null, 2) : '';
  });
  const [error, setError] = useState(null);

  const handleSaveConfig = (e) => {
    e.preventDefault();
    setError(null);
    try {
      if (!configText.trim()) {
        localStorage.removeItem('firebase_config');
        window.location.reload();
        return;
      }
      
      const parsed = JSON.parse(configText);
      if (!parsed.apiKey || !parsed.projectId) {
        throw new Error('Config must contain at least "apiKey" and "projectId".');
      }
      
      localStorage.setItem('firebase_config', JSON.stringify(parsed));
      setIsSettingsOpen(false);
      window.location.reload();
    } catch (err) {
      setError(err.message || 'Invalid JSON format. Please verify your configuration object.');
    }
  };

  const handleReset = () => {
    localStorage.removeItem('firebase_config');
    setIsSettingsOpen(false);
    window.location.reload();
  };

  return (
    <>
      <header className="header-bar glass-panel">
        <div className="logo-group">
          <span className="logo-glow">⚡</span>
          <h1>BINGO <span className="gradient-text">NEXUS</span></h1>
        </div>

        <div className="status-group">
          {isRealFirebase ? (
            <div className="status-badge status-live">
              <CloudLightning size={14} />
              <span>Firebase Cloud</span>
            </div>
          ) : (
            <div className="status-badge status-demo">
              <Database size={14} />
              <span>Demo Mode</span>
            </div>
          )}
          
          <button 
            className="header-btn" 
            onClick={() => setIsSettingsOpen(true)}
            aria-label="Settings"
          >
            <Settings size={18} />
          </button>
        </div>
      </header>

      {isSettingsOpen && (
        <div className="modal-overlay" onClick={() => setIsSettingsOpen(false)}>
          <div className="modal-content glass-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Database Settings</h3>
              <button className="close-btn" onClick={() => setIsSettingsOpen(false)}>
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSaveConfig} className="modal-body">
              <p className="settings-desc">
                By default, the game runs in <strong>Demo Mode</strong>, utilizing standard browser events to sync across tabs in real-time. To play over the internet, configure your own Firebase credentials below.
              </p>

              <div className="input-group">
                <label className="input-label">Firebase Config JSON Object</label>
                <textarea
                  className="input-field textarea-field"
                  placeholder={`{\n  "apiKey": "...",\n  "authDomain": "...",\n  "projectId": "...",\n  "storageBucket": "...",\n  "messagingSenderId": "...",\n  "appId": "..."\n}`}
                  value={configText}
                  onChange={(e) => setConfigText(e.target.value)}
                  rows={8}
                />
              </div>

              {error && <div className="settings-error">{error}</div>}

              <div className="settings-guide">
                <h4>How to obtain:</h4>
                <ol>
                  <li>Create a Firebase Project in the Console.</li>
                  <li>Enable Anonymous Authentication & Firestore database.</li>
                  <li>Register a web app to retrieve your configuration object.</li>
                </ol>
              </div>

              <div className="settings-actions">
                <button type="button" className="btn btn-secondary" onClick={handleReset}>
                  Reset to Demo Mode
                </button>
                <button type="submit" className="btn btn-primary">
                  Save & Connect
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Styled styles for Header since they are specific */}
      <style>{`
        .header-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 28px;
          margin: 20px auto;
          max-width: 1200px;
          width: 90%;
          border-radius: 18px;
        }

        .logo-group {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .logo-glow {
          font-size: 1.4rem;
          filter: drop-shadow(0 0 8px hsl(var(--secondary)));
          animation: float 2s ease-in-out infinite;
        }

        .header-bar h1 {
          font-size: 1.25rem;
          font-weight: 800;
          letter-spacing: 0.05em;
          margin: 0;
        }

        .gradient-text {
          background: linear-gradient(135deg, hsl(var(--secondary)) 0%, hsl(var(--primary)) 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .status-group {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .status-badge {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .status-live {
          background: rgba(99, 102, 241, 0.15);
          color: #a5b4fc;
          border-color: rgba(99, 102, 241, 0.3);
          box-shadow: 0 0 10px rgba(99, 102, 241, 0.2);
        }

        .status-badge svg {
          animation: spin 3s linear infinite;
        }

        .status-demo {
          background: rgba(6, 182, 212, 0.12);
          color: #67e8f9;
          border-color: rgba(6, 182, 212, 0.2);
        }

        .header-btn {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: white;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: var(--transition-smooth);
        }

        .header-btn:hover {
          background: rgba(255, 255, 255, 0.12);
          border-color: var(--card-border-hover);
          transform: rotate(30deg);
        }

        /* Settings Modal styling */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(4, 3, 8, 0.7);
          backdrop-filter: blur(8px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          animation: overlayFadeIn 0.3s forwards;
        }

        .modal-content {
          width: 90%;
          max-width: 550px;
          padding: 28px;
          animation: modalZoomIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 1px solid var(--card-border);
          padding-bottom: 16px;
          margin-bottom: 18px;
        }

        .modal-header h3 {
          font-size: 1.4rem;
          color: white;
        }

        .close-btn {
          background: transparent;
          border: none;
          color: hsl(var(--text-secondary));
          cursor: pointer;
          transition: var(--transition-fast);
        }

        .close-btn:hover {
          color: white;
        }

        .settings-desc {
          font-size: 0.9rem;
          color: hsl(var(--text-secondary));
          margin-bottom: 20px;
          line-height: 1.5;
        }

        .textarea-field {
          font-family: monospace;
          font-size: 0.85rem;
          resize: vertical;
          line-height: 1.4;
        }

        .settings-error {
          color: #f87171;
          font-size: 0.8rem;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
          padding: 10px 14px;
          border-radius: 8px;
          margin-bottom: 15px;
        }

        .settings-guide {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 12px;
          padding: 14px 18px;
          margin-bottom: 22px;
        }

        .settings-guide h4 {
          font-size: 0.85rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: hsl(var(--secondary));
          margin-bottom: 8px;
        }

        .settings-guide ol {
          font-size: 0.8rem;
          color: hsl(var(--text-secondary));
          padding-left: 16px;
          line-height: 1.6;
        }

        .settings-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
        }

        @media (max-width: 500px) {
          .settings-actions {
            flex-direction: column-reverse;
          }
          .settings-actions button {
            width: 100%;
          }
        }
      `}</style>
    </>
  );
}
