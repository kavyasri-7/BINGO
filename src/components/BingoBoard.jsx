import React from 'react';

export default function BingoBoard({
  board = [],
  boardSize = 5,
  crossedNumbers = [],
  highlightIndices = new Set(),
  isMyTurn = false,
  gameStatus = 'playing',
  onSelectCell,
}) {
  const crossedSet = new Set(crossedNumbers);

  // Dynamic font scaling helper based on board dimension
  const getCellFontSize = (size) => {
    switch (size) {
      case 5: return 'clamp(1rem, 2.5vw, 1.35rem)';
      case 6: return 'clamp(0.9rem, 2.2vw, 1.2rem)';
      case 7: return 'clamp(0.8rem, 1.9vw, 1.05rem)';
      case 8: return 'clamp(0.75rem, 1.7vw, 0.95rem)';
      case 9: return 'clamp(0.7rem, 1.5vw, 0.85rem)';
      case 10: return 'clamp(0.65rem, 1.3vw, 0.78rem)';
      default: return '1rem';
    }
  };

  const getGridGap = (size) => {
    if (size >= 9) return '4px';
    if (size >= 7) return '6px';
    return '8px';
  };

  return (
    <div className="glass-panel board-card-container">
      <div 
        className="dynamic-bingo-grid"
        style={{
          '--board-size': boardSize,
          '--grid-gap': getGridGap(boardSize),
          '--cell-font-size': getCellFontSize(boardSize),
        }}
      >
        {board.map((number, index) => {
          const isCrossed = crossedSet.has(number);
          const isWinning = highlightIndices.has(index);
          const isDisabled = !isMyTurn || isCrossed || gameStatus !== 'playing';

          return (
            <button
              key={`${number}-${index}`}
              onClick={() => onSelectCell(number)}
              disabled={isDisabled}
              className={`grid-cell 
                ${isCrossed ? 'cell-crossed' : ''} 
                ${isWinning ? 'cell-winning' : ''}
                ${!isMyTurn && !isCrossed ? 'cell-disabled' : ''}
              `}
              title={`Number ${number}`}
            >
              <span className="cell-number">{number}</span>
              {isCrossed && <div className="strike-marker"></div>}
            </button>
          );
        })}
      </div>

      <style>{`
        .board-card-container {
          padding: 12px;
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 0;
          overflow: hidden;
          width: 100%;
        }

        .dynamic-bingo-grid {
          display: grid;
          grid-template-columns: repeat(var(--board-size), 1fr);
          grid-template-rows: repeat(var(--board-size), 1fr);
          gap: var(--grid-gap);
          width: 100%;
          height: 100%;
          max-width: min(56vh, 480px);
          max-height: min(56vh, 480px);
          aspect-ratio: 1;
          box-sizing: border-box;
        }

        .grid-cell {
          background: rgba(255, 255, 255, 0.02);
          border: 1.5px solid rgba(255, 255, 255, 0.05);
          border-radius: max(4px, min(10px, calc(40px / var(--board-size))));
          color: white;
          font-family: var(--font-heading);
          font-size: var(--cell-font-size);
          font-weight: 800;
          cursor: pointer;
          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: var(--transition-smooth);
          overflow: hidden;
          user-select: none;
          outline: none;
          padding: 0;
        }

        .grid-cell:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.09);
          border-color: hsl(var(--secondary));
          transform: translateY(-1px) scale(1.03);
          box-shadow: 0 4px 12px hsla(var(--secondary), 0.3);
          z-index: 2;
        }

        .grid-cell:active:not(:disabled) {
          transform: scale(0.95);
        }

        .cell-disabled {
          cursor: not-allowed;
          opacity: 0.65;
        }

        .cell-crossed {
          background: rgba(20, 15, 38, 0.65) !important;
          border-color: rgba(255, 255, 255, 0.03) !important;
          color: hsl(var(--text-muted)) !important;
          cursor: not-allowed;
          transform: none !important;
          box-shadow: none !important;
          animation: stampPop 0.4s ease-out;
        }

        .strike-marker {
          position: absolute;
          width: 80%;
          height: 2px;
          background: linear-gradient(90deg, transparent, hsl(var(--primary)), transparent);
          border-radius: 2px;
          transform: rotate(-30deg);
          box-shadow: 0 0 8px hsla(var(--primary), 0.85);
        }

        .cell-winning {
          animation: winningLinePulsate 2s infinite ease-in-out !important;
          border-color: transparent !important;
          color: #05050e !important;
          z-index: 3;
        }

        .cell-winning .strike-marker {
          background: #05050e;
          box-shadow: none;
        }

        @keyframes stampPop {
          0% { transform: scale(1.15); opacity: 0.7; }
          100% { transform: scale(1); opacity: 1; }
        }

        @keyframes winningLinePulsate {
          0%, 100% {
            background: linear-gradient(135deg, hsl(var(--secondary)) 0%, hsl(var(--gold)) 100%);
            box-shadow: 0 0 15px hsla(var(--secondary), 0.8);
          }
          50% {
            background: linear-gradient(135deg, hsl(var(--gold)) 0%, hsl(var(--accent)) 100%);
            box-shadow: 0 0 25px hsla(var(--gold), 0.9);
          }
        }
      `}</style>
    </div>
  );
}
