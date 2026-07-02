(function () {
  const suits = [
    { key: "man", label: "만" },
    { key: "pin", label: "통" },
    { key: "sou", label: "삭" }
  ];
  const honors = ["동", "남", "서", "북", "백", "발", "중"];
  const windOrder = ["동", "남", "서", "북"];
  const dragonOrder = ["백", "발", "중"];

  function createWall() {
    const wall = [];
    suits.forEach(suit => {
      for (let number = 1; number <= 9; number += 1) {
        for (let copy = 0; copy < 4; copy += 1) {
          wall.push({
            suit: suit.key,
            number,
            label: `${number}${suit.label}`,
            code: `${suit.key}-${number}`
          });
        }
      }
    });

    honors.forEach(label => {
      for (let copy = 0; copy < 4; copy += 1) {
        wall.push({
          suit: "honor",
          number: 10,
          label,
          code: `honor-${label}`
        });
      }
    });

    return wall;
  }

  function sortHand(hand) {
    const order = { man: 0, pin: 1, sou: 2, honor: 3 };
    hand.sort((a, b) => {
      if (order[a.suit] !== order[b.suit]) return order[a.suit] - order[b.suit];
      return a.number - b.number || a.label.localeCompare(b.label, "ko");
    });
  }

  function countTiles(hand) {
    return hand.reduce((counts, tile) => {
      counts[tile.code] = (counts[tile.code] || 0) + 1;
      return counts;
    }, {});
  }

  function hasPair(hand) {
    return Object.values(countTiles(hand)).some(count => count >= 2);
  }

  function hasSequence(hand) {
    return suits.some(suit => {
      const numbers = new Set(hand.filter(tile => tile.suit === suit.key).map(tile => tile.number));
      for (let n = 1; n <= 7; n += 1) {
        if (numbers.has(n) && numbers.has(n + 1) && numbers.has(n + 2)) return true;
      }
      return false;
    });
  }

  function getDoraFromIndicator(indicator) {
    if (!indicator) return null;
    if (indicator.suit !== "honor") {
      const nextNumber = indicator.number === 9 ? 1 : indicator.number + 1;
      const suit = suits.find(item => item.key === indicator.suit);
      return {
        suit: indicator.suit,
        number: nextNumber,
        label: `${nextNumber}${suit.label}`,
        code: `${indicator.suit}-${nextNumber}`
      };
    }

    const windsIndex = windOrder.indexOf(indicator.label);
    if (windsIndex >= 0) {
      const label = windOrder[(windsIndex + 1) % windOrder.length];
      return { suit: "honor", number: 10, label, code: `honor-${label}` };
    }

    const dragonIndex = dragonOrder.indexOf(indicator.label);
    const label = dragonOrder[(dragonIndex + 1) % dragonOrder.length];
    return { suit: "honor", number: 10, label, code: `honor-${label}` };
  }

  function getDoraTiles(indicators) {
    return indicators.map(getDoraFromIndicator).filter(Boolean);
  }

  function countDora(tiles, indicators) {
    const doraCodes = getDoraTiles(indicators).map(tile => tile.code);
    return tiles.reduce((total, tile) => total + doraCodes.filter(code => code === tile.code).length, 0);
  }

  function isTerminalOrHonor(tile) {
    return tile.suit === "honor" || tile.number === 1 || tile.number === 9;
  }

  function isWindTile(tile) {
    return tile.suit === "honor" && (windOrder.includes(tile.label) || Boolean(tile.globalWind));
  }

  function countDistinctTerminalHonor(hand) {
    return new Set(hand.filter(isTerminalOrHonor).map(tile => tile.code)).size;
  }

  function findKanCandidate(hand) {
    const counts = countTiles(hand);
    const code = Object.keys(counts).find(key => counts[key] >= 4);
    if (!code) return null;
    return hand.find(tile => tile.code === code);
  }

  function canPon(hand, tile) {
    if (!tile) return false;
    return hand.filter(item => item.code === tile.code).length >= 2;
  }

  function getChiOptions(hand, tile) {
    if (!tile || tile.suit === "honor") return [];
    const numbers = new Set(hand.filter(item => item.suit === tile.suit).map(item => item.number));
    return [
      [tile.number - 2, tile.number - 1],
      [tile.number - 1, tile.number + 1],
      [tile.number + 1, tile.number + 2]
    ].filter(option => option.every(number => number >= 1 && number <= 9 && numbers.has(number)));
  }

  function canChi(hand, tile) {
    return getChiOptions(hand, tile).length > 0;
  }

  function isWinningHand(hand) {
    if (hand.length % 3 !== 2) return false;
    const counts = countTiles(hand);

    return Object.keys(counts).some(code => {
      if (counts[code] < 2) return false;
      const remaining = { ...counts };
      remaining[code] -= 2;
      return canMakeSets(remaining);
    });
  }

  function isTenpai(hand) {
    if (hand.length % 3 !== 1) return false;
    const tileTypes = createWall().filter((tile, index, wall) => {
      return wall.findIndex(item => item.code === tile.code) === index;
    });
    return tileTypes.some(tile => isWinningHand([...hand, tile]));
  }

  function canMakeSets(counts) {
    const code = Object.keys(counts).find(key => counts[key] > 0);
    if (!code) return true;

    if (counts[code] >= 3) {
      counts[code] -= 3;
      if (canMakeSets(counts)) return true;
      counts[code] += 3;
    }

    const [suit, numberText] = code.split("-");
    const number = Number(numberText);
    if (suit !== "honor" && number <= 7) {
      const next = `${suit}-${number + 1}`;
      const after = `${suit}-${number + 2}`;
      if ((counts[next] || 0) > 0 && (counts[after] || 0) > 0) {
        counts[code] -= 1;
        counts[next] -= 1;
        counts[after] -= 1;
        if (canMakeSets(counts)) return true;
        counts[code] += 1;
        counts[next] += 1;
        counts[after] += 1;
      }
    }

    return false;
  }

  window.Mahjong = {
    suits,
    honors,
    createWall,
    sortHand,
    countTiles,
    hasPair,
    hasSequence,
    getDoraFromIndicator,
    getDoraTiles,
    countDora,
    isTerminalOrHonor,
    isWindTile,
    countDistinctTerminalHonor,
    findKanCandidate,
    canPon,
    canChi,
    getChiOptions,
    isTenpai,
    isWinningHand
  };
})();
