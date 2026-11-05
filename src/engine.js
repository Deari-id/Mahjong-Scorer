/* Chinese Official (MCR) mahjong scoring engine.
   Tiles are indices 0-33: 0-8 Characters 1-9, 9-17 Dots 1-9, 18-26 Bamboo 1-9,
   27-30 East South West North, 31 Red Dragon, 32 Green Dragon, 33 White Dragon. */
var MJ = (function () {
  const SUIT_NAMES = ['Characters', 'Dots', 'Bamboo'];
  const HONOR_NAMES = ['East Wind', 'South Wind', 'West Wind', 'North Wind', 'Red Dragon', 'Green Dragon', 'White Dragon'];
  const isSuit = t => t < 27, suitOf = t => Math.floor(t / 9), numOf = t => (t % 9) + 1;
  const isHonor = t => t >= 27, isWind = t => t >= 27 && t <= 30, isDragon = t => t >= 31;
  const isTerm = t => t < 27 && (t % 9 === 0 || t % 9 === 8);
  const isTH = t => isHonor(t) || isTerm(t);
  const tileName = t => isSuit(t) ? numOf(t) + ' ' + SUIT_NAMES[suitOf(t)] : HONOR_NAMES[t - 27];
  const ORPHANS = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];
  const GREEN = new Set([19, 20, 21, 23, 25, 32]);
  // Vertically symmetrical tiles: Dots 1234589, Bamboo 245689, White Dragon
  const REVERSIBLE = new Set([9, 10, 11, 12, 13, 16, 17, 19, 21, 22, 23, 25, 26, 33]);
  const PERMS = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];

  // [number, name, points, multi?, description]
  const FANS = [
    [1, 'Pure Double Chow', 1, true, 'Two identical chows in the same suit.'],
    [2, 'Mixed Double Chow', 1, true, 'Two chows of the same numbers in two different suits.'],
    [3, 'Short Straight', 1, true, 'Two chows in the same suit that join into a run of six, such as 3-4-5 and 6-7-8.'],
    [4, 'Two Terminal Chows', 1, true, '1-2-3 and 7-8-9 in the same suit.'],
    [5, 'Pung of Terminals or Honors', 1, true, 'Each pung of 1s, 9s or Winds. Dragon pungs and pungs of the Seat or Prevalent Wind score their own hand instead.'],
    [6, 'Melded Kong', 1, false, 'A kong claimed from another player, or promoted from a melded pung.'],
    [7, 'One Voided Suit', 1, false, 'The hand has no tiles at all of one of the three suits.'],
    [8, 'No Honors', 1, false, 'Only suit tiles; no Winds or Dragons.'],
    [9, 'Edge Wait', 1, false, 'Winning on the 3 of 1-2 or the 7 of 8-9, when that is the only tile that completes the hand.'],
    [10, 'Closed Wait', 1, false, 'Winning on the middle tile of a chow, such as the 5 of 4-6, when that is the only winning tile.'],
    [11, 'Single Wait', 1, false, 'Winning on the tile that completes the pair, when that is the only winning tile.'],
    [12, 'Self-Drawn', 1, false, 'Going out on a tile drawn from the wall. A replacement tile for a Flower counts as self-drawn.'],
    [13, 'Flower Tiles', 1, true, 'Each Flower or Season tile. Bonus only: it does not count toward the 8-point minimum.'],
    [14, 'Dragon Pung', 2, false, 'A pung or kong of Dragons, melded or concealed.'],
    [15, 'Prevalent Wind', 2, false, 'A pung or kong of the Wind of the current round.'],
    [16, 'Seat Wind', 2, false, 'A pung or kong of your own seat Wind.'],
    [17, 'Concealed Hand', 2, false, 'No melded sets, and going out on another player’s discard.'],
    [18, 'All Chows', 2, false, 'Four chows and a pair that is not an Honor.'],
    [19, 'Tile Hog', 2, true, 'All four copies of a tile used in the hand without declaring them as a kong.'],
    [20, 'Double Pung', 2, true, 'Two pungs of the same number in two suits.'],
    [21, 'Two Concealed Pungs', 2, false, 'Two pungs (or kongs) built without claiming a discard.'],
    [22, 'Concealed Kong', 2, false, 'A kong made from four tiles all drawn from the wall.'],
    [23, 'All Simples', 2, false, 'No Terminals and no Honors: only 2 to 8.'],
    [24, 'Outside Hand', 4, false, 'Every set and the pair contains a Terminal or an Honor.'],
    [25, 'Fully Concealed Hand', 4, false, 'No melded sets, and the winning tile is drawn from the wall.'],
    [26, 'Two Melded Kongs', 4, false, 'Two kongs claimed or promoted from melded pungs.'],
    [27, 'Last Tile', 4, false, 'Winning on a tile when the other three copies are already visible in discards or melds.'],
    [28, 'All Pungs', 6, false, 'Four pungs or kongs and a pair, no chows.'],
    [29, 'Half Flush', 6, false, 'One suit plus Honors.'],
    [30, 'Mixed Shifted Chows', 6, false, 'Three chows, one in each suit, each starting one number higher than the last.'],
    [31, 'All Types', 6, false, 'Characters, Dots, Bamboo, Winds and Dragons all appear in the hand.'],
    [32, 'Melded Hand', 6, false, 'All four sets melded, then going out on a discard to complete the pair.'],
    [33, 'Two Dragons', 6, false, 'Two pungs or kongs of Dragons.'],
    [34, 'Mixed Straight', 8, false, '1-2-3, 4-5-6 and 7-8-9, each in a different suit.'],
    [35, 'Reversible Tiles', 8, false, 'Only tiles that look the same upside down: Dots 1-2-3-4-5-8-9, Bamboo 2-4-5-6-8-9, White Dragon.'],
    [36, 'Mixed Triple Chow', 8, false, 'The same chow in all three suits.'],
    [37, 'Mixed Shifted Pungs', 8, false, 'Three pungs, one in each suit, each one number higher than the last.'],
    [38, 'Chicken Hand', 8, false, 'A complete hand that would otherwise score nothing. Flowers are added on top.'],
    [39, 'Last Tile Draw', 8, false, 'Going out on the very last tile drawn from the wall. Self-Drawn is not added.'],
    [40, 'Last Tile Claim', 8, false, 'Going out on the very last discard of the game.'],
    [41, 'Out With Replacement Tile', 8, false, 'Going out on the replacement tile drawn after a kong (not after a Flower).'],
    [42, 'Two Concealed Kongs', 8, false, 'Two kongs made entirely from tiles drawn from the wall.'],
    [43, 'Robbing The Kong', 8, false, 'Going out on the tile another player adds to a melded pung to make a kong.'],
    [44, 'Lesser Honors and Knitted Tiles', 12, false, '14 single tiles: Honors plus suit tiles from the 1-4-7, 2-5-8 and 3-6-9 knitted sequences, one sequence per suit.'],
    [45, 'Knitted Straight', 12, false, '1-4-7, 2-5-8 and 3-6-9, each in a different suit, plus one set and a pair.'],
    [46, 'Upper Four', 12, false, 'Only suit tiles 6 to 9.'],
    [47, 'Lower Four', 12, false, 'Only suit tiles 1 to 4.'],
    [48, 'Big Three Winds', 12, false, 'Pungs or kongs of three Winds.'],
    [49, 'Pure Straight', 16, false, '1-2-3, 4-5-6 and 7-8-9 in one suit.'],
    [50, 'Three-Suited Terminal Chows', 16, false, '1-2-3 and 7-8-9 in one suit, the same in a second suit, and a pair of 5s in the third.'],
    [51, 'Pure Shifted Chows', 16, false, 'Three chows in one suit, each shifted up by one, or each by two.'],
    [52, 'All Fives', 16, false, 'Every set and the pair contains a 5.'],
    [53, 'Triple Pung', 16, false, 'Pungs of the same number in all three suits.'],
    [54, 'Three Concealed Pungs', 16, false, 'Three pungs (or kongs) built without claiming a discard.'],
    [55, 'Seven Pairs', 24, false, 'Seven pairs. Always ends on a single wait.'],
    [56, 'Greater Honors and Knitted Tiles', 24, false, 'All seven Honors as singles plus seven knitted suit tiles.'],
    [57, 'All Even', 24, false, 'Pungs and a pair of even numbers only (2, 4, 6, 8).'],
    [58, 'Full Flush', 24, false, 'Only tiles of one suit.'],
    [59, 'Pure Triple Chow', 24, false, 'Three identical chows in one suit.'],
    [60, 'Pure Shifted Pungs', 24, false, 'Three pungs in one suit, each one number higher than the last.'],
    [61, 'Upper Tiles', 24, false, 'Only suit tiles 7, 8 and 9.'],
    [62, 'Middle Tiles', 24, false, 'Only suit tiles 4, 5 and 6.'],
    [63, 'Lower Tiles', 24, false, 'Only suit tiles 1, 2 and 3.'],
    [64, 'Four Shifted Chows', 32, false, 'Four chows in one suit, each shifted by one, or each by two.'],
    [65, 'Three Kongs', 32, false, 'Three kongs, melded or concealed.'],
    [66, 'All Terminals and Honors', 32, false, 'Only 1s, 9s and Honors.'],
    [67, 'Quadruple Chow', 48, false, 'Four identical chows in one suit.'],
    [68, 'Four Pure Shifted Pungs', 48, false, 'Four pungs in one suit, each one number higher than the last.'],
    [69, 'All Terminals', 64, false, 'Only 1s and 9s.'],
    [70, 'Little Four Winds', 64, false, 'Pungs of three Winds and a pair of the fourth.'],
    [71, 'Little Three Dragons', 64, false, 'Pungs of two Dragons and a pair of the third.'],
    [72, 'All Honors', 64, false, 'Only Winds and Dragons.'],
    [73, 'Four Concealed Pungs', 64, false, 'Four pungs (or kongs) built without claiming a discard.'],
    [74, 'Pure Terminal Chows', 64, false, 'Two 1-2-3s, two 7-8-9s and a pair of 5s, all one suit.'],
    [75, 'Big Four Winds', 88, false, 'Pungs or kongs of all four Winds.'],
    [76, 'Big Three Dragons', 88, false, 'Pungs or kongs of all three Dragons.'],
    [77, 'All Green', 88, false, 'Only Bamboo 2, 3, 4, 6, 8 and Green Dragons.'],
    [78, 'Nine Gates', 88, false, '1-1-1-2-3-4-5-6-7-8-9-9-9 of one suit, concealed, waiting on any tile of that suit.'],
    [79, 'Four Kongs', 88, false, 'Four kongs, melded or concealed.'],
    [80, 'Seven Shifted Pairs', 88, false, 'Seven consecutive pairs in one suit.'],
    [81, 'Thirteen Orphans', 88, false, 'One of each 1, 9, Wind and Dragon, plus a second copy of any one.'],
  ].map(([no, name, pts, multi, desc]) => ({ no, name, pts, multi, desc }));
  const PTS = {}; FANS.forEach(f => PTS[f.name] = f.pts);

  // Fans that a higher fan already includes ("implied" or "cannot be combined" in the guide).
  const EXCL = {
    'Big Four Winds': ['Big Three Winds', 'Little Four Winds', 'All Pungs', 'Prevalent Wind', 'Seat Wind', 'Pung of Terminals or Honors'],
    'Big Three Dragons': ['Dragon Pung', 'Two Dragons'],
    'All Green': ['Half Flush'],
    'Nine Gates': ['Full Flush', 'Concealed Hand', 'Pung of Terminals or Honors', 'No Honors', 'One Voided Suit'],
    'Four Kongs': ['Three Kongs', 'Two Melded Kongs', 'Two Concealed Kongs', 'Melded Kong', 'Concealed Kong', 'Single Wait', 'All Pungs'],
    'Seven Shifted Pairs': ['Seven Pairs', 'Full Flush', 'Fully Concealed Hand', 'Concealed Hand', 'Single Wait', 'No Honors', 'One Voided Suit'],
    'Thirteen Orphans': ['All Types', 'All Terminals and Honors', 'Concealed Hand', 'Single Wait'],
    'All Terminals': ['All Terminals and Honors', 'All Pungs', 'Outside Hand', 'Pung of Terminals or Honors', 'No Honors', 'Double Pung'],
    'Little Four Winds': ['Big Three Winds'],
    'Little Three Dragons': ['Dragon Pung', 'Two Dragons'],
    'All Honors': ['All Terminals and Honors', 'All Pungs', 'Outside Hand', 'Pung of Terminals or Honors'],
    'Four Concealed Pungs': ['Three Concealed Pungs', 'Two Concealed Pungs', 'All Pungs', 'Concealed Hand', 'Fully Concealed Hand'],
    'Pure Terminal Chows': ['Full Flush', 'All Chows', 'Seven Pairs', 'Pure Double Chow', 'Two Terminal Chows', 'No Honors', 'One Voided Suit'],
    'Quadruple Chow': ['Pure Triple Chow', 'Pure Shifted Pungs', 'Pure Double Chow', 'Tile Hog'],
    'Four Pure Shifted Pungs': ['Pure Shifted Pungs', 'Pure Triple Chow', 'All Pungs'],
    'Four Shifted Chows': ['Pure Shifted Chows', 'Short Straight', 'Two Terminal Chows'],
    'Three Kongs': ['Two Melded Kongs', 'Two Concealed Kongs', 'Melded Kong', 'Concealed Kong'],
    'All Terminals and Honors': ['All Pungs', 'Outside Hand', 'Pung of Terminals or Honors'],
    'Seven Pairs': ['Concealed Hand', 'Single Wait'],
    'Greater Honors and Knitted Tiles': ['Lesser Honors and Knitted Tiles', 'All Types', 'Concealed Hand', 'Single Wait'],
    'All Even': ['All Pungs', 'All Simples', 'No Honors'],
    'Full Flush': ['No Honors', 'One Voided Suit'],
    'Pure Triple Chow': ['Pure Shifted Pungs', 'Pure Double Chow'],
    'Pure Shifted Pungs': ['Pure Triple Chow'],
    'Upper Tiles': ['Upper Four', 'No Honors'],
    'Middle Tiles': ['All Simples', 'No Honors'],
    'Lower Tiles': ['Lower Four', 'No Honors'],
    'Pure Straight': ['Short Straight', 'Two Terminal Chows'],
    'Three-Suited Terminal Chows': ['All Chows', 'Two Terminal Chows', 'Mixed Double Chow', 'No Honors'],
    'All Fives': ['All Simples'],
    'Triple Pung': ['Double Pung'],
    'Three Concealed Pungs': ['Two Concealed Pungs'],
    'Lesser Honors and Knitted Tiles': ['All Types', 'Concealed Hand', 'Single Wait'],
    'Upper Four': ['No Honors'],
    'Lower Four': ['No Honors'],
    'Big Three Winds': [],
    'Half Flush': ['One Voided Suit'],
    'Melded Hand': ['Single Wait'],
    'Two Dragons': ['Dragon Pung'],
    'Fully Concealed Hand': ['Self-Drawn', 'Concealed Hand'],
    'Two Melded Kongs': ['Melded Kong'],
    'Last Tile Draw': ['Self-Drawn'],
    'Out With Replacement Tile': ['Self-Drawn'],
    'Robbing The Kong': ['Last Tile'],
    'All Chows': ['No Honors'],
    'All Simples': ['No Honors'],
  };

  const counts = list => { const c = new Array(34).fill(0); list.forEach(t => c[t]++); return c; };
  const sum = c => c.reduce((a, b) => a + b, 0);

  function decompose(c0, need) {
    const c = c0.slice(), out = [], seen = new Set(), sets = [];
    (function rec(pair) {
      let i = 0; while (i < 34 && c[i] === 0) i++;
      if (i === 34) {
        if (pair !== null && sets.length === need) {
          const key = pair + '|' + sets.map(s => s.type[0] + s.tile).sort().join(',');
          if (!seen.has(key)) { seen.add(key); out.push({ pair, sets: sets.map(s => ({ ...s })) }); }
        }
        return;
      }
      if (sets.length > need) return;
      if (pair === null && c[i] >= 2) { c[i] -= 2; rec(i); c[i] += 2; }
      if (c[i] >= 3) { c[i] -= 3; sets.push({ type: 'pung', tile: i }); rec(pair); sets.pop(); c[i] += 3; }
      if (i < 27 && i % 9 <= 6 && c[i + 1] > 0 && c[i + 2] > 0) {
        c[i]--; c[i + 1]--; c[i + 2]--; sets.push({ type: 'chow', tile: i }); rec(pair); sets.pop(); c[i]++; c[i + 1]++; c[i + 2]++;
      }
    })(null);
    return out;
  }
  const knitTiles = p => { const r = []; for (let s = 0; s < 3; s++) for (let k = 0; k < 3; k++) r.push(s * 9 + p[s] + 3 * k); return r; };
  const isSevenPairs = c => sum(c) === 14 && c.every(x => x === 0 || x === 2 || x === 4);
  const isOrphans = c => sum(c) === 14 && ORPHANS.every(t => c[t] >= 1) && c.every((x, t) => x === 0 || ORPHANS.includes(t));
  function honorsKnitted(c) {
    if (sum(c) !== 14 || c.some(x => x > 1)) return null;
    for (const p of PERMS) {
      let ok = true;
      for (let t = 0; t < 27; t++) if (c[t] && (t % 9) % 3 !== p[suitOf(t)]) { ok = false; break; }
      if (ok) {
        const honors = c.slice(27).filter(x => x).length;
        return { perm: p, greater: honors === 7, fullKnit: knitTiles(p).every(t => c[t]) };
      }
    }
    return null;
  }
  function knittedSplits(c, m) {
    const out = [];
    if (m > 1) return out;
    for (const p of PERMS) {
      const kt = knitTiles(p);
      if (!kt.every(t => c[t] > 0)) continue;
      const c2 = c.slice(); kt.forEach(t => c2[t]--);
      decompose(c2, 1 - m).forEach(d => out.push({ perm: p, d }));
    }
    return out;
  }
  function isWinning(c, m) {
    if (sum(c) !== 14 - 3 * m) return false;
    if (decompose(c, 4 - m).length) return true;
    if (m === 0 && (isSevenPairs(c) || isOrphans(c) || honorsKnitted(c))) return true;
    return knittedSplits(c, m).length > 0;
  }

  // ---- combination fans among sets ----
  function chowPairFan(a, b) {
    if (a.s === b.s) {
      if (a.n === b.n) return 'Pure Double Chow';
      if (Math.abs(a.n - b.n) === 3) return 'Short Straight';
      if ((a.n === 1 && b.n === 7) || (a.n === 7 && b.n === 1)) return 'Two Terminal Chows';
      return null;
    }
    return a.n === b.n ? 'Mixed Double Chow' : null;
  }
  function chowTripleFan(a, b, c) {
    const ns = [a.n, b.n, c.n].sort((x, y) => x - y);
    if (a.s === b.s && b.s === c.s) {
      if (ns[0] === 1 && ns[1] === 4 && ns[2] === 7) return 'Pure Straight';
      if (ns[0] === ns[2]) return 'Pure Triple Chow';
      const d = ns[1] - ns[0];
      if ((d === 1 || d === 2) && ns[2] - ns[1] === d) return 'Pure Shifted Chows';
      return null;
    }
    if (a.s !== b.s && b.s !== c.s && a.s !== c.s) {
      if (ns[0] === 1 && ns[1] === 4 && ns[2] === 7) return 'Mixed Straight';
      if (ns[0] === ns[2]) return 'Mixed Triple Chow';
      if (ns[1] - ns[0] === 1 && ns[2] - ns[1] === 1) return 'Mixed Shifted Chows';
    }
    return null;
  }
  // Chows may be combined with each other at most once per pair, without loops (MCR "account once").
  function bestPairSelection(items, pairFn) {
    const pairs = [];
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const f = pairFn(items[i], items[j]); if (f) pairs.push([i, j, f]);
    }
    let best = [];
    for (let mask = 1; mask < (1 << pairs.length); mask++) {
      const chosen = pairs.filter((_, k) => mask & (1 << k));
      if (chosen.length <= best.length || chosen.length > items.length - 1) continue;
      const parent = items.map((_, i) => i), deg = items.map(() => 0);
      const find = x => parent[x] === x ? x : (parent[x] = find(parent[x]));
      let ok = true;
      for (const [i, j] of chosen) {
        if (++deg[i] > 2 || ++deg[j] > 2) { ok = false; break; }
        const a = find(i), b = find(j); if (a === b) { ok = false; break; } parent[a] = b;
      }
      if (ok) best = chosen;
    }
    return best.map(p => p[2]);
  }
  function chowFans(chows, pair) {
    if (chows.length < 2) return [];
    if (chows.length === 4) {
      const ss = chows.map(c => c.s), ns = chows.map(c => c.n).sort((a, b) => a - b);
      const sameSuit = ss.every(s => s === ss[0]);
      if (sameSuit && ns[0] === ns[3]) return ['Quadruple Chow'];
      if (sameSuit) { const d = ns[1] - ns[0]; if ((d === 1 || d === 2) && ns[2] - ns[1] === d && ns[3] - ns[2] === d) return ['Four Shifted Chows']; }
      if (pair !== null && isSuit(pair) && numOf(pair) === 5) {
        if (sameSuit && ss[0] === suitOf(pair) && ns.join() === '1,1,7,7') return ['Pure Terminal Chows'];
        const bySuit = {}; chows.forEach(c => (bySuit[c.s] = bySuit[c.s] || []).push(c.n));
        const keys = Object.keys(bySuit);
        if (keys.length === 2 && keys.every(k => bySuit[k].sort().join() === '1,7') && !keys.includes(String(suitOf(pair))))
          return ['Three-Suited Terminal Chows'];
      }
    }
    let best = [], bestPts = -1;
    const val = l => l.reduce((a, n) => a + PTS[n], 0);
    for (let i = 0; i < chows.length; i++) for (let j = i + 1; j < chows.length; j++) for (let k = j + 1; k < chows.length; k++) {
      const f = chowTripleFan(chows[i], chows[j], chows[k]); if (!f) continue;
      const list = [f];
      const rest = chows.findIndex((_, x) => x !== i && x !== j && x !== k);
      if (rest >= 0) {
        for (const x of [i, j, k]) { const pf = chowPairFan(chows[rest], chows[x]); if (pf) { list.push(pf); break; } }
      }
      if (val(list) > bestPts) { best = list; bestPts = val(list); }
    }
    const pl = bestPairSelection(chows, chowPairFan);
    if (val(pl) > bestPts) best = pl;
    return best;
  }
  function pungFans(pungs) {
    const p = pungs.filter(x => x.s !== null);
    if (p.length < 2) return [];
    if (p.length === 4) {
      const ns = p.map(x => x.n).sort((a, b) => a - b);
      if (p.every(x => x.s === p[0].s) && ns[1] === ns[0] + 1 && ns[2] === ns[1] + 1 && ns[3] === ns[2] + 1) return ['Four Pure Shifted Pungs'];
    }
    let best = [], bestPts = -1;
    const val = l => l.reduce((a, n) => a + PTS[n], 0);
    for (let i = 0; i < p.length; i++) for (let j = i + 1; j < p.length; j++) for (let k = j + 1; k < p.length; k++) {
      const a = p[i], b = p[j], c = p[k], ns = [a.n, b.n, c.n].sort((x, y) => x - y);
      const consecutive = ns[1] === ns[0] + 1 && ns[2] === ns[1] + 1;
      const allSame = a.s === b.s && b.s === c.s, allDiff = a.s !== b.s && b.s !== c.s && a.s !== c.s;
      let f = null;
      if (allSame && consecutive) f = 'Pure Shifted Pungs';
      else if (allDiff && ns[0] === ns[2]) f = 'Triple Pung';
      else if (allDiff && consecutive) f = 'Mixed Shifted Pungs';
      if (!f) continue;
      const list = [f];
      const rest = p.findIndex((_, x) => x !== i && x !== j && x !== k);
      if (rest >= 0 && [a, b, c].some(q => q.n === p[rest].n && q.s !== p[rest].s)) list.push('Double Pung');
      if (val(list) > bestPts) { best = list; bestPts = val(list); }
    }
    const pl = bestPairSelection(p, (a, b) => a.n === b.n && a.s !== b.s ? 'Double Pung' : null);
    if (val(pl) > bestPts) best = pl;
    return best;
  }

  // ---- score one interpretation of the hand ----
  function scoreHand(h, ctx) {
    const F = new Map();
    const add = (n, k = 1) => { if (k > 0) F.set(n, (F.get(n) || 0) + k); };
    const tc = ctx.allCounts, self = ctx.self;
    const present = tc.map(x => x > 0);
    const tilesIn = pred => present.every((p, t) => !p || pred(t));
    const suits = new Set(); let honor = false, wind = false, dragon = false;
    present.forEach((p, t) => { if (!p) return; if (isSuit(t)) suits.add(suitOf(t)); else { honor = true; if (isWind(t)) wind = true; else dragon = true; } });

    // Whole-hand tile patterns
    if (!honor) add('No Honors');
    if (suits.size === 2) add('One Voided Suit');
    if (suits.size === 1) add(honor ? 'Half Flush' : 'Full Flush');
    if (suits.size === 0) add('All Honors');
    if (tilesIn(t => isSuit(t) && !isTerm(t))) add('All Simples');
    if (tilesIn(isTerm)) add('All Terminals');
    if (tilesIn(isTH)) add('All Terminals and Honors');
    if (tilesIn(t => isSuit(t) && numOf(t) >= 7)) add('Upper Tiles');
    else if (tilesIn(t => isSuit(t) && numOf(t) >= 6)) add('Upper Four');
    if (tilesIn(t => isSuit(t) && numOf(t) >= 4 && numOf(t) <= 6)) add('Middle Tiles');
    if (tilesIn(t => isSuit(t) && numOf(t) <= 3)) add('Lower Tiles');
    else if (tilesIn(t => isSuit(t) && numOf(t) <= 4)) add('Lower Four');
    if (tilesIn(t => GREEN.has(t))) add('All Green');
    if (tilesIn(t => REVERSIBLE.has(t))) add('Reversible Tiles');
    if (suits.size === 3 && wind && dragon) add('All Types');

    // How the hand was won
    const hasOpen = (h.sets || []).some(s => s.open);
    if (!hasOpen) add(self ? 'Fully Concealed Hand' : 'Concealed Hand');
    if (self) add('Self-Drawn');
    if (ctx.lastTile) add('Last Tile');
    if (self && ctx.lastDraw) add('Last Tile Draw');
    if (!self && ctx.lastClaim) add('Last Tile Claim');
    if (self && ctx.repl) add('Out With Replacement Tile');
    if (!self && ctx.rob) add('Robbing The Kong');

    const kongTiles = new Set((h.sets || []).filter(s => s.type === 'kong').map(s => s.tile));
    add('Tile Hog', tc.filter((x, t) => x === 4 && !kongTiles.has(t)).length);

    if (h.kind === 'pairs') {
      const ps = []; tc.forEach((x, t) => { for (let k = 0; k < x / 2; k++) ps.push(t); });
      const s0 = suitOf(ps[0]);
      if (ps.every(t => isSuit(t) && suitOf(t) === s0) && new Set(ps).size === 7 && numOf(ps[6]) - numOf(ps[0]) === 6) add('Seven Shifted Pairs');
      else add('Seven Pairs');
    } else if (h.kind === 'orphans') {
      add('Thirteen Orphans');
    } else if (h.kind === 'hk') {
      add(h.greater ? 'Greater Honors and Knitted Tiles' : 'Lesser Honors and Knitted Tiles');
      if (h.fullKnit) add('Knitted Straight');
    } else {
      // standard and knitted-straight hands
      const sets = h.sets, pair = h.pair;
      if (h.kind === 'knitted') add('Knitted Straight');
      const pungs = sets.filter(s => s.type !== 'chow'), chows = sets.filter(s => s.type === 'chow');
      const windP = pungs.filter(s => isWind(s.tile)), dragP = pungs.filter(s => isDragon(s.tile));
      if (windP.length === 4) add('Big Four Winds');
      else if (windP.length === 3) add(isWind(pair) ? 'Little Four Winds' : 'Big Three Winds');
      if (dragP.length === 3) add('Big Three Dragons');
      else if (dragP.length === 2) add(isDragon(pair) ? 'Little Three Dragons' : 'Two Dragons');
      else if (dragP.length === 1) add('Dragon Pung');
      if (windP.some(s => s.tile === ctx.prev)) add('Prevalent Wind');
      if (windP.some(s => s.tile === ctx.seat)) add('Seat Wind');
      add('Pung of Terminals or Honors', pungs.filter(s => isTerm(s.tile) ||
        (isWind(s.tile) && windP.length < 3 && s.tile !== ctx.prev && s.tile !== ctx.seat)).length);

      if (pungs.length === 4) add('All Pungs');
      if (chows.length === 4 && !isHonor(pair)) add('All Chows');
      if (h.kind === 'standard') {
        const hasTH = s => s.type === 'chow' ? (numOf(s.tile) === 1 || numOf(s.tile) === 7) : isTH(s.tile);
        const has5 = s => isSuit(s.tile) && (s.type === 'chow' ? numOf(s.tile) >= 3 && numOf(s.tile) <= 5 : numOf(s.tile) === 5);
        if (sets.every(hasTH) && isTH(pair)) add('Outside Hand');
        if (sets.every(has5) && isSuit(pair) && numOf(pair) === 5) add('All Fives');
        if (pungs.length === 4 && tilesIn(t => isSuit(t) && numOf(t) % 2 === 0)) add('All Even');
      }
      chowFans(chows.map(s => ({ s: suitOf(s.tile), n: numOf(s.tile) })), pair).forEach(n => add(n));
      pungFans(pungs.map(s => ({ s: isSuit(s.tile) ? suitOf(s.tile) : null, n: numOf(s.tile) }))).forEach(n => add(n));

      const mk = sets.filter(s => s.type === 'kong' && s.open).length, ck = sets.filter(s => s.type === 'kong' && !s.open).length;
      if (mk + ck === 4) add('Four Kongs');
      else if (mk + ck === 3) add('Three Kongs');
      else if (ck === 2) add('Two Concealed Kongs');
      else if (mk === 2) add('Two Melded Kongs');
      else { if (mk === 1) add('Melded Kong'); if (ck === 1) add('Concealed Kong'); }

      const cp = sets.filter((s, i) => s.type !== 'chow' && !s.open && !(i === h.winEl && !self)).length;
      if (cp === 4) add('Four Concealed Pungs'); else if (cp === 3) add('Three Concealed Pungs'); else if (cp === 2) add('Two Concealed Pungs');

      if (h.kind === 'standard' && ctx.melds === 0 && ctx.nineGates) add('Nine Gates');
      if (h.kind === 'standard' && ctx.melds === 4 && sets.every(s => s.open) && !self) add('Melded Hand');

      if (ctx.waits === 1) {
        if (h.winEl === 'pair') add('Single Wait');
        else if (typeof h.winEl === 'number' && sets[h.winEl].type === 'chow') {
          const pos = ctx.win - sets[h.winEl].tile, n = numOf(sets[h.winEl].tile);
          if (pos === 1) add('Closed Wait');
          else if ((pos === 2 && n === 1) || (pos === 0 && n === 7)) add('Edge Wait');
        }
      }
    }

    // apply exclusions, highest value first
    const names = [...F.keys()].sort((a, b) => PTS[b] - PTS[a]);
    const excluded = new Map();
    for (const n of names) {
      if (excluded.has(n)) continue;
      (EXCL[n] || []).forEach(x => { if (F.has(x) && !excluded.has(x)) excluded.set(x, n); });
    }
    let fans = names.filter(n => !excluded.has(n)).map(n => ({ name: n, pts: PTS[n], count: F.get(n) }));
    if (!fans.length) fans = [{ name: 'Chicken Hand', pts: 8, count: 1 }];
    const total = fans.reduce((a, f) => a + f.pts * f.count, 0);
    return { fans, total, implied: [...excluded].map(([n, by]) => ({ name: n, by })) };
  }

  function evaluate(st) {
    const m = st.melds.length;
    const need = 13 - 3 * m;
    if (st.hand.length !== need || st.win === null) return { incomplete: true, need: need - st.hand.length, needWin: st.win === null };
    const conc = counts([...st.hand, st.win]), h13 = counts(st.hand);
    const meldSets = st.melds.map(x => ({ type: x.type === 'chow' ? 'chow' : x.type === 'pung' ? 'pung' : 'kong', tile: x.tile, open: x.type !== 'ckong' }));
    const all = conc.slice();
    meldSets.forEach(s => { if (s.type === 'chow') { all[s.tile]++; all[s.tile + 1]++; all[s.tile + 2]++; } else all[s.tile] += s.type === 'kong' ? 4 : 3; });
    const over = all.findIndex(x => x > 4);
    if (over >= 0) return { error: 'There are only four ' + tileName(over) + ' tiles in a set.' };
    const used13 = all.slice(); used13[st.win]--;
    const waits = [];
    for (let t = 0; t < 34; t++) { if (used13[t] >= 4) continue; const c = h13.slice(); c[t]++; if (isWinning(c, m)) waits.push(t); }
    if (!isWinning(conc, m)) return { error: 'These tiles don’t make a winning hand. A hand needs four sets and a pair (or a special hand such as Seven Pairs).', waits };

    let nineGates = false;
    if (m === 0) {
      const s0 = st.hand[0] < 27 ? suitOf(st.hand[0]) : -1;
      if (s0 >= 0 && [...st.hand, st.win].every(t => t < 27 && suitOf(t) === s0)) {
        const pat = [3, 1, 1, 1, 1, 1, 1, 1, 3];
        nineGates = pat.every((x, i) => h13[s0 * 9 + i] === x);
      }
    }
    const ctx = { ...st, allCounts: all, melds: m, waits: waits.length, nineGates };
    const cands = [];
    const placements = (sets, pair, extra) => {
      const out = [];
      if (pair === st.win) out.push({ winEl: 'pair' });
      sets.forEach((s, i) => {
        if (s.open || i < m) return;
        const inSet = s.type === 'chow' ? (st.win >= s.tile && st.win <= s.tile + 2) : s.tile === st.win;
        if (inSet && !out.some(o => typeof o.winEl === 'number' && sets[o.winEl].type === s.type && sets[o.winEl].tile === s.tile)) out.push({ winEl: i });
      });
      if (extra) out.push({ winEl: 'knit' });
      return out;
    };
    decompose(conc, 4 - m).forEach(d => {
      const sets = [...meldSets, ...d.sets.map(s => ({ ...s, open: false }))];
      placements(sets, d.pair).forEach(p => cands.push({ kind: 'standard', sets, pair: d.pair, winEl: p.winEl }));
    });
    knittedSplits(conc, m).forEach(({ perm, d }) => {
      const sets = [...meldSets, ...d.sets.map(s => ({ ...s, open: false }))];
      const inKnit = knitTiles(perm).includes(st.win);
      placements(sets, d.pair, inKnit).forEach(p => cands.push({ kind: 'knitted', sets, pair: d.pair, perm, winEl: p.winEl }));
    });
    if (m === 0) {
      if (isSevenPairs(conc)) cands.push({ kind: 'pairs', sets: [] });
      if (isOrphans(conc)) cands.push({ kind: 'orphans', sets: [] });
      const hk = honorsKnitted(conc); if (hk) cands.push({ kind: 'hk', sets: [], ...hk });
    }
    let best = null;
    cands.forEach(c => { const r = scoreHand(c, ctx); if (!best || r.total > best.total) best = { ...r, hand: c }; });
    return { ...best, waits };
  }

  return { FANS, PTS, EXCL, evaluate, tileName, isSuit, suitOf, numOf, knitTiles };
})();
if (typeof module !== 'undefined') module.exports = MJ;
