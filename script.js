const winds = ["동", "남", "서", "북"];
const maxTurnsPerRound = 72;
const defaultStartScore = 25000;
const gameModes = {
  tonpuu: { label: "동풍전", endWind: 0 },
  hanchan: { label: "반장전", endWind: 1 }
};

const state = {
  phase: "ready",
  gameStarted: false,
  gameMode: "hanchan",
  startScore: defaultStartScore,
  roundWind: 0,
  handIndex: 0,
  dealer: 0,
  honba: 0,
  gameEndedReason: "",
  round: 0,
  turn: 0,
  wall: [],
  deadWall: [],
  doraIndicators: [],
  rinshanTiles: [],
  players: createPlayers(),
  currentPlayer: 0,
  pickerPlayer: 0,
  rewardPlayer: 0,
  offeredAugments: [],
  offeredRewards: [],
  discardsRequired: 0,
  lastDiscard: null,
  drawnTile: null,
  drewFromRinshan: false,
  roundEndedBy: "",
  firstTurnDiscards: [],
  kanCount: 0,
  riichiCount: 0
};

const els = {
  phaseBadge: document.querySelector("#phaseBadge"),
  roundNumber: document.querySelector("#roundNumber"),
  turnNumber: document.querySelector("#turnNumber"),
  wallCount: document.querySelector("#wallCount"),
  doraIndicators: document.querySelector("#doraIndicators"),
  score: document.querySelector("#score"),
  players: document.querySelector("#players"),
  handTitle: document.querySelector("#handTitle"),
  hand: document.querySelector("#hand"),
  river: document.querySelector("#discardRiver"),
  handHint: document.querySelector("#handHint"),
  startRoundBtn: document.querySelector("#startRoundBtn"),
  gameMode: document.querySelector("#gameMode"),
  startScore: document.querySelector("#startScore"),
  drawBtn: document.querySelector("#drawBtn"),
  chiBtn: document.querySelector("#chiBtn"),
  ponBtn: document.querySelector("#ponBtn"),
  kanBtn: document.querySelector("#kanBtn"),
  riichiBtn: document.querySelector("#riichiBtn"),
  ronBtn: document.querySelector("#ronBtn"),
  winBtn: document.querySelector("#winBtn"),
  endRoundBtn: document.querySelector("#endRoundBtn"),
  connectBtn: document.querySelector("#connectBtn"),
  serverUrl: document.querySelector("#serverUrl"),
  roomCode: document.querySelector("#roomCode"),
  createRoomBtn: document.querySelector("#createRoomBtn"),
  joinRoomBtn: document.querySelector("#joinRoomBtn"),
  leaveRoomBtn: document.querySelector("#leaveRoomBtn"),
  onlineStatus: document.querySelector("#onlineStatus"),
  augmentTitle: document.querySelector("#augmentTitle"),
  activeAugments: document.querySelector("#activeAugments"),
  log: document.querySelector("#log"),
  augmentModal: document.querySelector("#augmentModal"),
  augmentOptions: document.querySelector("#augmentOptions"),
  augmentPickerTitle: document.querySelector("#augmentModal h2"),
  augmentPickerText: document.querySelector("#augmentModal p"),
  rewardModal: document.querySelector("#rewardModal"),
  rewardOptions: document.querySelector("#rewardOptions"),
  rewardTitle: document.querySelector("#rewardTitle"),
  rewardText: document.querySelector("#rewardText")
};

const network = window.NetworkMultiplayer.createNetworkAdapter({
  onStatus: message => {
    els.onlineStatus.textContent = message;
    addLog(`온라인: ${message}`);
    render();
  },
  onMessage: handleNetworkMessage,
  onRoom: room => {
    els.roomCode.value = room.roomId || "";
    render();
  }
});

els.startRoundBtn.addEventListener("click", () => runSynced(startRound));
els.drawBtn.addEventListener("click", () => runSynced(drawTile));
els.chiBtn.addEventListener("click", () => runSynced(declareChi));
els.ponBtn.addEventListener("click", () => runSynced(declarePon));
els.kanBtn.addEventListener("click", () => runSynced(declareKan));
els.riichiBtn.addEventListener("click", () => runSynced(declareRiichi));
els.ronBtn.addEventListener("click", () => runSynced(declareRon));
els.winBtn.addEventListener("click", () => runSynced(declareWin));
els.endRoundBtn.addEventListener("click", () => runSynced(() => endRound("수동 종료")));
els.connectBtn.addEventListener("click", () => connectOnlineServer());
els.createRoomBtn.addEventListener("click", () => network.createRoom(els.roomCode.value.trim()));
els.joinRoomBtn.addEventListener("click", () => network.joinRoom(els.roomCode.value.trim()));
els.leaveRoomBtn.addEventListener("click", () => network.leaveRoom());

loadSavedServerUrl();
render();
addLog("로컬 4인 멀티 프로토타입 준비 완료. 국 시작으로 흐름을 확인하세요.");

function loadSavedServerUrl() {
  els.serverUrl.value = localStorage.getItem("augmentedMahjongServerUrl") || "";
}

function connectOnlineServer() {
  const url = els.serverUrl.value.trim();
  localStorage.setItem("augmentedMahjongServerUrl", url);
  network.connect(url);
}

