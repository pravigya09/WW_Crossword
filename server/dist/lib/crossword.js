function makeGrid(size) {
    return Array.from({ length: size }, () => Array(size).fill(null));
}
function isGridEmpty(grid) {
    return grid.every(row => row.every(c => c === null));
}
// Returns true if placing `word` at (row,col) in direction `dir` is valid
function canPlace(grid, word, row, col, dir) {
    const size = grid.length;
    const dr = dir === 'down' ? 1 : 0;
    const dc = dir === 'across' ? 1 : 0;
    const endRow = row + dr * (word.length - 1);
    const endCol = col + dc * (word.length - 1);
    // Out of bounds
    if (row < 0 || col < 0 || endRow >= size || endCol >= size)
        return false;
    // Cell before word start must be empty (no adjacent word in same direction)
    if (row - dr >= 0 && col - dc >= 0 && grid[row - dr][col - dc] !== null)
        return false;
    // Cell after word end must be empty
    if (endRow + dr < size && endCol + dc < size && grid[endRow + dr][endCol + dc] !== null)
        return false;
    let intersections = 0;
    for (let i = 0; i < word.length; i++) {
        const r = row + dr * i;
        const c = col + dc * i;
        const cell = grid[r][c];
        if (cell !== null) {
            // Must match
            if (cell !== word[i])
                return false;
            intersections++;
        }
        else {
            // Empty cell — check perpendicular neighbours aren't occupied
            // (would create unintended adjacency)
            const perpChecks = dir === 'across'
                ? [[r - 1, c], [r + 1, c]]
                : [[r, c - 1], [r, c + 1]];
            for (const [pr, pc] of perpChecks) {
                if (pr >= 0 && pr < size && pc >= 0 && pc < size && grid[pr][pc] !== null)
                    return false;
            }
        }
    }
    // First placement OR must intersect an existing word
    return intersections > 0 || isGridEmpty(grid);
}
function countIntersections(grid, word, row, col, dir) {
    const dr = dir === 'down' ? 1 : 0;
    const dc = dir === 'across' ? 1 : 0;
    let n = 0;
    for (let i = 0; i < word.length; i++) {
        if (grid[row + dr * i][col + dc * i] === word[i])
            n++;
    }
    return n;
}
function placeWord(grid, word, row, col, dir) {
    const dr = dir === 'down' ? 1 : 0;
    const dc = dir === 'across' ? 1 : 0;
    for (let i = 0; i < word.length; i++) {
        grid[row + dr * i][col + dc * i] = word[i];
    }
}
function findBestPlacement(grid, word) {
    const size = grid.length;
    let best = null;
    for (const dir of ['across', 'down']) {
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (canPlace(grid, word, r, c, dir)) {
                    const n = countIntersections(grid, word, r, c, dir);
                    if (!best || n > best.intersections) {
                        best = { row: r, col: c, dir, intersections: n };
                    }
                }
            }
        }
    }
    return best;
}
function getBoundingBox(grid) {
    const size = grid.length;
    let minR = size, maxR = -1, minC = size, maxC = -1;
    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            if (grid[r][c] !== null) {
                if (r < minR)
                    minR = r;
                if (r > maxR)
                    maxR = r;
                if (c < minC)
                    minC = c;
                if (c > maxC)
                    maxC = c;
            }
        }
    }
    return { minR, maxR, minC, maxC };
}
export function generateCrossword(entries) {
    // Sort by word length descending — longer words first for more intersection opportunities
    const sorted = [...entries]
        .map(e => ({ ...e, word: e.word.toUpperCase() }))
        .sort((a, b) => b.word.length - a.word.length);
    let bestPlacements = [];
    let bestGrid = [];
    let bestGridSize = 15;
    for (const size of [15, 17, 19, 21]) {
        const grid = makeGrid(size);
        const placements = [];
        const placed = new Set();
        // Place first word horizontally in center
        const firstWord = sorted[0].word;
        const r0 = Math.floor(size / 2);
        const c0 = Math.floor((size - firstWord.length) / 2);
        placeWord(grid, firstWord, r0, c0, 'across');
        placements.push({ wordIdx: 0, word: firstWord, clue: sorted[0].clue, hint: sorted[0].hint, row: r0, col: c0, dir: 'across' });
        placed.add(0);
        // Iteratively try to place remaining words, multiple passes
        let changed = true;
        while (changed) {
            changed = false;
            for (let i = 1; i < sorted.length; i++) {
                if (placed.has(i))
                    continue;
                const p = findBestPlacement(grid, sorted[i].word);
                if (p) {
                    placeWord(grid, sorted[i].word, p.row, p.col, p.dir);
                    placements.push({ wordIdx: i, word: sorted[i].word, clue: sorted[i].clue, hint: sorted[i].hint, row: p.row, col: p.col, dir: p.dir });
                    placed.add(i);
                    changed = true;
                }
            }
        }
        if (placements.length > bestPlacements.length) {
            bestPlacements = placements;
            bestGrid = grid;
            bestGridSize = size;
        }
        if (placed.size === sorted.length)
            break;
    }
    if (bestPlacements.length === 0) {
        return { cells: [], placedWords: [], width: 0, height: 0, unplacedWords: sorted.map(e => e.word) };
    }
    // Trim grid to bounding box
    const { minR, maxR, minC, maxC } = getBoundingBox(bestGrid);
    const trimH = maxR - minR + 1;
    const trimW = maxC - minC + 1;
    const newSize = Math.max(trimH, trimW);
    const trimmed = Array.from({ length: newSize }, () => Array(newSize).fill(null));
    for (let r = minR; r <= maxR; r++) {
        for (let c = minC; c <= maxC; c++) {
            trimmed[r - minR][c - minC] = bestGrid[r][c];
        }
    }
    const adjustedPlacements = bestPlacements.map(p => ({
        ...p,
        row: p.row - minR,
        col: p.col - minC,
    }));
    // Number the grid cells
    const numbering = Array.from({ length: newSize }, () => Array(newSize).fill(0));
    let cellNum = 1;
    for (let r = 0; r < newSize; r++) {
        for (let c = 0; c < newSize; c++) {
            if (trimmed[r][c] === null)
                continue;
            const startsAcross = (c === 0 || trimmed[r][c - 1] === null) && c + 1 < newSize && trimmed[r][c + 1] !== null;
            const startsDown = (r === 0 || trimmed[r - 1][c] === null) && r + 1 < newSize && trimmed[r + 1][c] !== null;
            // Also number single-cell starts (isolated letters shouldn't happen but guard anyway)
            if (startsAcross || startsDown) {
                numbering[r][c] = cellNum++;
            }
        }
    }
    // Build PlacedWord list — assign number from grid numbering at the word's start cell
    const placedWords = adjustedPlacements.map(p => ({
        word: p.word,
        clue: p.clue,
        hint: p.hint,
        row: p.row,
        col: p.col,
        direction: p.dir,
        number: numbering[p.row][p.col],
    }));
    // Build GridCell matrix
    const cells = Array.from({ length: newSize }, () => Array(newSize).fill(null));
    for (const pw of placedWords) {
        const dr = pw.direction === 'down' ? 1 : 0;
        const dc = pw.direction === 'across' ? 1 : 0;
        for (let i = 0; i < pw.word.length; i++) {
            const r = pw.row + dr * i;
            const c = pw.col + dc * i;
            if (!cells[r][c])
                cells[r][c] = { letter: pw.word[i], wordIds: [] };
            if (!cells[r][c].wordIds.includes(pw.number))
                cells[r][c].wordIds.push(pw.number);
        }
    }
    const placedIndices = new Set(bestPlacements.map(p => p.wordIdx));
    const unplacedWords = sorted.filter((_, i) => !placedIndices.has(i)).map(e => e.word);
    return { cells, placedWords, width: newSize, height: newSize, unplacedWords };
}
