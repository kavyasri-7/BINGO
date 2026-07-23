/**
 * Generates a randomized board with numbers 1 to (size * size).
 * @param {number} size - Board dimension (e.g. 5 for 5x5, 10 for 10x10). Defaults to 5.
 * @returns {number[]} A 1D array of (size * size) unique numbers shuffled from 1 to size^2.
 */
export function generateBoard(size = 5) {
  const totalNumbers = size * size;
  const numbers = Array.from({ length: totalNumbers }, (_, i) => i + 1);
  
  // Shuffle array using Fisher-Yates algorithm
  for (let i = numbers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
  }
  return numbers;
}

/**
 * Dynamically computes winning line indices (Rows, Columns, Diagonals) for an N x N board.
 * @param {number} size - Board dimension N.
 * @returns {Array<{ name: string, indices: number[] }>} List of winning line objects.
 */
export function getWinningLines(size = 5) {
  const lines = [];

  // 1. Horizontal Rows (N lines)
  for (let r = 0; r < size; r++) {
    const indices = [];
    for (let c = 0; c < size; c++) {
      indices.push(r * size + c);
    }
    lines.push({ name: `Row ${r + 1}`, indices });
  }

  // 2. Vertical Columns (N lines)
  for (let c = 0; c < size; c++) {
    const indices = [];
    for (let r = 0; r < size; r++) {
      indices.push(r * size + c);
    }
    lines.push({ name: `Col ${c + 1}`, indices });
  }

  // 3. Main Diagonal (Top-Left to Bottom-Right)
  const diag1Indices = [];
  for (let i = 0; i < size; i++) {
    diag1Indices.push(i * size + i);
  }
  lines.push({ name: 'Diag 1', indices: diag1Indices });

  // 4. Anti-Diagonal (Top-Right to Bottom-Left)
  const diag2Indices = [];
  for (let i = 0; i < size; i++) {
    diag2Indices.push(i * size + (size - 1 - i));
  }
  lines.push({ name: 'Diag 2', indices: diag2Indices });

  return lines;
}

/**
 * Checks the board against crossed numbers and returns completed line statistics.
 * @param {number[]} board - 1D array representing the player's board.
 * @param {number[]} crossedNumbers - Array of numbers that have been selected/crossed.
 * @param {number} size - Board dimension N (defaults to 5 or calculated from board length).
 * @returns {Object} An object containing the count of completed lines, indices of completed cells, completedLines names, targetLines, and isBingo.
 */
export function checkBingo(board, crossedNumbers = [], size = 5) {
  if (!board || board.length === 0) {
    return { count: 0, completedIndices: new Set(), completedLines: [], targetLines: size, isBingo: false };
  }

  // Calculate actual grid dimension from board array length if size not given or mismatched
  const computedSize = Math.round(Math.sqrt(board.length)) || size;
  const winningLines = getWinningLines(computedSize);

  const crossedSet = new Set(crossedNumbers);
  const completedIndices = new Set();
  const completedLines = [];

  for (const line of winningLines) {
    const isComplete = line.indices.every(idx => crossedSet.has(board[idx]));
    if (isComplete) {
      completedLines.push(line.name);
      line.indices.forEach(idx => completedIndices.add(idx));
    }
  }

  const count = completedLines.length;
  const targetLines = computedSize;

  return {
    count,
    targetLines,
    isBingo: count >= targetLines,
    completedIndices,
    completedLines,
  };
}

/**
 * Converts completed line count into progress metrics.
 * @param {number} lineCount - Number of completed lines.
 * @param {number} size - Board dimension (target lines required).
 * @returns {Object} Progress stats.
 */
export function getBingoProgress(lineCount = 0, size = 5) {
  const target = size;
  const count = Math.max(0, lineCount);
  const percentage = Math.min(100, Math.round((count / target) * 100));
  return {
    count,
    target,
    percentage,
    text: `${count} / ${target}`,
  };
}

/**
 * Backward compatible letters string helper (for 5x5 board).
 * @param {number} lineCount
 * @returns {string}
 */
export function getBingoLetters(lineCount) {
  const letters = 'BINGO';
  const count = Math.min(lineCount, letters.length);
  return letters.substring(0, count);
}