function createPlayers() {
  return winds.map((wind, index) => ({
    id: index,
    wind,
    name: `${wind}가`,
    score: defaultStartScore,
    hand: [],
    river: [],
    melds: [],
    isMenzen: true,
    riichi: false,
    kanCount: 0,
    clientId: "",
    augments: []
  }));
}

function startRound() {
  if (!canAdminControl()) return false;
  if (state.phase === "gameover") resetGame();
  if (!state.gameStarted) initializeGame();

  state.round += 1;
  state.turn = 0;
  state.phase = "augment";
  state.wall = shuffle(window.Mahjong.createWall());
  state.deadWall = state.wall.splice(-14);
  state.rinshanTiles = state.deadWall.slice(0, 4);
  state.doraIndicators = [state.deadWall[4]];
  state.currentPlayer = state.dealer;
  state.pickerPlayer = 0;
  state.rewardPlayer = 0;
  state.discardsRequired = 0;
  state.lastDiscard = null;
  state.drawnTile = null;
  state.drewFromRinshan = false;
  state.roundEndedBy = "";
  state.firstTurnDiscards = [];
  state.kanCount = 0;
  state.riichiCount = 0;

  state.players.forEach(player => {
    player.hand = [];
    player.river = [];
    player.melds = [];
    player.isMenzen = true;
    player.riichi = false;
    player.kanCount = 0;
    for (let i = 0; i < 13; i += 1) player.hand.push(drawFromWall());
    window.Mahjong.sortHand(player.hand);
  });

  offerAugmentsForCurrentPicker();
  addLog(`${getRoundLabel()} 시작. 친은 ${state.players[state.dealer].name}입니다.`);
  render();
}

function initializeGame() {
  state.gameStarted = true;
  state.gameMode = els.gameMode.value;
  state.startScore = Math.max(1000, Number(els.startScore.value) || defaultStartScore);
  state.roundWind = 0;
  state.handIndex = 0;
  state.honba = 0;
  state.gameEndedReason = "";
  state.dealer = window.RiichiRules.randomizeSeatWinds(state.players, winds, shuffle);
  assignOnlineSeats();
  state.players.forEach(player => {
    player.score = state.startScore;
    player.augments = [];
  });
  addLog(`${gameModes[state.gameMode].label} 시작. 시작 점수 ${state.startScore.toLocaleString("ko-KR")}점`);
  addLog(`자리 배정: ${state.players.map(player => `${player.name}${player.clientId ? `=${player.clientId}` : ""}`).join(", ")}`);
}

function resetGame() {
  state.phase = "ready";
  state.gameStarted = false;
  state.round = 0;
  state.turn = 0;
  state.wall = [];
  state.deadWall = [];
  state.doraIndicators = [];
  state.rinshanTiles = [];
  state.currentPlayer = 0;
  state.pickerPlayer = 0;
  state.rewardPlayer = 0;
  state.offeredAugments = [];
  state.offeredRewards = [];
  state.discardsRequired = 0;
  state.lastDiscard = null;
  state.drawnTile = null;
  state.drewFromRinshan = false;
  state.roundEndedBy = "";
  state.firstTurnDiscards = [];
  state.kanCount = 0;
  state.riichiCount = 0;
  state.gameEndedReason = "";
  state.players = createPlayers();
}

function assignOnlineSeats() {
  if (!isOnlineMode()) {
    state.players.forEach(player => {
      player.clientId = "";
    });
    return;
  }
  window.RiichiRules.assignClientsToPlayers(state.players, network.getClientRoster(), shuffle);
}

function offerAugmentsForCurrentPicker() {
  const player = state.players[state.pickerPlayer];
  state.offeredAugments = window.AugmentSystem.getOffer(player, 3, shuffle);
  els.augmentModal.classList.remove("hidden");
}

function chooseAugment(base) {
  if (!canChooseAugment()) return false;
  const player = state.players[state.pickerPlayer];
  player.augments.push({ ...base, tags: [...base.tags] });
  addLog(`${player.name}: ${base.name} 선택`);

  state.pickerPlayer += 1;
  if (state.pickerPlayer < state.players.length) {
    offerAugmentsForCurrentPicker();
  } else {
    state.phase = "playing";
    state.offeredAugments = [];
    els.augmentModal.classList.add("hidden");
    addLog("모든 플레이어가 증강을 선택했습니다. 동가부터 국을 진행합니다.");
  }
  render();
}

function drawTile() {
  if (!canControlActivePlayer()) return false;
  const player = activePlayer();
  if (state.wall.length === 0) {
    exhaustiveDraw();
    return;
  }

  state.turn += 1;
  state.lastDiscard = null;
  const tile = drawFromWall();
  state.drawnTile = tile;
  state.drewFromRinshan = false;
  player.hand.push(tile);
  state.discardsRequired = 1;
  trigger(player, "onDraw");
  window.Mahjong.sortHand(player.hand);
  addLog(`${player.name} ${state.turn}턴: ${tile.label} 뽑음`);

  if (player.river.length === 0 && window.Mahjong.countDistinctTerminalHonor(player.hand) >= 9) {
    abortiveDraw("구종구패");
    return;
  }

  if (state.turn >= maxTurnsPerRound) {
    exhaustiveDraw();
    return;
  }

  render();
}

