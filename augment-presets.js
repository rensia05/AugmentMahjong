(function () {
  const { registerAugment, registerGlobalRule, createCustomAugment } = window.AugmentSystem;

  registerGlobalRule({
    id: "global_none",
    name: "없음",
    rarity: "common",
    tags: ["기본"],
    description: "이번 게임에는 모두에게 적용되는 공통 특수 규칙이 없습니다.",
    extraRoundWinds: []
  });

  registerGlobalRule({
    id: "global_dragon_wind_equalizer",
    name: "자패차별금지",
    rarity: "rare",
    tags: ["자패", "공통규칙"],
    description: "백, 발, 중이 풍패 취급을 받으며 백장, 중장, 발장이 게임 라운드에 추가됩니다.",
    dragonWindLabels: ["백", "발", "중"],
    extraRoundWinds: ["백", "중", "발"]
  });

  registerAugment({
    id: "game_suit_builder",
    name: "문양 장인",
    duration: "게임",
    scope: "game",
    rarity: "rare",
    tags: ["문양", "성장"],
    description: "국 종료 때 가장 많은 숫자패 문양 1종마다 120점을 얻습니다.",
    onRoundEnd(ctx) {
      const counts = { man: 0, pin: 0, sou: 0 };
      ctx.player.hand.forEach(tile => {
        if (counts[tile.suit] !== undefined) counts[tile.suit] += 1;
      });
      ctx.addScore(Math.max(...Object.values(counts)) * 120, "문양 장인");
    }
  });

  registerAugment({
    id: "game_clean_discards",
    name: "깔끔한 강",
    duration: "게임",
    scope: "game",
    rarity: "common",
    tags: ["방어", "운영"],
    description: "버림패 종류가 6종 이하로 국을 끝내면 600점을 얻습니다.",
    onRoundEnd(ctx) {
      const unique = new Set(ctx.player.river.map(tile => tile.code)).size;
      if (unique <= 6 && ctx.player.river.length > 0) ctx.addScore(600, "깔끔한 강");
    }
  });

  createCustomAugment({
    id: "round_extra_draw",
    name: "이중 쯔모",
    duration: "한 국",
    scope: "round",
    rarity: "epic",
    tags: ["드로우", "폭발"],
    charges: 1,
    description: "이번 국의 첫 패 뽑기 때 1장을 더 뽑고, 이번 턴에는 2장을 버립니다.",
    effects: [{ type: "extra_draw_once" }]
  });

  createCustomAugment({
    id: "round_honor_tax",
    name: "자패 현상금",
    duration: "한 국",
    scope: "round",
    rarity: "common",
    tags: ["점수", "자패"],
    description: "이번 국에서 자패를 버릴 때마다 90점을 얻습니다.",
    effects: [{ type: "score_on_discard_suit", suit: "honor", score: 90 }]
  });

  createCustomAugment({
    id: "round_sequence",
    name: "순자의 리듬",
    duration: "한 국",
    scope: "round",
    rarity: "rare",
    tags: ["문양", "순자"],
    description: "손패에 같은 문양 연속 3개가 있으면 국 종료 때 700점을 얻습니다.",
    effects: [{ type: "score_on_round_end_sequence", score: 700 }]
  });

  createCustomAugment({
    id: "tile_lucky_draw",
    name: "행운패",
    duration: "한 장",
    scope: "tile",
    rarity: "rare",
    tags: ["드로우", "점수"],
    charges: 1,
    description: "다음에 뽑은 패는 황금패가 되며, 버리면 300점을 얻습니다.",
    effects: [{ type: "mark_drawn_tile_bonus", score: 300 }]
  });

  registerAugment({
    id: "tile_pair_guard",
    name: "머리 보호",
    duration: "한 장",
    scope: "tile",
    rarity: "common",
    tags: ["방어", "머리"],
    charges: 1,
    description: "다음 버림 뒤 손패에 같은 패 2개가 있으면 350점을 얻고 사라집니다.",
    onDiscard(ctx, tile, augment) {
      if (augment.charges <= 0) return;
      if (window.Mahjong.hasPair(ctx.player.hand)) ctx.addScore(350, "머리 보호");
      augment.charges -= 1;
    }
  });

  createCustomAugment({
    id: "legend_hu_bonus",
    name: "만관의 예감",
    duration: "게임",
    scope: "game",
    rarity: "legendary",
    tags: ["화료", "점수"],
    description: "화료하면 추가로 1800점을 얻습니다.",
    effects: [{ type: "score_on_win", score: 1800 }]
  });
})();
