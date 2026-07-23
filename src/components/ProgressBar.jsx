import React from 'react';
import { getBingoProgress } from '../utils/bingoEngine';

export default function ProgressBar({ completedCount = 0, targetLines = 5, label = 'BINGO Progress' }) {
  const { percentage, text } = getBingoProgress(completedCount, targetLines);

  return (
    <div className="bingo-progress-wrapper">
      <div className="progress-header flex-between">
        <span className="progress-label">{label}</span>
        <span className="progress-count-badge">{text} Lines</span>
      </div>

      <div className="progress-track">
        <div 
          className="progress-fill" 
          style={{ width: `${percentage}%` }}
        >
          <div className="progress-glow-tip"></div>
        </div>
      </div>

      <style>{`
        .bingo-progress-wrapper {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .progress-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-family: var(--font-heading);
        }

        .progress-label {
          font-size: 0.72rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: hsl(var(--text-secondary));
        }

        .progress-count-badge {
          font-size: 0.8rem;
          font-weight: 800;
          color: hsl(var(--secondary));
          background: rgba(6, 182, 212, 0.12);
          border: 1px solid rgba(6, 182, 212, 0.25);
          padding: 2px 8px;
          border-radius: 12px;
          letter-spacing: 0.04em;
        }

        .progress-track {
          height: 10px;
          width: 100%;
          background: rgba(0, 0, 0, 0.4);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          overflow: hidden;
          position: relative;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, hsl(var(--primary)) 0%, hsl(var(--secondary)) 100%);
          border-radius: 20px;
          transition: width 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
          position: relative;
          box-shadow: 0 0 10px hsla(var(--secondary), 0.5);
        }

        .progress-glow-tip {
          position: absolute;
          right: 0;
          top: 0;
          bottom: 0;
          width: 6px;
          background: #ffffff;
          border-radius: 50%;
          box-shadow: 0 0 8px 2px #ffffff;
          opacity: 0.8;
        }
      `}</style>
    </div>
  );
}