function declareChi() {
  if (!canControlActivePlayer()) return false;
  const claim = getClaimInfo();
  if (!claim || !canCurrentPlayerChi()) return;

  const option = window.Mahjong.getChiOptions(claim.player.hand, claim.tile)[0];
  const taken = option.map(number => takeTileFromHand(claim.player, `${claim.tile.suit}-${number}`));
  takeLastDiscard();
  claim.player.melds.push({
    type: "chi",
    open: true,
    fromPlayer: claim.fromPlayer.id,
    tiles: [...taken, { ...claim.tile, claimed: true }]
  });
  claim.player.isMenzen = false;
  state.discardsRequired = 1;
  state.drawnTile = null;
  state.drewFromRinshan = false;
  trigger(claim.player, "onCall", claim.tile);
  addLog(`${claim.player.name}: ${claim.tile.label} 치`);
  render();
}

function declarePon() {
  const claim = getPonClaimInfo();
  if (!claim || !canControlSeat(claim.player.id)) return false;
  if (!claim || !window.Mahjong.canPon(claim.player.hand, claim.tile)) return;

  state.currentPlayer = claim.player.id;
  const taken = [
    takeTileFromHand(claim.player, claim.tile.code),
    takeTileFromHand(claim.player, claim.tile.code)
  ];
  takeLastDiscard();
  claim.player.melds.push({
    type: "pon",
    open: true,
    fromPlayer: claim.fromPlayer.id,
    tiles: [...taken, { ...claim.tile, claimed: true }]
  });
  claim.player.isMenzen = false;
  state.discardsRequired = 1;
  state.drawnTile = null;
  state.drewFromRinshan = false;
  trigger(claim.player, "onCall", claim.tile);
  addLog(`${claim.player.name}: ${claim.tile.label} 퐁`);
  render();
}

function declareKan() {
  if (!canControlActivePlayer()) return false;
  const player = activePlayer();
  const candidate = window.Mahjong.findKanCandidate(player.hand);
  if (!candidate || state.discardsRequired <= 0 || state.phase !== "playing") return;
  if (state.rinshanTiles.length === 0) {
    addLog("남은 영상패가 없어 깡할 수 없습니다.");
    return;
  }

  const kanTiles = [];
  player.hand = player.hand.filter(tile => {
    if (tile.code === candidate.code && kanTiles.length < 4) {
      kanTiles.push(tile);
      return false;
    }
    return true;
  });
  player.melds.push({ type: "kan", open: false, tiles: kanTiles });
  player.kanCount = (player.kanCount || 0) + 1;
  state.kanCount += 1;

  const rinshan = state.rinshanTiles.shift();
  state.drawnTile = rinshan;
  state.drewFromRinshan = true;
  player.hand.push(rinshan);
  revealNextDoraIndicator();
  window.Mahjong.sortHand(player.hand);
  state.discardsRequired = 1;
  trigger(player, "onKan", candidate);
  trigger(player, "onDraw", rinshan);
  addLog(`${player.name}: ${candidate.label} 깡, 영상패 ${rinshan.label} 뽑음`);
  if (window.RiichiRules.shouldAbortFourKans(state.players, state.kanCount)) {
    abortiveDraw("사개깡");
    return;
  }
  render();
}

function declareRiichi() {
  if (!canControlActivePlayer()) return false;
  const player = activePlayer();
  if (!canDeclareRiichi(player)) return;

  player.riichi = true;
  state.riichiCount += 1;
  addLog(`${player.name}: 리치 선언`);

  if (state.riichiCount >= 4) {
    abortiveDraw("사가 리치");
    return;
  }

  render();
}

function discardTile(index) {
  if (!canControlActivePlayer()) return false;
  const player = activePlayer();
  if (state.discardsRequired <= 0 || state.phase !== "playing") return;
  if (!canDiscardTile(player, index)) return false;

  const [tile] = player.hand.splice(index, 1);
  player.river.push(tile);
  if (player.river.length === 1) {
    state.firstTurnDiscards.push(tile);
  }
  state.lastDiscard = {
    tile,
    fromPlayer: state.currentPlayer
  };
  state.discardsRequired -= 1;
  trigger(player, "onDiscard", tile);
  cleanupExpiredAugments(player);
  addLog(`${player.name}: ${tile.label} 버림`);

  if (getRonClaimInfos().length >= 3) {
    abortiveDraw("삼가화");
    return;
  }

  if (window.RiichiRules.isFourWindFirstDiscard(state.firstTurnDiscards)) {
    abortiveDraw("사풍연타");
    return;
  }

  if (state.discardsRequired <= 0) {
    state.drawnTile = null;
    state.currentPlayer = (state.currentPlayer + 1) % state.players.length;
    if (state.wall.length === 0) {
      exhaustiveDraw();
      return;
    }
  }

  render();
}

function declareRon() {
  const claim = getRonClaimInfoForControl();
  if (!claim) return false;

  const doraCount = countPlayerDora(claim.player) + window.Mahjong.countDora([claim.tile], state.doraIndicators);
  const result = window.Scoring.calculateWin({
    player: claim.player,
    state,
    doraCount,
    rinshan: false,
    tsumo: false
  });
  payRon(claim.player, claim.fromPlayer, result.total);
  addLog(`${claim.player.name}: ${claim.tile.label} 론 / ${result.label} ${result.yaku.join(", ") || "역 없음"} / ${result.total.toLocaleString("ko-KR")}점`);
  trigger(claim.player, "onWin", claim.tile);
  endRound(`${claim.player.name} 론`, true, { type: "win", winner: claim.player.id });
}

