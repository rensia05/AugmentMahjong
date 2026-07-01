(function () {
  function calculateWin({ player, state, doraCount, rinshan, tsumo = true }) {
    const yaku = [];
    let han = 0;

    if (player.isMenzen) {
      yaku.push("멘젠");
      han += 1;
    }
    if (player.riichi) {
      yaku.push("리치");
      han += 1;
    }
    if (rinshan) {
      yaku.push("영상개화");
      han += 1;
    }
    if (tsumo && player.isMenzen) {
      yaku.push("멘젠쯔모");
      han += 1;
    }
    if (doraCount > 0) {
      yaku.push(`도라 ${doraCount}`);
      han += doraCount;
    }

    const fu = calculateFu({ player, tsumo });
    const base = fu * Math.pow(2, han + 2);
    const rounded = roundUp(base * (player.id === state.dealer ? 6 : 4) + state.honba * 300, 100);

    return {
      han,
      fu,
      yaku,
      total: Math.max(1000, rounded),
      label: `${han}판 ${fu}부`
    };
  }

  function calculateFu({ player, tsumo }) {
    let fu = 20;
    if (player.isMenzen) fu += 10;
    if (tsumo) fu += 2;
    player.melds.forEach(meld => {
      if (meld.type === "pon") fu += 2;
      if (meld.type === "kan") fu += meld.open ? 8 : 16;
    });
    return roundUp(fu, 10);
  }

  function roundUp(value, unit) {
    return Math.ceil(value / unit) * unit;
  }

  function splitTsumoPayment(total) {
    return Math.ceil(total / 3 / 100) * 100;
  }

  window.Scoring = {
    calculateWin,
    splitTsumoPayment
  };
})();
