(function () {
  const registry = [];
  const globalRuleRegistry = [];
  const effects = {};

  const rarityOrder = {
    common: 8,
    rare: 5,
    epic: 3,
    legendary: 1
  };

  const rarityLabel = {
    common: "일반",
    rare: "희귀",
    epic: "영웅",
    legendary: "전설"
  };

  function registerAugment(augment) {
    if (!augment.id || registry.some(item => item.id === augment.id)) return;
    registry.push({
      rarity: "common",
      tags: [],
      charges: null,
      scope: "round",
      duration: "한 국",
      ...augment
    });
  }

  function registerGlobalRule(rule) {
    if (!rule.id || globalRuleRegistry.some(item => item.id === rule.id)) return;
    globalRuleRegistry.push({
      rarity: "common",
      tags: [],
      ...rule,
      scope: "global",
      duration: rule.duration || "공통 규칙"
    });
  }

  function registerEffect(name, handlers) {
    effects[name] = handlers;
  }

  function createCustomAugment(config) {
    const effectHandlers = buildHandlersFromEffects(config.effects || []);
    registerAugment({
      ...config,
      ...effectHandlers
    });
  }

  function buildHandlersFromEffects(effectConfigs) {
    return effectConfigs.reduce((handlers, effectConfig) => {
      const effect = effects[effectConfig.type];
      if (!effect) {
        console.warn(`Unknown augment effect: ${effectConfig.type}`);
        return handlers;
      }

      Object.entries(effect).forEach(([hook, handler]) => {
        const previous = handlers[hook];
        handlers[hook] = function (ctx, tile, augment) {
          if (previous) previous(ctx, tile, augment);
          handler(ctx, tile, augment, effectConfig);
        };
      });
      return handlers;
    }, {});
  }

  function cloneAugment(augment) {
    return {
      ...augment,
      tags: [...augment.tags]
    };
  }

  function listAugments() {
    return registry.map(cloneAugment);
  }

  function listGlobalRules() {
    return globalRuleRegistry.map(cloneAugment);
  }

  function getAugmentById(id) {
    const augment = registry.find(item => item.id === id);
    return augment ? cloneAugment(augment) : null;
  }

  function getGlobalRuleById(id) {
    const rule = globalRuleRegistry.find(item => item.id === id);
    return rule ? cloneAugment(rule) : null;
  }

  function hydrateAugment(saved) {
    const base = getAugmentById(saved.id);
    if (!base) return saved;
    return {
      ...base,
      ...saved,
      tags: [...base.tags]
    };
  }

  function weightedAugments(player) {
    const synergyTags = getSynergyTags(player);
    return registry.flatMap(augment => {
      const ownedGameAugment = augment.scope === "game" && player.augments.some(active => active.id === augment.id);
      if (ownedGameAugment) return [];
      const synergyBonus = augment.tags.some(tag => synergyTags[tag]) ? 2 : 0;
      const weight = rarityOrder[augment.rarity] + synergyBonus;
      return Array.from({ length: weight }, () => augment);
    });
  }

  function getOffer(player, count, shuffle) {
    const weighted = shuffle(weightedAugments(player));
    const picked = [];
    const seen = new Set();
    weighted.forEach(augment => {
      if (picked.length >= count || seen.has(augment.id)) return;
      seen.add(augment.id);
      picked.push(cloneAugment(augment));
    });
    return picked;
  }

  function getGlobalRuleOffer(count, shuffle) {
    return shuffle(globalRuleRegistry).slice(0, count).map(cloneAugment);
  }

  function hydrateGlobalRule(saved) {
    const base = getGlobalRuleById(saved.id);
    if (!base) return saved;
    return {
      ...base,
      ...saved,
      tags: [...base.tags]
    };
  }

  function getSynergyTags(player) {
    return player.augments.reduce((tags, augment) => {
      augment.tags.forEach(tag => {
        tags[tag] = (tags[tag] || 0) + 1;
      });
      return tags;
    }, {});
  }

  function getSynergyBonuses(player) {
    const tags = getSynergyTags(player);
    const bonuses = [];
    Object.entries(tags).forEach(([tag, count]) => {
      if (count >= 2) bonuses.push({ tag, count, score: 150 * count });
      if (count >= 3) bonuses.push({ tag, count, score: 300 * count });
    });
    return bonuses;
  }

  registerEffect("score_on_discard_suit", {
    onDiscard(ctx, tile, augment, config) {
      if (tile.suit === config.suit) ctx.addScore(config.score || 0, augment.name);
    }
  });

  registerEffect("score_on_round_end_pair", {
    onRoundEnd(ctx, tile, augment, config) {
      if (window.Mahjong.hasPair(ctx.player.hand)) ctx.addScore(config.score || 0, augment.name);
    }
  });

  registerEffect("score_on_round_end_sequence", {
    onRoundEnd(ctx, tile, augment, config) {
      if (window.Mahjong.hasSequence(ctx.player.hand)) ctx.addScore(config.score || 0, augment.name);
    }
  });

  registerEffect("score_on_win", {
    onWin(ctx, tile, augment, config) {
      ctx.addScore(config.score || 0, augment.name);
    }
  });

  registerEffect("extra_draw_once", {
    onDraw(ctx, tile, augment, config) {
      if (augment.charges <= 0 || ctx.wall.length === 0) return;
      const extra = ctx.drawFromWall();
      ctx.player.hand.push(extra);
      ctx.requireExtraDiscard();
      augment.charges -= 1;
      ctx.log(`${ctx.player.name}: ${augment.name}으로 ${extra.label} 추가 드로우`);
      if (config.score) ctx.addScore(config.score, augment.name);
    }
  });

  registerEffect("mark_drawn_tile_bonus", {
    onDraw(ctx, tile, augment) {
      if (augment.charges <= 0 || !ctx.drawnTile) return;
      ctx.drawnTile.bonus = true;
      augment.charges -= 1;
      ctx.log(`${ctx.player.name}: ${ctx.drawnTile.label}이 ${augment.name} 대상이 됨`);
    },
    onDiscard(ctx, tile, augment, config) {
      if (tile.bonus) ctx.addScore(config.score || 0, augment.name);
    }
  });

  window.AugmentSystem = {
    rarityLabel,
    registerAugment,
    registerGlobalRule,
    registerEffect,
    createCustomAugment,
    listAugments,
    listGlobalRules,
    getAugmentById,
    getGlobalRuleById,
    hydrateAugment,
    hydrateGlobalRule,
    getOffer,
    getGlobalRuleOffer,
    getSynergyBonuses
  };
})();