function declareWin() {
  if (!canControlActivePlayer()) return false;
  const player = activePlayer();
  if (!window.Mahjong.isWinningHand(player.hand)) {
    addLog(`${player.name}: 아직 화료 형태가 아닙니다.`);
    return;
  }

  const doraCount = countPlayerDora(player);
  const result = window.Scoring.calculateWin({
    player,
    state,
    doraCount,
    rinshan: state.drewFromRinshan,
    tsumo: true
  });
  payWin(player, result.total);
  addLog(`${player.name}: ${result.label} ${result.yaku.join(", ") || "역 없음"} / ${result.total.toLocaleString("ko-KR")}점`);
  trigger(player, "onWin");
  endRound(`${player.name} 화료`, true, { type: "win", winner: player.id });
}

function abortiveDraw(reason) {
  addLog(`도중유국: ${reason}`);
  endRound(`도중유국: ${reason}`, true, { type: "abortive", reason });
}

function exhaustiveDraw() {
  const tenpaiPlayers = state.players.filter(player => window.Mahjong.isTenpai(player.hand));
  const notenPlayers = state.players.filter(player => !window.Mahjong.isTenpai(player.hand));

  if (tenpaiPlayers.length > 0 && notenPlayers.length > 0) {
    tenpaiPlayers.forEach(tenpai => {
      notenPlayers.forEach(noten => {
        addScore(tenpai, 1000, "텐파이 유국");
        addScore(noten, -1000, "노텐 벌점");
      });
    });
  }

  const tenpaiNames = tenpaiPlayers.map(player => player.name).join(", ") || "없음";
  addLog(`유국 텐파이: ${tenpaiNames}`);
  endRound("유국: 패산 소진", true, {
    type: "draw",
    dealerTenpai: tenpaiPlayers.some(player => player.id === state.dealer)
  });
}

function endRound(reason, force = false, outcome = { type: "manual" }) {
  if (!force && !canAdminControl()) return false;
  if (state.phase !== "playing" && state.phase !== "ended") return;
  state.phase = "ended";
  state.roundEndedBy = reason;
  state.players.forEach(player => {
    trigger(player, "onRoundEnd");
    applySynergyBonuses(player);
    cleanupExpiredAugments(player, true);
  });
  state.discardsRequired = 0;
  state.lastDiscard = null;
  state.drawnTile = null;
  state.drewFromRinshan = false;
  addLog(`${state.round}국 종료: ${reason}`);
  settleRound(outcome);
  if (state.phase === "gameover") {
    render();
    return;
  }
  startRewards();
  render();
}

function startRewards() {
  state.phase = "reward";
  state.rewardPlayer = 0;
  offerRewardForCurrentPlayer();
}

function offerRewardForCurrentPlayer() {
  const player = state.players[state.rewardPlayer];
  state.offeredRewards = window.AugmentSystem.getOffer(player, 3, shuffle);
  els.rewardModal.classList.remove("hidden");
}

function chooseReward(base) {
  if (!canChooseReward()) return false;
  const player = state.players[state.rewardPlayer];
  player.augments.push({ ...base, tags: [...base.tags] });
  addLog(`${player.name}: 국 보상으로 ${base.name} 획득`);

  state.rewardPlayer += 1;
  if (state.rewardPlayer < state.players.length) {
    offerRewardForCurrentPlayer();
  } else {
    state.offeredRewards = [];
    state.phase = "ended";
    els.rewardModal.classList.add("hidden");
    addLog("모든 국 보상을 선택했습니다. 다음 국을 시작할 수 있습니다.");
  }
  render();
}

function trigger(player, hook, tile = null) {
  const ctx = {
    player,
    wall: state.wall,
    deadWall: state.deadWall,
    doraIndicators: state.doraIndicators,
    drawnTile: state.drawnTile,
    drewFromRinshan: state.drewFromRinshan,
    drawFromWall,
    requireExtraDiscard: () => {
      state.discardsRequired += 1;
    },
    log: addLog,
    addScore: (amount, source) => addScore(player, amount, source)
  };

  player.augments.forEach(augment => {
    if (typeof augment[hook] === "function") augment[hook](ctx, tile, augment);
  });
}

function revealNextDoraIndicator() {
  const nextIndex = 4 + state.doraIndicators.length;
  if (state.deadWall[nextIndex]) {
    state.doraIndicators.push(state.deadWall[nextIndex]);
    addLog(`새 도라 표시패: ${state.deadWall[nextIndex].label}`);
  }
}

function countPlayerDora(player) {
  const meldTiles = player.melds.flatMap(meld => meld.tiles);
  return window.Mahjong.countDora([...player.hand, ...meldTiles], state.doraIndicators);
}

function canDeclareRiichi(player) {
  return window.RiichiRules.canDeclareRiichi(player, state.phase, state.discardsRequired);
}

function canDiscardTile(player, index) {
  return window.RiichiRules.canDiscardTile(player, index);
}

function getRonClaimInfos() {
  return window.RiichiRules.getRonClaimInfos(state.players, state.lastDiscard);
}

function getRonClaimInfoForControl() {
  return getRonClaimInfos().find(claim => canControlSeat(claim.player.id)) || null;
}

function payWin(winner, value) {
  const payment = Math.ceil(value / 3);
  state.players.forEach(player => {
    if (player.id === winner.id) {
      addScore(player, payment * 3, "화료");
    } else {
      addScore(player, -payment, `${winner.name}에게 방총/지불`);
    }
  });
}

