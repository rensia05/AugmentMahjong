(function () {
  const { createCustomAugment, registerAugment, registerEffect } = window.AugmentSystem;

  /*
    커스텀 증강은 이 파일에 추가하세요.

    기본값:
    - scope: "game" | "round" | "tile"
    - rarity: "common" | "rare" | "epic" | "legendary"
    - duration: 화면에 표시할 설명용 문자열
    - tags: 시너지 태그 목록

    effects로 조립 가능한 기본 효과:
    - score_on_discard_suit: 특정 suit 버림 시 점수. suit: "man" | "pin" | "sou" | "honor"
    - score_on_round_end_pair: 국 종료 때 머리가 있으면 점수
    - score_on_round_end_sequence: 국 종료 때 순자가 있으면 점수
    - score_on_win: 화료 시 점수
    - extra_draw_once: 1회 추가 드로우 후 추가 버림 요구
    - mark_drawn_tile_bonus: 다음 드로우 패를 보너스패로 만들고 버리면 점수
  */

  createCustomAugment({
    id: "custom_pin_cashback",
    name: "통수 캐시백",
    duration: "한 국",
    scope: "round",
    rarity: "common",
    tags: ["점수", "통"],
    description: "이번 국에서 통수를 버릴 때마다 120점을 얻습니다.",
    effects: [{ type: "score_on_discard_suit", suit: "pin", score: 120 }]
  });

  createCustomAugment({
    id: "custom_pair_finish",
    name: "머리값",
    duration: "한 국",
    scope: "round",
    rarity: "rare",
    tags: ["머리", "점수"],
    description: "국 종료 때 손패에 같은 패 2개가 있으면 500점을 얻습니다.",
    effects: [{ type: "score_on_round_end_pair", score: 500 }]
  });

  // 더 복잡한 증강은 registerAugment로 직접 훅을 작성하면 됩니다.
  registerAugment({
    id: "custom_first_discard_bonus",
    name: "첫 수 보너스",
    duration: "한 국",
    scope: "round",
    rarity: "rare",
    tags: ["운영", "점수"],
    charges: 1,
    description: "이번 국 첫 버림패를 버릴 때 400점을 얻습니다.",
    onDiscard(ctx, tile, augment) {
      if (augment.charges <= 0) return;
      ctx.addScore(400, "첫 수 보너스");
      augment.charges -= 1;
    }
  });

  // 새 효과 타입 자체를 추가하고 싶으면 registerEffect를 사용하세요.
  registerEffect("score_on_terminal_discard", {
    onDiscard(ctx, tile, augment, config) {
      if (window.Mahjong.isTerminalOrHonor(tile)) ctx.addScore(config.score || 0, augment.name);
    }
  });
})();
