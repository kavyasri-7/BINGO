/**
 * Generates a randomized board with numbers 1 to 25.
 * @returns {number[]} A 1D array of 25 unique numbers shuffled from 1 to 25.
 */
export function generateBoard() {
  const numbers = Array.from({ length: 25 }, (_, i) => i + 1);
  // Shuffle array using Fisher-Yates algorithm
  for (let i = numbers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
  }
  return numbers;
}

// 5x5 Grid indices for rows, columns, and diagonals
const WINNING_LINES = [
  // Rows
  { name: 'Row 1', indices: [0, 1, 2, 3, 4] },
  { name: 'Row 2', indices: [5, 6, 7, 8, 9] },
  { name: 'Row 3', indices: [10, 11, 12, 13, 14] },
  { name: 'Row 4', indices: [15, 16, 17, 18, 19] },
  { name: 'Row 5', indices: [20, 21, 22, 23, 24] },
  // Columns
  { name: 'Col 1', indices: [0, 5, 10, 15, 20] },
  { name: 'Col 2', indices: [1, 6, 11, 16, 21] },
  { name: 'Col 3', indices: [2, 7, 12, 17, 22] },
  { name: 'Col 4', indices: [3, 8, 13, 18, 23] },
  { name: 'Col 5', indices: [4, 9, 14, 19, 24] },
  // Diagonals
  { name: 'Diag 1', indices: [0, 6, 12, 18, 24] },
  { name: 'Diag 2', indices: [4, 8, 12, 16, 20] },
];

/**
 * Checks the board against crossed numbers and returns completed line statistics.
 * @param {number[]} board - 25 numbers representing the player's board.
 * @param {number[]} crossedNumbers - Array of numbers that have been selected/crossed.
 * @returns {Object} An object containing the count of completed lines, indices of completed cells, and matching line names.
 */
export function checkBingo(board, crossedNumbers) {
  if (!board || !crossedNumbers) {
    return { count: 0, completedIndices: new Set(), completedLines: [] };
  }

  const crossedSet = new Set(crossedNumbers);
  const completedIndices = new Set();
  const completedLines = [];

  for (const line of WINNING_LINES) {
    const isComplete = line.indices.every(idx => crossedSet.has(board[idx]));
    if (isComplete) {
      completedLines.push(line.name);
      line.indices.forEach(idx => completedIndices.add(idx));
    }
  }

  return {
    count: completedLines.length,
    completedIndices,
    completedLines,
  };
}

/**
 * Converts the completed line count into BINGO letters progress.
 * @param {number} lineCount - Number of completed lines (0 to 5+).
 * @returns {string} The formatted progress string, e.g. "B", "BI", "BIN", "BING", "BINGO".
 */
export function getBingoLetters(lineCount) {
  const letters = 'BINGO';
  const count = Math.min(lineCount, letters.length);
  return letters.substring(0, count);
}