function payRon(winner, discarder, value) {
  addScore(winner, value, "론");
  addScore(discarder, -value, `${winner.name}에게 방총`);
}

function settleRound(outcome) {
  if (checkTobi()) return;

  if (outcome.type === "abortive") {
    state.honba += 1;
    addLog(`도중유국 연장: ${state.honba}본장`);
    return;
  }

  const dealerContinues =
    (outcome.type === "win" && outcome.winner === state.dealer) ||
    (outcome.type === "draw" && outcome.dealerTenpai);

  if (outcome.type === "draw") {
    state.honba += 1;
  } else if (outcome.type === "win" && outcome.winner === state.dealer) {
    state.honba += 1;
  }

  if (dealerContinues) {
    addLog(`친 연장: ${state.players[state.dealer].name} ${state.honba}본장`);
    return;
  }

  if (isOorasu()) {
    finishGame("오라스 종료");
    return;
  }

  advanceHand({ keepHonba: outcome.type === "draw" });
}

function advanceHand({ keepHonba = false } = {}) {
  state.dealer = (state.dealer + 1) % state.players.length;
  window.RiichiRules.applySeatWinds(state.players, winds, state.dealer);
  state.handIndex += 1;
  if (!keepHonba) state.honba = 0;

  if (state.handIndex >= 4) {
    state.handIndex = 0;
    state.roundWind += 1;
  }

  if (state.roundWind > gameModes[state.gameMode].endWind) {
    finishGame(`${gameModes[state.gameMode].label} 종료`);
  }
}

function checkTobi() {
  const busted = state.players.find(player => player.score < 0);
  if (!busted) return false;
  finishGame(`들통: ${busted.name} 점수 0점 미만`);
  return true;
}

function finishGame(reason) {
  state.phase = "gameover";
  state.gameEndedReason = reason;
  state.roundEndedBy = reason;
  state.offeredAugments = [];
  state.offeredRewards = [];
  els.augmentModal.classList.add("hidden");
  els.rewardModal.classList.add("hidden");
  addLog(`게임 종료: ${reason}`);
}

function isOorasu() {
  return state.roundWind === gameModes[state.gameMode].endWind && state.handIndex === 3;
}

function getRoundLabel() {
  const oorasu = isOorasu() ? " 오라스" : "";
  return `${winds[state.roundWind]}${state.handIndex + 1}국 ${state.honba}본장${oorasu}`;
}

function getClaimInfo() {
  if (!state.lastDiscard || state.discardsRequired > 0 || state.phase !== "playing") return null;
  return {
    tile: state.lastDiscard.tile,
    fromPlayer: state.players[state.lastDiscard.fromPlayer],
    player: activePlayer()
  };
}

function getPonClaimInfo() {
  if (!state.lastDiscard || state.discardsRequired > 0 || state.phase !== "playing") return null;
  for (let offset = 1; offset < state.players.length; offset += 1) {
    const index = (state.lastDiscard.fromPlayer + offset) % state.players.length;
    const player = state.players[index];
    if (window.Mahjong.canPon(player.hand, state.lastDiscard.tile)) {
      return {
        tile: state.lastDiscard.tile,
        fromPlayer: state.players[state.lastDiscard.fromPlayer],
        player
      };
    }
  }
  return null;
}

function canCurrentPlayerChi() {
  const claim = getClaimInfo();
  if (!claim) return false;
  const nextPlayer = (claim.fromPlayer.id + 1) % state.players.length;
  return state.currentPlayer === nextPlayer && window.Mahjong.canChi(claim.player.hand, claim.tile);
}

function takeLastDiscard() {
  const fromPlayer = state.players[state.lastDiscard.fromPlayer];
  fromPlayer.river.pop();
  state.lastDiscard = null;
}

function takeTileFromHand(player, code) {
  const index = player.hand.findIndex(tile => tile.code === code);
  return player.hand.splice(index, 1)[0];
}

function applySynergyBonuses(player) {
  window.AugmentSystem.getSynergyBonuses(player).forEach(bonus => {
    addScore(player, bonus.score, `${bonus.tag} 시너지 ${bonus.count}`);
  });
}

function cleanupExpiredAugments(player, roundEnded = false) {
  player.augments = player.augments.filter(augment => {
    if (roundEnded && augment.scope === "round") return false;
    if (augment.scope === "tile" && augment.charges <= 0) return false;
    return true;
  });
}

function addScore(player, amount, source) {
  player.score += amount;
  addLog(`${player.name}: ${source} 효과로 ${amount}점 획득`);
}

function drawFromWall() {
  return state.wall.pop();
}

function activePlayer() {
  return state.players[state.currentPlayer];
}

function isOnlineMode() {
  return network.isConnected() && network.isInRoom();
}

function canControlSeat(seatIndex) {
  if (!isOnlineMode()) return true;
  const player = state.players[seatIndex];
  return Boolean(player && player.clientId && player.clientId === network.getClientId());
}

function canAdminControl() {
  return !isOnlineMode() || network.isHost();
}

function canControlActivePlayer() {
  return canControlSeat(state.currentPlayer);
}

function canChooseAugment() {
  return canControlSeat(state.pickerPlayer);
}

function canChooseReward() {
  return canControlSeat(state.rewardPlayer);
}

