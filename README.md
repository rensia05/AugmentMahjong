# Augmented Riichi Mahjong

HTML/CSS/JS 기반 증강 리치 마작 프로토타입입니다. `server.js`가 정적 파일과 WebSocket 멀티플레이를 같이 제공합니다.

## 로컬 실행

```bash
npm start
```

브라우저에서 `http://localhost:8080`을 열고, 온라인 멀티 입력칸을 비운 상태로 `연결`을 누르면 현재 서버에 접속합니다.

## 온라인 방

서버는 게임을 직접 진행하지 않고 방 생성, 참가, 방 안의 WebSocket 중계만 담당합니다.

1. `연결`을 눌러 서버에 접속합니다.
2. 방장은 `방 만들기`를 누릅니다. 방 코드가 자동 생성되어 입력칸에 표시됩니다.
3. 다른 플레이어는 같은 서버에 접속한 뒤 방 코드를 입력하고 `방 참가`를 누릅니다.
4. 방 안 플레이어끼리만 로스터, 좌석 배정, 게임 상태가 공유됩니다.
5. 방장이 나가면 방 안에 남은 다음 플레이어가 새 방장이 됩니다.

## 실제 호스팅

Node.js 18 이상을 지원하는 호스팅 서비스에 `outputs` 폴더를 배포하면 됩니다.

필수 실행 명령:

```bash
npm start
```

환경변수:

```bash
PORT=8080
HOST=0.0.0.0
```

대부분의 호스팅 서비스는 `PORT`를 자동으로 넣어줍니다. HTTPS 환경에서는 클라이언트가 자동으로 `wss://현재도메인`으로 연결합니다.

헬스체크:

```text
/healthz
```

## GitHub Pages + 별도 서버

GitHub Pages는 HTML/CSS/브라우저 JS만 실행할 수 있고, Node 서버는 실행할 수 없습니다. 그래서 웹 화면은 GitHub Pages에 올리고, WebSocket 서버만 Node 호스팅에 올리는 방식으로 사용할 수 있습니다.

GitHub Pages에 올릴 정적 파일:

```text
index.html
style.css
mahjong.js
scoring.js
rules.js
augments.js
augment-presets.js
custom-augments.js
network.js
script.js
```

Node 호스팅에 올릴 서버 파일:

```text
index.js
server.js
package.json
Procfile
```

사용 방법:

1. Node 호스팅에서 서버를 실행합니다.
2. 호스팅 사이트가 발급한 주소를 확인합니다. 예: `https://my-mahjong-server.example.com`
3. GitHub Pages 사이트를 엽니다.
4. 온라인 멀티의 서버 주소에 Node 서버 주소를 입력합니다.
5. `연결`을 누릅니다.

서버 주소는 `https://...`로 입력해도 클라이언트가 자동으로 `wss://...`로 변환합니다. 직접 `wss://...`를 입력해도 됩니다.

## 증강 커스텀

커스텀 증강은 `custom-augments.js`에 추가하세요. 기본 증강은 `augment-presets.js`, 증강 시스템 코어는 `augments.js`에 있습니다.

간단한 증강은 `createCustomAugment`와 `effects`만으로 만들 수 있습니다.

```js
createCustomAugment({
  id: "custom_man_bonus",
  name: "만수 보너스",
  duration: "한 국",
  scope: "round",
  rarity: "common",
  tags: ["점수", "만"],
  description: "만수를 버릴 때마다 100점을 얻습니다.",
  effects: [{ type: "score_on_discard_suit", suit: "man", score: 100 }]
});
```

복잡한 증강은 `registerAugment`로 `onDraw`, `onDiscard`, `onRoundEnd`, `onWin`, `onKan`, `onCall` 훅을 직접 작성하면 됩니다.

`onDiscard(ctx, tile)`에서는 버린 자리 정보를 바로 사용할 수 있습니다.

```js
onDiscard(ctx, tile) {
  if (ctx.seatWind === "동") ctx.addScore(80, "동가 버림 보너스");
  if (ctx.isDiscardedFrom("남")) ctx.addScore(80, "남가 버림 보너스");
}
```

모두에게 적용되는 공통 특수 규칙은 `registerGlobalRule`로 추가합니다. 공통 규칙은 게임 시작 때 선택되고, 동장/남장처럼 게임 라운드를 추가할 수 있습니다.
기본 후보에는 `없음`도 포함되어 있어서, 공통 특수 규칙 없이 게임이 시작될 수도 있습니다.

```js
window.AugmentSystem.registerGlobalRule({
  id: "global_example",
  name: "공통 규칙 예시",
  description: "모두에게 적용되는 규칙입니다.",
  dragonWindLabels: ["백", "발", "중"],
  extraRoundWinds: ["백", "중", "발"]
});
```

공통 규칙으로 풍패 취급이 바뀐 경우 커스텀 증강에서는 `ctx.isWindTile(tile)`을 쓰면 됩니다.
