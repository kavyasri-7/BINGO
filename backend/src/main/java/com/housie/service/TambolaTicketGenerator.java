package com.housie.service;

import org.springframework.stereotype.Service;
import java.util.*;

@Service
public class TambolaTicketGenerator {

    public Integer[][] generateTicket() {
        Integer[][] grid = new Integer[3][9];
        Random rand = new Random();

        // 9 columns: assign counts summing to 15 (min 1, max 3)
        int[] colCounts = new int[9];
        Arrays.fill(colCounts, 1);
        int remaining = 6;
        while (remaining > 0) {
            int idx = rand.nextInt(9);
            if (colCounts[idx] < 3) {
                colCounts[idx]++;
                remaining--;
            }
        }

        // Generate sorted unique numbers per column
        List<List<Integer>> colNumbers = new ArrayList<>();
        for (int c = 0; c < 9; c++) {
            int min = (c == 0) ? 1 : c * 10;
            int max = (c == 8) ? 90 : (c * 10 + 9);
            Set<Integer> set = new HashSet<>();
            while (set.size() < colCounts[c]) {
                set.add(min + rand.nextInt(max - min + 1));
            }
            List<Integer> list = new ArrayList<>(set);
            Collections.sort(list);
            colNumbers.add(list);
        }

        // Distribute numbers to 3 rows
        int[] rowCounts = new int[3];

        for (int c = 0; c < 9; c++) {
            if (colCounts[c] == 3) {
                grid[0][c] = colNumbers.get(c).get(0);
                grid[1][c] = colNumbers.get(c).get(1);
                grid[2][c] = colNumbers.get(c).get(2);
                rowCounts[0]++;
                rowCounts[1]++;
                rowCounts[2]++;
            }
        }

        List<Integer> otherCols = new ArrayList<>();
        for (int c = 0; c < 9; c++) {
            if (colCounts[c] < 3) otherCols.add(c);
        }
        Collections.shuffle(otherCols);

        for (int c : otherCols) {
            List<Integer> nums = colNumbers.get(c);
            int count = nums.size();

            List<Integer> availRows = new ArrayList<>();
            for (int r = 0; r < 3; r++) {
                if (rowCounts[r] < 5) availRows.add(r);
            }

            if (count == 1 && !availRows.isEmpty()) {
                availRows.sort(Comparator.comparingInt(a -> rowCounts[a]));
                int target = availRows.get(0);
                grid[target][c] = nums.get(0);
                rowCounts[target]++;
            } else if (count == 2 && availRows.size() >= 2) {
                availRows.sort(Comparator.comparingInt(a -> rowCounts[a]));
                List<Integer> targetRows = availRows.subList(0, 2);
                Collections.sort(targetRows);
                grid[targetRows.get(0)][c] = nums.get(0);
                grid[targetRows.get(1)][c] = nums.get(1);
                rowCounts[targetRows.get(0)]++;
                rowCounts[targetRows.get(1)]++;
            }
        }

        return grid;
    }
}