function getMyPlayerLabel() {
  if (!isOnlineMode()) return "로컬";
  const player = state.players.find(player => player.clientId === network.getClientId());
  return player ? player.name : "관전자";
}

function canViewPlayerHand(player) {
  if (!isOnlineMode()) return true;
  return Boolean(player.clientId && player.clientId === network.getClientId());
}

function shuffle(items) {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function render() {
  const phaseLabels = {
    ready: "대기",
    augment: "증강 선택",
    playing: "국 진행",
    reward: "국 보상",
    ended: "국 종료",
    gameover: "게임 종료"
  };
  const player = activePlayer();

  els.phaseBadge.textContent = phaseLabels[state.phase];
  els.roundNumber.textContent = state.gameStarted ? getRoundLabel() : "시작 전";
  els.turnNumber.textContent = state.turn;
  els.wallCount.textContent = state.wall.length;
  els.score.textContent = `${player.name} ${player.score.toLocaleString("ko-KR")}`;

  els.gameMode.disabled = state.gameStarted && state.phase !== "gameover";
  els.startScore.disabled = state.gameStarted && state.phase !== "gameover";
  els.startRoundBtn.disabled = state.phase === "augment" || state.phase === "playing" || state.phase === "reward" || !canAdminControl();
  els.startRoundBtn.textContent = state.phase === "gameover" ? "새 게임" : "국 시작";
  els.createRoomBtn.disabled = !network.isConnected();
  els.joinRoomBtn.disabled = !network.isConnected();
  els.leaveRoomBtn.disabled = !network.isConnected() || !network.isInRoom();
  els.drawBtn.disabled = state.phase !== "playing" || state.discardsRequired > 0 || !canControlActivePlayer();
  els.chiBtn.disabled = !canCurrentPlayerChi() || !canControlActivePlayer();
  const ponClaim = getPonClaimInfo();
  const ronClaim = getRonClaimInfoForControl();
  els.ponBtn.disabled = !ponClaim || !canControlSeat(ponClaim.player.id);
  els.ponBtn.textContent = ponClaim ? `${ponClaim.player.name} 퐁` : "퐁";
  els.kanBtn.disabled = state.phase !== "playing" || state.discardsRequired <= 0 || !canControlActivePlayer() || !window.Mahjong.findKanCandidate(player.hand) || state.rinshanTiles.length === 0;
  els.riichiBtn.disabled = !canDeclareRiichi(player) || !canControlActivePlayer();
  els.ronBtn.disabled = !ronClaim;
  els.ronBtn.textContent = ronClaim ? `${ronClaim.player.name} 론` : "론";
  els.winBtn.disabled = state.phase !== "playing" || state.discardsRequired <= 0 || !canControlActivePlayer() || !window.Mahjong.isWinningHand(player.hand);
  els.endRoundBtn.disabled = state.phase !== "playing" || !canAdminControl();
  setOptionalButtonVisible(els.chiBtn, !els.chiBtn.disabled);
  setOptionalButtonVisible(els.ponBtn, !els.ponBtn.disabled);
  setOptionalButtonVisible(els.kanBtn, !els.kanBtn.disabled);
  setOptionalButtonVisible(els.riichiBtn, !els.riichiBtn.disabled);
  setOptionalButtonVisible(els.ronBtn, !els.ronBtn.disabled);
  setOptionalButtonVisible(els.winBtn, !els.winBtn.disabled);
  els.drawBtn.textContent = `${player.name} 패 뽑기`;
  els.handTitle.textContent = `${player.name} 손패`;
  els.augmentTitle.textContent = `${player.name} 증강`;
  els.handHint.textContent = makeHandHint();

  renderPlayers();
  renderDoraIndicators();
  renderHand();
  renderMelds(player);
  renderRiver();
  renderAugments();
  renderAugmentOptions();
  renderRewardOptions();
}

function makeHandHint() {
  if (state.phase === "augment") return `${state.players[state.pickerPlayer].name}가 증강을 선택 중입니다.`;
  if (state.phase === "reward") return `${state.players[state.rewardPlayer].name}가 국 보상을 선택 중입니다.`;
  if (state.phase === "ready") return "국 시작 버튼을 눌러 4인 로컬 멀티를 시작하세요.";
  if (state.phase === "gameover") return state.gameEndedReason || "게임이 종료되었습니다.";
  if (state.phase === "ended") return state.roundEndedBy || "다음 국을 시작하거나 점수를 확인하세요.";
  if (isOnlineMode() && !canControlActivePlayer()) return `${activePlayer().name} 차례입니다. 내 좌석은 ${getMyPlayerLabel()}입니다.`;
  if (getClaimInfo() || getPonClaimInfo()) return "직전 버림패를 치/퐁으로 받을 수 있습니다. 받지 않으려면 현재 차례 플레이어가 패를 뽑으세요.";
  if (state.discardsRequired > 0) return `${activePlayer().name}: 화료/깡 가능 여부를 확인한 뒤 버릴 패 ${state.discardsRequired}장을 선택하세요.`;
  return `${activePlayer().name} 차례입니다. 패를 뽑으세요.`;
}

function renderPlayers() {
  els.players.innerHTML = "";
  state.players.forEach((player, index) => {
    const card = document.createElement("article");
    card.className = `player-card${index === state.currentPlayer ? " active" : ""}${index === state.dealer ? " dealer" : ""}`;
    const synergies = window.AugmentSystem.getSynergyBonuses(player).map(bonus => bonus.tag).join(", ") || "-";
    card.innerHTML = `
      <div class="player-top">
        <span class="player-name">${player.name}</span>
        <span class="player-wind">${index === state.dealer ? "친" : player.wind}</span>
      </div>
      <div class="player-meta">
        <span>점수<strong>${player.score.toLocaleString("ko-KR")}</strong></span>
        <span>손패<strong>${player.hand.length}</strong></span>
        ${player.riichi ? "<span>리치<strong>선언</strong></span>" : ""}
      </div>
    `;
    els.players.appendChild(card);
  });
}

function renderDoraIndicators() {
  els.doraIndicators.innerHTML = "";
  state.doraIndicators.forEach(tile => els.doraIndicators.appendChild(createTileElement(tile)));
}

function renderHand() {
  const player = activePlayer();
  els.hand.innerHTML = "";
  if (!canViewPlayerHand(player)) {
    player.hand.forEach(() => {
      const back = document.createElement("div");
      back.className = "tile tile-back";
      back.textContent = "";
      els.hand.appendChild(back);
    });
    return;
  }

  player.hand.forEach((tile, index) => {
    const button = document.createElement("button");
    const canDiscard = state.discardsRequired > 0 && canControlActivePlayer() && canDiscardTile(player, index);
    button.className = getTileClass(tile, canDiscard);
    button.textContent = tile.label;
    button.disabled = !canDiscard;
    button.addEventListener("click", () => runSynced(() => discardTile(index)));
    els.hand.appendChild(button);
  });
}

function renderMelds(player) {
  const existing = document.querySelector("#melds");
  if (existing) existing.remove();

  const melds = document.createElement("div");
  melds.id = "melds";
  melds.className = "melds";
  player.melds.forEach(meld => {
    const wrapper = document.createElement("div");
    wrapper.className = "meld";

    const label = document.createElement("span");
    label.className = "meld-label";
    label.textContent = `${meld.type.toUpperCase()}${meld.open ? "" : " 암"}`;
    wrapper.appendChild(label);

    meld.tiles.forEach(tile => wrapper.appendChild(createTileElement(tile, tile.claimed ? "claimed" : "")));
    melds.appendChild(wrapper);
  });

  els.hand.after(melds);
}

function renderRiver() {
  els.river.innerHTML = "";
  state.players.forEach(player => {
    const group = document.createElement("div");
    group.className = "river-group";

    const label = document.createElement("span");
    label.className = "river-label";
    label.textContent = player.name;
    group.appendChild(label);

    player.river.forEach(tile => {
      const div = document.createElement("div");
      div.className = getTileClass(tile);
      div.textContent = tile.label;
      group.appendChild(div);
    });

    els.river.appendChild(group);
  });
}

function createTileElement(tile, extraClass = "") {
  const div = document.createElement("div");
  div.className = getTileClass(tile, false, extraClass);
  div.textContent = tile.label;
  return div;
}

function getTileClass(tile, selectable = false, extraClass = "") {
  const doraCodes = window.Mahjong.getDoraTiles(state.doraIndicators).map(dora => dora.code);
  return `tile ${tile.suit}${tile.bonus ? " bonus" : ""}${doraCodes.includes(tile.code) ? " dora" : ""}${selectable ? " selectable" : ""}${extraClass ? ` ${extraClass}` : ""}`;
}

function renderAugments() {
  const player = activePlayer();
  els.activeAugments.innerHTML = "";
  if (player.augments.length === 0) {
    els.activeAugments.className = "augment-list empty";
    els.activeAugments.textContent = "아직 선택한 증강이 없습니다.";
    return;
  }

  els.activeAugments.className = "augment-list";
  player.augments.forEach(augment => els.activeAugments.appendChild(createAugmentCard(augment)));
}

function renderAugmentOptions() {
  els.augmentOptions.innerHTML = "";
  if (state.phase === "augment") {
    const player = state.players[state.pickerPlayer];
    els.augmentPickerTitle.textContent = `${player.name} 증강 선택`;
    els.augmentPickerText.textContent = "이번 국에 적용할 특수 규칙을 하나 고르세요.";
  }

  state.offeredAugments.forEach(augment => {
    const card = createAugmentCard(augment);
    const button = document.createElement("button");
    button.textContent = "선택";
    button.disabled = !canChooseAugment();
    button.addEventListener("click", () => runSynced(() => chooseAugment(augment)));
    card.appendChild(button);
    els.augmentOptions.appendChild(card);
  });
}

function renderRewardOptions() {
  els.rewardOptions.innerHTML = "";
  if (state.phase === "reward") {
    const player = state.players[state.rewardPlayer];
    els.rewardTitle.textContent = `${player.name} 국 보상`;
    els.rewardText.textContent = "게임 동안 유지할 증강 또는 다음 국에 쓸 증강을 고르세요.";
  }

  state.offeredRewards.forEach(augment => {
    const card = createAugmentCard(augment);
    const button = document.createElement("button");
    button.textContent = "보상 선택";
    button.disabled = !canChooseReward();
    button.addEventListener("click", () => runSynced(() => chooseReward(augment)));
    card.appendChild(button);
    els.rewardOptions.appendChild(card);
  });
}

function createAugmentCard(augment) {
  const card = document.createElement("article");
  card.className = `augment-card rarity-${augment.rarity}`;

  const title = document.createElement("div");
  title.className = "augment-title";
  title.innerHTML = `<span>${augment.name}</span><span class="augment-duration">${window.AugmentSystem.rarityLabel[augment.rarity]} · ${augment.duration}</span>`;

  const tags = document.createElement("div");
  tags.className = "augment-tags";
  augment.tags.forEach(tag => {
    const span = document.createElement("span");
    span.className = "tag";
    span.textContent = tag;
    tags.appendChild(span);
  });

  const description = document.createElement("p");
  description.textContent = augment.description;

  card.append(title, tags, description);
  return card;
}

function addLog(message) {
  const div = document.createElement("div");
  div.className = "log-entry";
  div.textContent = message;
  els.log.prepend(div);
}

function setOptionalButtonVisible(button, visible) {
  button.classList.toggle("hidden", !visible);
}

function runSynced(action) {
  const result = action();
  if (result === false) return;
  sendSnapshot();
}

function handleNetworkMessage(message) {
  if (message.type !== "snapshot") {
    addLog(`서버 메시지: ${message.type || "unknown"}`);
    return;
  }

  applySnapshot(message.payload);
  addLog("온라인: 다른 화면의 게임 상태를 동기화했습니다.");
  render();
}

function sendSnapshot() {
  if (!isOnlineMode()) return;
  network.send("snapshot", createSnapshot());
}

function createSnapshot() {
  return {
    phase: state.phase,
    round: state.round,
    turn: state.turn,
    gameStarted: state.gameStarted,
    gameMode: state.gameMode,
    startScore: state.startScore,
    roundWind: state.roundWind,
    handIndex: state.handIndex,
    dealer: state.dealer,
    honba: state.honba,
    gameEndedReason: state.gameEndedReason,
    wall: state.wall,
    deadWall: state.deadWall,
    doraIndicators: state.doraIndicators,
    rinshanTiles: state.rinshanTiles,
    players: state.players.map(serializePlayer),
    currentPlayer: state.currentPlayer,
    pickerPlayer: state.pickerPlayer,
    rewardPlayer: state.rewardPlayer,
    offeredAugments: state.offeredAugments.map(serializeAugment),
    offeredRewards: state.offeredRewards.map(serializeAugment),
    discardsRequired: state.discardsRequired,
    lastDiscard: state.lastDiscard,
    drawnTile: state.drawnTile,
    drewFromRinshan: state.drewFromRinshan,
    roundEndedBy: state.roundEndedBy,
    firstTurnDiscards: state.firstTurnDiscards,
    kanCount: state.kanCount,
    riichiCount: state.riichiCount
  };
}

function applySnapshot(snapshot) {
  state.phase = snapshot.phase;
  state.round = snapshot.round;
  state.turn = snapshot.turn;
  state.gameStarted = Boolean(snapshot.gameStarted);
  state.gameMode = snapshot.gameMode || "hanchan";
  state.startScore = snapshot.startScore || defaultStartScore;
  state.roundWind = snapshot.roundWind || 0;
  state.handIndex = snapshot.handIndex || 0;
  state.dealer = snapshot.dealer || 0;
  state.honba = snapshot.honba || 0;
  state.gameEndedReason = snapshot.gameEndedReason || "";
  els.gameMode.value = state.gameMode;
  els.startScore.value = state.startScore;
  state.wall = snapshot.wall || [];
  state.deadWall = snapshot.deadWall || [];
  state.doraIndicators = snapshot.doraIndicators || [];
  state.rinshanTiles = snapshot.rinshanTiles || [];
  state.players = (snapshot.players || []).map(hydratePlayer);
  state.currentPlayer = snapshot.currentPlayer || 0;
  state.pickerPlayer = snapshot.pickerPlayer || 0;
  state.rewardPlayer = snapshot.rewardPlayer || 0;
  state.offeredAugments = (snapshot.offeredAugments || []).map(window.AugmentSystem.hydrateAugment);
  state.offeredRewards = (snapshot.offeredRewards || []).map(window.AugmentSystem.hydrateAugment);
  state.discardsRequired = snapshot.discardsRequired || 0;
  state.lastDiscard = snapshot.lastDiscard || null;
  state.drawnTile = snapshot.drawnTile || null;
  state.drewFromRinshan = Boolean(snapshot.drewFromRinshan);
  state.roundEndedBy = snapshot.roundEndedBy || "";
  state.firstTurnDiscards = snapshot.firstTurnDiscards || [];
  state.kanCount = snapshot.kanCount || 0;
  state.riichiCount = snapshot.riichiCount || 0;

  els.augmentModal.classList.toggle("hidden", state.phase !== "augment");
  els.rewardModal.classList.toggle("hidden", state.phase !== "reward");
}

function serializePlayer(player) {
  return {
    ...player,
    augments: player.augments.map(serializeAugment)
  };
}

function hydratePlayer(player) {
  return {
    ...player,
    riichi: Boolean(player.riichi),
    kanCount: player.kanCount || 0,
    clientId: player.clientId || "",
    augments: (player.augments || []).map(window.AugmentSystem.hydrateAugment)
  };
}

function serializeAugment(augment) {
  return {
    id: augment.id,
    charges: augment.charges,
    scope: augment.scope,
    rarity: augment.rarity,
    tags: augment.tags
  };
}
