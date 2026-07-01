(function () {
  function randomizeSeatWinds(players, winds, shuffle) {
    const dealer = shuffle(players.map(player => player.id))[0];
    applySeatWinds(players, winds, dealer);
    return dealer;
  }

  function applySeatWinds(players, winds, dealer) {
    players.forEach((player, index) => {
      const wind = winds[(index - dealer + players.length) % players.length];
      player.wind = wind;
      player.name = `${wind}가`;
    });
  }

  function assignClientsToPlayers(players, clientIds, shuffle) {
    const shuffledClients = shuffle(clientIds).slice(0, players.length);
    players.forEach((player, index) => {
      player.clientId = shuffledClients[index] || "";
    });
  }

  function canDeclareRiichi(player, phase, discardsRequired) {
    return phase === "playing" &&
      discardsRequired > 0 &&
      player.isMenzen &&
      !player.riichi &&
      player.score >= 1000 &&
      getTenpaiDiscardIndexes(player).length > 0;
  }

  function canDiscardTile(player, index) {
    if (!player.riichi) return true;
    return getTenpaiDiscardIndexes(player).includes(index);
  }

  function getTenpaiDiscardIndexes(player) {
    return player.hand
      .map((tile, index) => ({ tile, index }))
      .filter(item => {
        const remaining = player.hand.filter((_, index) => index !== item.index);
        return window.Mahjong.isTenpai(remaining);
      })
      .map(item => item.index);
  }

  function getRonClaimInfos(players, lastDiscard) {
    if (!lastDiscard) return [];
    return players
      .filter(player => player.id !== lastDiscard.fromPlayer)
      .filter(player => window.Mahjong.isWinningHand([...player.hand, lastDiscard.tile]))
      .map(player => ({
        player,
        tile: lastDiscard.tile,
        fromPlayer: players[lastDiscard.fromPlayer]
      }));
  }

  function isFourWindFirstDiscard(firstTurnDiscards) {
    if (firstTurnDiscards.length !== 4) return false;
    return firstTurnDiscards.every(tile => {
      return tile.suit === "honor" &&
        ["동", "남", "서", "북"].includes(tile.label) &&
        tile.label === firstTurnDiscards[0].label;
    });
  }

  function shouldAbortFourKans(players, kanCount) {
    return kanCount >= 4 && !players.some(player => player.kanCount >= 4);
  }

  window.RiichiRules = {
    randomizeSeatWinds,
    applySeatWinds,
    assignClientsToPlayers,
    canDeclareRiichi,
    canDiscardTile,
    getRonClaimInfos,
    isFourWindFirstDiscard,
    shouldAbortFourKans
  };
})();
