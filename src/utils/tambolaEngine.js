/**
 * Tambola (Housie) Ticket Generator & Winner Validator Engine
 *
 * Rules:
 * - 3 rows x 9 columns
 * - Total 15 numbers (5 per row)
 * - Exactly 4 empty slots per row
 * - Column 0: 1-9
 * - Column 1: 10-19
 * - Column 2: 20-29
 * - Column 3: 30-39
 * - Column 4: 40-49
 * - Column 5: 50-59
 * - Column 6: 60-69
 * - Column 7: 70-79
 * - Column 8: 80-90
 * - Numbers in columns are sorted in ascending order from top to bottom
 * - Every column has at least 1 number and max 3 numbers
 */

// Helper to get column bounds
function getColumnRange(colIndex) {
  if (colIndex === 0) return { min: 1, max: 9 };
  if (colIndex === 8) return { min: 80, max: 90 };
  return { min: colIndex * 10, max: colIndex * 10 + 9 };
}

// Random integer inclusive
function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generates a valid 3x9 Tambola ticket matrix:
 * Array of 3 rows, each containing 9 elements (number or null)
 */
export function generateTambolaTicket() {
  let attempt = 0;
  while (attempt < 500) {
    attempt++;
    const grid = Array.from({ length: 3 }, () => Array(9).fill(null));

    // Step 1: Assign count of numbers to each column (must sum to 15, each between 1 and 3)
    const colCounts = Array(9).fill(1); // guarantee at least 1 in each column (9 total)
    let remaining = 6; // 15 - 9 = 6 to distribute
    while (remaining > 0) {
      const idx = getRandomInt(0, 8);
      if (colCounts[idx] < 3) {
        colCounts[idx]++;
        remaining--;
      }
    }

    // Step 2: Pick unique random numbers for each column based on colCounts
    const colNumbers = [];
    for (let c = 0; c < 9; c++) {
      const { min, max } = getColumnRange(c);
      const chosen = new Set();
      while (chosen.size < colCounts[c]) {
        chosen.add(getRandomInt(min, max));
      }
      const sorted = Array.from(chosen).sort((a, b) => a - b);
      colNumbers.push(sorted);
    }

    // Step 3: Distribute numbers into the 3 rows such that each row gets exactly 5 numbers
    const rowCounts = [0, 0, 0];
    let possible = true;

    // Handle columns with 3 numbers (must occupy all 3 rows)
    for (let c = 0; c < 9; c++) {
      if (colCounts[c] === 3) {
        grid[0][c] = colNumbers[c][0];
        grid[1][c] = colNumbers[c][1];
        grid[2][c] = colNumbers[c][2];
        rowCounts[0]++;
        rowCounts[1]++;
        rowCounts[2]++;
      }
    }

    // Handle columns with 1 or 2 numbers
    const otherCols = [];
    for (let c = 0; c < 9; c++) {
      if (colCounts[c] < 3) {
        otherCols.push(c);
      }
    }
    otherCols.sort(() => Math.random() - 0.5);

    for (const c of otherCols) {
      const nums = colNumbers[c];
      const count = nums.length;
      const availRows = [0, 1, 2].filter((r) => rowCounts[r] < 5);

      if (availRows.length < count) {
        possible = false;
        break;
      }

      if (count === 1) {
        availRows.sort((a, b) => rowCounts[a] - rowCounts[b] || (Math.random() - 0.5));
        const targetRow = availRows[0];
        grid[targetRow][c] = nums[0];
        rowCounts[targetRow]++;
      } else if (count === 2) {
        availRows.sort((a, b) => rowCounts[a] - rowCounts[b] || (Math.random() - 0.5));
        const selectedRows = availRows.slice(0, 2).sort((a, b) => a - b);
        grid[selectedRows[0]][c] = nums[0];
        grid[selectedRows[1]][c] = nums[1];
        rowCounts[selectedRows[0]]++;
        rowCounts[selectedRows[1]]++;
      }
    }

    if (possible && rowCounts[0] === 5 && rowCounts[1] === 5 && rowCounts[2] === 5) {
      return grid;
    }
  }

  return generateDeterministicTambolaTicket();
}

function generateDeterministicTambolaTicket() {
  const grid = Array.from({ length: 3 }, () => Array(9).fill(null));
  grid[0][0] = 4; grid[0][1] = 12; grid[0][3] = 31; grid[0][5] = 52; grid[0][7] = 73;
  grid[1][1] = 18; grid[1][2] = 22; grid[1][4] = 45; grid[1][6] = 64; grid[1][8] = 81;
  grid[2][0] = 8; grid[2][2] = 27; grid[2][3] = 39; grid[2][5] = 59; grid[2][8] = 88;
  return grid;
}

export function getTicketNumbers(ticketMatrix) {
  const numbers = [];
  if (!ticketMatrix) return numbers;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 9; c++) {
      if (ticketMatrix[r][c] !== null && ticketMatrix[r][c] !== undefined) {
        numbers.push(ticketMatrix[r][c]);
      }
    }
  }
  return numbers;
}

export function validateMarkNumber(ticketMatrix, calledNumbersSet, markedNumbersSet, numberToMark) {
  const allTicketNumbers = getTicketNumbers(ticketMatrix);

  if (!allTicketNumbers.includes(numberToMark)) {
    return { valid: false, reason: "Number is not on your ticket!" };
  }

  if (!calledNumbersSet.has(numberToMark)) {
    return { valid: false, reason: "This number has not been called yet!" };
  }

  if (markedNumbersSet.has(numberToMark)) {
    return { valid: false, reason: "Number is already marked!" };
  }

  return { valid: true };
}

export function evaluateWinningCategories(ticketMatrix, markedNumbersSet, existingWinners = {}) {
  const newWins = [];
  const totalMarkedOnTicket = getTicketNumbers(ticketMatrix).filter(n => markedNumbersSet.has(n));

  // Early Five: First player to get any 5 valid numbers marked
  if (!existingWinners['Early Five'] && totalMarkedOnTicket.length >= 5) {
    newWins.push('Early Five');
  }

  // Top Line: All 5 numbers in Row 0 marked
  if (!existingWinners['Top Line']) {
    const row0Nums = ticketMatrix[0].filter(n => n !== null);
    if (row0Nums.every(n => markedNumbersSet.has(n))) {
      newWins.push('Top Line');
    }
  }

  // Middle Line: All 5 numbers in Row 1 marked
  if (!existingWinners['Middle Line']) {
    const row1Nums = ticketMatrix[1].filter(n => n !== null);
    if (row1Nums.every(n => markedNumbersSet.has(n))) {
      newWins.push('Middle Line');
    }
  }

  // Bottom Line: All 5 numbers in Row 2 marked
  if (!existingWinners['Bottom Line']) {
    const row2Nums = ticketMatrix[2].filter(n => n !== null);
    if (row2Nums.every(n => markedNumbersSet.has(n))) {
      newWins.push('Bottom Line');
    }
  }

  // Full House: All 15 numbers on ticket marked
  if (!existingWinners['Full House']) {
    const allNums = getTicketNumbers(ticketMatrix);
    if (allNums.length === 15 && allNums.every(n => markedNumbersSet.has(n))) {
      newWins.push('Full House');
    }
  }

  return newWins;
}
