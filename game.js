(() => {
  'use strict';

  /**
   * モバイルブラウザ (特に iOS Safari) では 100vh が下部ツールバー領域も含んだ
   * 値を返してしまい、タッチボタンがツールバーの裏に隠れてしまう。
   * visualViewport.height を毎回計測して --app-height に反映することで、
   * dvh 非対応の旧バージョンでもボタンを必ず可視領域内に収める。
   * @returns {void}
   */
  const updateAppHeight = () => {
    const vv = window.visualViewport;
    const h = vv ? vv.height : window.innerHeight;
    document.documentElement.style.setProperty('--app-height', `${h}px`);
  };
  updateAppHeight();
  window.addEventListener('resize', updateAppHeight, { passive: true });
  window.addEventListener('orientationchange', updateAppHeight, { passive: true });
  if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', updateAppHeight, { passive: true });
    window.visualViewport.addEventListener('scroll', updateAppHeight, { passive: true });
  }

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d');
  const overlay = document.getElementById('overlay');
  const touchControls = document.getElementById('touchControls');
  const W = canvas.width;
  const H = canvas.height;

  const ASSET = './assets/';
  const CELL = 256;

  const stages = [
    {
      id: 'sky', name: '空中遺跡', label: 'Sky Ruins',
      img: 'stages/sky_ruins.png',
      desc: '標準ステージ。最も遊びやすい浮遊遺跡。',
      tint: 'rgba(50,180,255,.18)',
      friction: 0.84,
      gravity: 0.78,
      platforms: [
        { x: 235, y: 562, w: 810, h: 48, type: 'main' },
        { x: 236, y: 366, w: 232, h: 24, type: 'soft' },
        { x: 812, y: 366, w: 232, h: 24, type: 'soft' },
      ],
    },
    {
      id: 'volcano', name: '火山', label: 'Volcano',
      img: 'stages/volcano.png',
      desc: '火力高め。床が熱く、一定間隔で火柱が出る。',
      tint: 'rgba(255,80,20,.2)',
      friction: 0.83,
      gravity: 0.8,
      hazard: 'lava',
      platforms: [
        { x: 258, y: 570, w: 765, h: 48, type: 'main' },
        { x: 128, y: 348, w: 260, h: 24, type: 'soft' },
        { x: 895, y: 348, w: 260, h: 24, type: 'soft' },
      ],
    },
    {
      id: 'ice', name: '氷ステージ', label: 'Ice Crystal',
      img: 'stages/ice.png',
      desc: '滑りやすい。復帰と間合い管理が重要。',
      tint: 'rgba(110,220,255,.22)',
      friction: 0.94,
      gravity: 0.76,
      platforms: [
        { x: 242, y: 558, w: 795, h: 50, type: 'main' },
        { x: 168, y: 359, w: 248, h: 24, type: 'soft' },
        { x: 865, y: 359, w: 248, h: 24, type: 'soft' },
      ],
    },
    {
      id: 'city', name: '都市ステージ', label: 'Neo City',
      img: 'stages/city.png',
      desc: '横に広い。高速キャラと遠距離キャラが強い。',
      tint: 'rgba(165,70,255,.18)',
      friction: 0.86,
      gravity: 0.78,
      platforms: [
        { x: 226, y: 568, w: 830, h: 48, type: 'main' },
        { x: 260, y: 360, w: 248, h: 24, type: 'soft' },
        { x: 768, y: 360, w: 248, h: 24, type: 'soft' },
      ],
    },
  ];

  const fighters = [
    {
      id: 'sword', name: '蒼刃の剣士', short: '剣士', role: 'リーチ型',
      sheet: 'sprites/azure_blade_sheet.png', portrait: 'portraits/p1_portrait.png',
      color: '#29b7ff', accent: '#65e6ff',
      desc: '長い剣撃で先に触れる。初心者向けの万能型。',
      scale: 1.05, drawW: 180, drawH: 180,
      speed: 4.75, air: 0.78, jump: 15.6, jumps: 1, weight: 1.03,
      reach: 104, power: 8.8, knock: 1.02, cooldown: 25, specialCooldown: 52,
      projectile: false,
      bars: { reach: 92, power: 62, speed: 72, air: 64 },
    },
    {
      id: 'beast', name: '紅牙の獣王', short: '獣', role: '高火力',
      sheet: 'sprites/crimson_fang_sheet.png', portrait: 'portraits/p2_portrait.png',
      color: '#ff5a31', accent: '#ffce61',
      desc: '一撃が重い。足は遅いが吹っ飛ばし性能が高い。',
      scale: 1.18, drawW: 205, drawH: 205,
      speed: 3.45, air: 0.56, jump: 13.6, jumps: 1, weight: 1.35,
      reach: 76, power: 14.8, knock: 1.42, cooldown: 36, specialCooldown: 70,
      projectile: false,
      bars: { reach: 62, power: 98, speed: 43, air: 42 },
    },
    {
      id: 'martial', name: '翠嵐の格闘家', short: '格闘家', role: '空中機動',
      sheet: 'sprites/jade_gale_sheet.png', portrait: 'portraits/p3_portrait.png',
      color: '#31e879', accent: '#b9ff8c',
      desc: '速くて空中制御が強い。コンボと復帰が得意。',
      scale: 1.02, drawW: 178, drawH: 178,
      speed: 5.85, air: 1.18, jump: 17.8, jumps: 2, weight: 0.92,
      reach: 65, power: 7.6, knock: 0.92, cooldown: 19, specialCooldown: 44,
      projectile: false,
      bars: { reach: 50, power: 54, speed: 96, air: 98 },
    },
    {
      id: 'mage', name: '紫電の魔導士', short: '魔導士', role: '遠距離特化',
      sheet: 'sprites/violet_arcana_sheet.png', portrait: 'portraits/p4_portrait.png',
      color: '#b45cff', accent: '#f2b8ff',
      desc: '弾幕と設置魔法で戦う。近距離は弱め。',
      scale: 1.02, drawW: 188, drawH: 188,
      speed: 4.05, air: 0.78, jump: 15.2, jumps: 1, weight: 0.96,
      reach: 58, power: 6.2, knock: 0.92, cooldown: 24, specialCooldown: 34,
      projectile: true,
      bars: { reach: 44, power: 48, speed: 58, air: 62 },
    },
  ];

  const images = new Map();
  const spriteMeta = new Map();
  const keys = Object.create(null);
  const touch = { left: false, right: false, dash: false, jump: false, attack: false, guard: false, special: false };
  let state = 'loading';
  let selectedFighter = 0;
  let selectedStage = 0;
  let players = [];
  let particles = [];
  let projectiles = [];
  let effects = [];
  let cameraShake = 0;
  let lastTime = performance.now();
  let time = 0;
  let winner = null;
  let paused = false;
  let audioCtx = null;

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const sign = v => v < 0 ? -1 : 1;

  function img(path) { return images.get(path); }

  function loadImage(path) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => { images.set(path, image); resolve(image); };
      image.onerror = reject;
      image.src = ASSET + path;
    });
  }

  async function preload() {
    const paths = new Set();
    fighters.forEach(f => { paths.add(f.sheet); paths.add(f.portrait); });
    stages.forEach(s => paths.add(s.img));
    paths.add('battle_keyart.png');
    await Promise.all([...paths].map(loadImage));
    fighters.forEach(f => spriteMeta.set(f.sheet, analyzeSpriteSheet(img(f.sheet))));
    showTitle();
    requestAnimationFrame(loop);
  }

  function analyzeSpriteSheet(sheet) {
    if (!sheet) return null;
    const cols = 4, rows = 4;
    const cellW = Math.floor(sheet.width / cols);
    const cellH = Math.floor(sheet.height / rows);
    const cvs = document.createElement('canvas');
    cvs.width = sheet.width;
    cvs.height = sheet.height;
    const c = cvs.getContext('2d', { willReadFrequently: true });
    c.drawImage(sheet, 0, 0);
    const meta = { cellW, cellH, frames: [] };
    for (let r = 0; r < rows; r++) {
      const row = [];
      for (let col = 0; col < cols; col++) {
        const sx = col * cellW;
        const sy = r * cellH;
        const data = c.getImageData(sx, sy, cellW, cellH).data;
        let minX = cellW, minY = cellH, maxX = -1, maxY = -1;
        for (let y = 0; y < cellH; y++) {
          for (let x = 0; x < cellW; x++) {
            const a = data[(y * cellW + x) * 4 + 3];
            if (a > 10) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }
        if (maxX < minX || maxY < minY) {
          row.push({ sx, sy, sw: cellW, sh: cellH });
        } else {
          const pad = 2;
          minX = Math.max(0, minX - pad);
          minY = Math.max(0, minY - pad);
          maxX = Math.min(cellW - 1, maxX + pad);
          maxY = Math.min(cellH - 1, maxY + pad);
          row.push({
            sx: sx + minX,
            sy: sy + minY,
            sw: maxX - minX + 1,
            sh: maxY - minY + 1,
          });
        }
      }
      meta.frames.push(row);
    }
    return meta;
  }

  function ensureAudio() {
    if (!audioCtx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) audioCtx = new AC();
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  }

  function beep(type = 'hit') {
    if (!audioCtx) return;
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.connect(g); g.connect(audioCtx.destination);
    const now = audioCtx.currentTime;
    const table = {
      click: [520, .035, .035],
      jump: [420, .06, .05],
      attack: [180, .055, .06],
      hit: [90, .08, .08],
      ko: [70, .22, .14],
      win: [740, .28, .1],
      spell: [660, .12, .07],
    };
    const [freq, dur, vol] = table[type] || table.hit;
    o.type = type === 'spell' ? 'sine' : 'square';
    o.frequency.setValueAtTime(freq, now);
    if (type === 'ko') o.frequency.exponentialRampToValueAtTime(32, now + dur);
    if (type === 'win') o.frequency.exponentialRampToValueAtTime(1040, now + dur);
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.start(now); o.stop(now + dur + .02);
  }

  function setOverlay(html) { overlay.innerHTML = html; }
  function clearOverlay() { overlay.innerHTML = ''; }

  function showTitle() {
    state = 'title';
    paused = false;
    winner = null;
    setOverlay(`
      <section class="menu narrow">
        <h1 class="logo">Sky Clash<br><span>Arena</span></h1>
        <p class="sub">Image-genで作ったキャラ/ステージ素材を使った、スマブラ風2.5Dアクションゲーム完成版。キャラ選択、ステージ選択、技性能差、CPU戦、勝利演出まで入りです。</p>
        <div class="row">
          <button class="btn" data-action="character">ゲーム開始</button>
          <button class="btn secondary" data-action="howto">操作を見る</button>
        </div>
        <div class="help">
          <b style="color:#ffe49b">PC操作</b>: 移動 A/D・←/→　ダッシュ Shift　ジャンプ W/↑/Space　
          <b style="color:#7ad0ff">通常攻撃 J または X</b>　
          <b style="color:#9fe9ff">ガード L または ↓</b>　
          <b style="color:#bb8cff">必殺技 K または C</b>　ポーズ P　タイトル Esc<br>
          各ボタンの効果は <b>「操作を見る」</b> から早見表で確認できます。まずキャラを選び、次にステージを選ぶとバトル開始です。
        </div>
      </section>
    `);
  }

  /**
   * 操作早見表に表示する各アクションの定義。
   * PC キーボード割り当て / スマホタッチボタン / 効果説明 を
   * カードリスト形式でまとめて表示するためのデータソース。
   * @type {Array<{ accent: string, icon: string, name: string, keys: string[][], touch: string|null, desc: string }>}
   */
  const controlsGuide = [
    {
      accent: 'move',
      icon: '◀ ▶',
      name: '移動',
      keys: [['A', 'D'], ['←', '→']],
      touch: '◀ / ▶',
      desc: '左右に歩く。空中でも軌道を調整できる。<b>間合い管理が勝敗を分ける</b>。',
    },
    {
      accent: 'dash',
      icon: 'DASH',
      name: 'ダッシュ',
      keys: [['Shift']],
      touch: 'DASH',
      desc: '進行方向に高速移動。<b>接近・離脱・追撃</b>に。攻撃と組み合わせると強い。',
    },
    {
      accent: 'jump',
      icon: 'JUMP',
      name: 'ジャンプ',
      keys: [['W'], ['↑'], ['Space']],
      touch: 'JUMP',
      desc: 'ジャンプ。<b>翠嵐の格闘家のみ2段ジャンプ可</b>。空中での復帰や回避にも使う。',
    },
    {
      accent: 'attack',
      icon: 'ATTACK',
      name: '通常攻撃',
      keys: [['J'], ['X']],
      touch: 'ATTACK',
      desc: '基本攻撃。<b>連打でコンボ</b>になる。発生が早く、相手のガードを崩しに行く主力技。',
    },
    {
      accent: 'guard',
      icon: 'GUARD',
      name: 'ガード',
      keys: [['L'], ['↓']],
      touch: 'GUARD',
      desc: '構えて<b>被ダメージを大幅軽減</b>。仰け反りも無効。崩されないよう間合いを取って解除。',
    },
    {
      accent: 'special',
      icon: 'SKILL',
      name: '必殺技',
      keys: [['K'], ['C']],
      touch: 'SKILL',
      desc: 'キャラ固有の<b>強力な大技</b>。クールタイムが長い。剣士=突進斬り / 獣=咆哮 / 格闘家=回転蹴り / 魔導士=設置魔法。',
    },
    {
      accent: 'system',
      icon: 'PAUSE',
      name: 'ポーズ',
      keys: [['P']],
      touch: null,
      desc: '一時停止 / 再開。<b>戦況確認</b>や中断に使う。',
    },
    {
      accent: 'system',
      icon: 'RESTART',
      name: 'リスタート',
      keys: [['R']],
      touch: null,
      desc: 'バトル / 結果画面で押すと、<b>同条件で再戦</b>する。',
    },
    {
      accent: 'system',
      icon: 'TITLE',
      name: 'タイトルへ',
      keys: [['Esc']],
      touch: null,
      desc: 'いつでもタイトル画面に戻る。',
    },
  ];

  /**
   * 1 アクションぶんの操作カード HTML を生成する。
   * @param {{accent:string, icon:string, name:string, keys:string[][], touch:string|null, desc:string}} ctrl
   * @returns {string} カード HTML
   */
  function renderControlCard(ctrl) {
    const keysHtml = ctrl.keys
      .map(group => group.map(k => `<span class="kbd">${k}</span>`).join(''))
      .join('<span class="ctrl-or">/</span>');
    const touchHtml = ctrl.touch
      ? `<span class="ctrl-or" style="margin-left:6px">スマホ</span><span class="kbd" style="background:linear-gradient(180deg,rgba(37,215,255,.35),rgba(12,125,164,.25));border-color:rgba(37,215,255,.5)">${ctrl.touch}</span>`
      : `<span class="ctrl-or" style="margin-left:6px">PC専用</span>`;
    return `
      <div class="ctrl" data-accent="${ctrl.accent}">
        <div class="ctrl-icon">${ctrl.icon}</div>
        <div class="ctrl-body">
          <p class="ctrl-name">${ctrl.name}</p>
          <div class="ctrl-keys">${keysHtml}${touchHtml}</div>
          <p class="ctrl-desc">${ctrl.desc}</p>
        </div>
      </div>
    `;
  }

  function showHowTo() {
    const cardsHtml = controlsGuide.map(renderControlCard).join('');
    setOverlay(`
      <section class="menu">
        <h1 class="logo" style="font-size:52px">操作方法</h1>
        <p class="sub" style="margin:8px 0 6px">
          <b style="color:#ffe49b">攻撃には3種類</b>あります。PCキーボードとスマホタッチの両方で同じ動作になります。
          特に <b style="color:#7ad0ff">通常攻撃 (J/X)</b>・<b style="color:#bb8cff">必殺技 (K/C)</b>・<b style="color:#9fe9ff">ガード (L/↓)</b> の使い分けが攻略の鍵です。
        </p>
        <div class="controls-list">
          ${cardsHtml}
        </div>
        <div class="help" style="margin-top:14px">
          <b>勝利条件</b>: 相手を画面外へ吹っ飛ばしてストックを 0 にする。最後に残れば勝利。<br>
          <b>キャラ別の特徴</b>: 剣士=リーチ長 / 獣=高火力 / 格闘家=空中機動 / 魔導士=遠距離。<br>
          <b>ステージ</b>: 火山は火柱の発生、氷は滑りやすい床、空中遺跡は標準、都市は横に広い。
        </div>
        <div class="row" style="margin-top:16px">
          <button class="btn" data-action="character">キャラ選択へ</button>
          <button class="btn secondary" data-action="title">戻る</button>
        </div>
      </section>
    `);
  }

  function showCharacterSelect() {
    state = 'character';
    const cards = fighters.map((f, i) => `
      <article class="card ${i === selectedFighter ? 'selected' : ''}" data-fighter="${i}">
        <img src="${ASSET + f.portrait}" alt="${f.name}" />
        <h3>${f.name}</h3>
        <p>${f.role} / ${f.desc}</p>
        <div class="stats">
          <div class="stat"><span>リーチ</span><b class="bar"><i style="width:${f.bars.reach}%"></i></b></div>
          <div class="stat"><span>火力</span><b class="bar"><i style="width:${f.bars.power}%"></i></b></div>
          <div class="stat"><span>速度</span><b class="bar"><i style="width:${f.bars.speed}%"></i></b></div>
          <div class="stat"><span>空中</span><b class="bar"><i style="width:${f.bars.air}%"></i></b></div>
        </div>
      </article>
    `).join('');
    setOverlay(`
      <section class="menu">
        <h1 class="logo" style="font-size:52px">キャラクター選択</h1>
        <p class="sub">P1として使うキャラを選択してください。残り3体はCPUとして参戦します。</p>
        <div class="grid">${cards}</div>
        <div class="row" style="margin-top:18px">
          <button class="btn" data-action="stage">ステージ選択へ</button>
          <button class="btn secondary" data-action="title">戻る</button>
        </div>
      </section>
    `);
  }

  function showStageSelect() {
    state = 'stage';
    const cards = stages.map((s, i) => `
      <article class="card ${i === selectedStage ? 'selected' : ''}" data-stage="${i}">
        <img src="${ASSET + s.img}" alt="${s.name}" />
        <h3>${s.name}</h3>
        <p>${s.label} / ${s.desc}</p>
      </article>
    `).join('');
    setOverlay(`
      <section class="menu">
        <h1 class="logo" style="font-size:52px">ステージ選択</h1>
        <p class="sub">背景画像つきの4ステージを選べます。ステージごとに摩擦・重力・ギミックが少し変わります。</p>
        <div class="grid stage-grid">${cards}</div>
        <div class="row" style="margin-top:18px">
          <button class="btn" data-action="start">バトル開始</button>
          <button class="btn secondary" data-action="character">キャラ選択へ戻る</button>
        </div>
      </section>
    `);
  }

  function buildPlayer(fighterIndex, slot, isHuman) {
    const f = fighters[fighterIndex];
    const spawn = [
      { x: 420, y: 450 }, { x: 830, y: 450 }, { x: 530, y: 260 }, { x: 760, y: 260 },
    ][slot];
    return {
      id: slot,
      fighterIndex,
      f,
      isHuman,
      name: isHuman ? 'YOU' : `CPU ${slot}`,
      x: spawn.x, y: spawn.y,
      vx: 0, vy: 0,
      facing: slot === 1 ? -1 : 1,
      grounded: false,
      jumpsLeft: f.jumps,
      damage: 0,
      stocks: 3,
      alive: true,
      invuln: 110,
      attackTimer: 0,
      attackType: null,
      attackHit: new Set(),
      attackCooldown: 0,
      specialCooldown: 0,
      dashCooldown: 0,
      dashTimer: 0,
      guardEnergy: 100,
      guardBroken: 0,
      guarding: false,
      specialFlash: 0,
      stun: 0,
      state: 'idle',
      animT: 0,
      aiT: 0,
      aiMove: 0,
      aiJump: false,
    };
  }

  function startBattle() {
    ensureAudio();
    beep('click');
    state = 'battle';
    clearOverlay();
    paused = false;
    winner = null;
    particles = [];
    projectiles = [];
    effects = [];
    cameraShake = 0;
    time = 0;

    const order = [selectedFighter, ...fighters.map((_, i) => i).filter(i => i !== selectedFighter)];
    players = order.map((fi, slot) => buildPlayer(fi, slot, slot === 0));
  }

  function showResult(winPlayer) {
    state = 'result';
    winner = winPlayer;
    beep('win');
    const f = winPlayer.f;
    setOverlay(`
      <section class="menu narrow">
        <h1 class="logo" style="font-size:56px"><span>${f.short}</span> WIN!</h1>
        <p class="sub">${f.name} の勝利。選択キャラとステージを変えて再戦できます。</p>
        <div class="row">
          <button class="btn" data-action="restart">同じ条件で再戦</button>
          <button class="btn secondary" data-action="character">キャラを変える</button>
          <button class="btn secondary" data-action="stage">ステージを変える</button>
        </div>
      </section>
    `);
  }

  function resetDead(p) {
    p.stocks--;
    beep('ko');
    cameraShake = 22;
    burst(p.x, clamp(p.y, 120, 620), p.f.color, 34, 12);
    if (p.stocks <= 0) {
      p.alive = false;
      return;
    }
    const spawn = [
      { x: 420, y: 200 }, { x: 830, y: 200 }, { x: 530, y: 180 }, { x: 760, y: 180 },
    ][p.id];
    p.x = spawn.x; p.y = spawn.y; p.vx = 0; p.vy = 0; p.damage = Math.max(0, p.damage - 20);
    p.invuln = 160; p.stun = 0; p.attackTimer = 0; p.attackCooldown = 20; p.specialCooldown = 20; p.dashCooldown = 12; p.dashTimer = 0; p.guarding = false; p.guardBroken = 0; p.guardEnergy = Math.max(45, p.guardEnergy);
  }

  function update(dt) {
    if (state !== 'battle' || paused) return;
    time += dt;
    const stage = stages[selectedStage];

    // Volcano hazard: periodic lava pillar at center and sides.
    if (stage.hazard === 'lava') {
      const cycle = time % 520;
      if (cycle > 440 && cycle < 446) {
        for (const x of [W * .25, W * .5, W * .75]) addParticle(x, 590, rand(-1,1), rand(-10,-4), 'rgba(255,110,25,.95)', rand(18,35), 38);
      }
      if (cycle > 455 && cycle < 486) {
        const hazardXs = [W * .25, W * .5, W * .75];
        for (const p of alivePlayers()) {
          for (const hx of hazardXs) {
            if (Math.abs(p.x - hx) < 36 && p.y > 420) hitPlayer(null, p, 7, sign(p.x - hx || 1), 1.3, 'lava');
          }
        }
      }
    }

    updateProjectiles(dt);
    updateEffects(dt);
    for (const p of players) if (p.alive) updatePlayer(p, dt, stage);
    resolveHits(stage);
    updateParticles(dt);
    cameraShake *= .86;

    const alive = alivePlayers();
    if (alive.length <= 1 && !winner) {
      showResult(alive[0] || players[0]);
    }
  }

  function alivePlayers() { return players.filter(p => p.alive && p.stocks > 0); }

  function nearestEnemyOf(p) {
    let target = null;
    let best = Infinity;
    for (const e of alivePlayers()) {
      if (e === p) continue;
      const d = Math.abs(e.x - p.x) + Math.abs(e.y - p.y) * 0.35;
      if (d < best) { best = d; target = e; }
    }
    return target;
  }

  function controlsFor(p) {
    if (!p.isHuman) return aiControls(p);
    return {
      left: !!(keys.KeyA || keys.ArrowLeft || touch.left),
      right: !!(keys.KeyD || keys.ArrowRight || touch.right),
      dash: !!(keys.ShiftLeft || keys.ShiftRight || touch.dash),
      jump: !!(keys.KeyW || keys.ArrowUp || keys.Space || touch.jump),
      attack: !!(keys.KeyJ || keys.KeyX || touch.attack),
      guard: !!(keys.KeyL || keys.ArrowDown || touch.guard),
      special: !!(keys.KeyK || keys.KeyC || touch.special),
    };
  }

  function aiControls(p) {
    p.aiT--;
    const enemies = alivePlayers().filter(e => e !== p);
    let target = enemies[0];
    let best = Infinity;
    for (const e of enemies) {
      const d = Math.abs(e.x - p.x) + Math.abs(e.y - p.y) * .35;
      if (d < best) { best = d; target = e; }
    }
    if (!target) return { left: false, right: false, dash: false, jump: false, attack: false, guard: false, special: false };
    if (p.aiT <= 0) {
      p.aiT = rand(12, 42);
      p.aiMove = target.x < p.x - 38 ? -1 : target.x > p.x + 38 ? 1 : 0;
      p.aiJump = (target.y < p.y - 80 && Math.random() < .65) || (p.y > 650 && Math.random() < .9);
    }
    const dist = Math.abs(target.x - p.x);
    const close = dist < p.f.reach + 34 && Math.abs(target.y - p.y) < 95;
    const wantSpecial = (p.f.projectile && dist > 190 && dist < 560 && Math.random() < .08) || (!p.f.projectile && close && Math.random() < .018);
    return {
      left: p.aiMove < 0,
      right: p.aiMove > 0,
      dash: dist > 180 && dist < 420 && Math.random() < .035,
      jump: p.aiJump,
      attack: close && Math.random() < .12,
      guard: dist < 145 && Math.random() < .045,
      special: wantSpecial,
    };
  }

  function updatePlayer(p, dt, stage) {
    const f = p.f;
    const c = controlsFor(p);
    p.animT += dt;
    if (p.invuln > 0) p.invuln -= dt;
    if (p.stun > 0) p.stun -= dt;
    if (p.attackCooldown > 0) p.attackCooldown -= dt;
    if (p.specialCooldown > 0) p.specialCooldown -= dt;
    if (p.dashCooldown > 0) p.dashCooldown -= dt;
    if (p.dashTimer > 0) p.dashTimer -= dt;
    if (p.guardBroken > 0) p.guardBroken -= dt;
    if (p.specialFlash > 0) p.specialFlash -= dt;
    if (p.attackTimer > 0) p.attackTimer -= dt;
    if (p.attackTimer <= 0) { p.attackType = null; p.attackHit.clear(); }

    let move = 0;
    if (c.left) move -= 1;
    if (c.right) move += 1;
    if (move) p.facing = move;
    else if (p.isHuman && (touch.attack || touch.special || touch.dash)) {
      const target = nearestEnemyOf(p);
      if (target) p.facing = target.x < p.x ? -1 : 1;
    }

    p.guarding = !!(c.guard && p.guardBroken <= 0 && p.guardEnergy > 5 && p.stun <= 0 && p.attackTimer <= 0);
    if (p.guarding) {
      p.guardEnergy = Math.max(0, p.guardEnergy - 0.52 * dt);
      p.vx *= 0.86;
      if (p.guardEnergy <= 0) {
        p.guardBroken = 80;
        p.stun = 70;
        p.guarding = false;
        cameraShake = Math.max(cameraShake, 16);
        burst(p.x, p.y - 34, 'rgba(120,210,255,.95)', 38, 11);
        beep('ko');
      }
    } else {
      p.guardEnergy = clamp(p.guardEnergy + 0.34 * dt, 0, 100);
    }

    if (c.dash && !p._dashHeld && p.dashCooldown <= 0 && p.stun <= 0 && !p.guarding) {
      const dashDir = move || p.facing || 1;
      p.facing = dashDir;
      p.vx = dashDir * (f.speed * 2.45 + 4.2);
      if (!p.grounded) p.vy *= 0.55;
      p.dashTimer = 13;
      p.dashCooldown = 34;
      p.invuln = Math.max(p.invuln, 5);
      addEffect('dash', p.x, p.y - 30, dashDir, f.color, 18, f.id);
      burst(p.x - dashDir * 34, p.y + 18, f.color, 13, 7);
      beep('jump');
    }
    p._dashHeld = c.dash;

    const control = p.grounded ? 1 : f.air;
    if (p.stun <= 0 && !p.guarding) p.vx += move * f.speed * .22 * control;
    const dashBoost = p.dashTimer > 0 ? 1.7 : 1;
    const maxSpeed = f.speed * (p.grounded ? 1.05 : 1.0) * dashBoost;
    p.vx = clamp(p.vx, -maxSpeed, maxSpeed);

    if (p.grounded) {
      p.vx *= p.dashTimer > 0 ? 0.965 : stage.friction;
      p.jumpsLeft = f.jumps;
    } else {
      p.vx *= .988;
    }

    if (c.jump && !p._jumpHeld && p.stun <= 0 && p.jumpsLeft > 0) {
      p.vy = -f.jump;
      p.grounded = false;
      p.jumpsLeft--;
      beep('jump');
      burst(p.x, p.y + 22, 'rgba(255,255,255,.85)', 6, 5);
    }
    p._jumpHeld = c.jump;

    if (c.attack && !p._attackHeld && p.attackCooldown <= 0 && p.stun <= 0 && !p.guarding) {
      startAttack(p, 'normal');
    }
    if (c.special && !p._specialHeld && p.specialCooldown <= 0 && p.stun <= 0 && !p.guarding) {
      startAttack(p, 'special');
    }
    p._attackHeld = c.attack;
    p._specialHeld = c.special;

    p.vy += stage.gravity;
    p.x += p.vx;
    p.y += p.vy;

    // Wall soft bounds, ringout happens past larger limits.
    if (p.x < -240 || p.x > W + 240 || p.y > H + 210 || p.y < -320) resetDead(p);

    handlePlatforms(p, stage.platforms);

    if (p.attackTimer > 0) p.state = 'attack';
    else if (!p.grounded) p.state = 'jump';
    else if (Math.abs(p.vx) > .75) p.state = 'run';
    else p.state = 'idle';
  }

  function handlePlatforms(p, platforms) {
    p.grounded = false;
    for (const plat of platforms) {
      const prevY = p.y - p.vy;
      const feet = p.y + 48 * p.f.scale;
      const prevFeet = prevY + 48 * p.f.scale;
      const withinX = p.x > plat.x - 34 && p.x < plat.x + plat.w + 34;
      const crossing = prevFeet <= plat.y + 6 && feet >= plat.y;
      if (withinX && crossing && p.vy >= 0) {
        p.y = plat.y - 48 * p.f.scale;
        p.vy = 0;
        p.grounded = true;
        return;
      }
    }
  }

  function startAttack(p, type) {
    const f = p.f;
    p.attackType = type;
    p.attackTimer = type === 'special' ? 30 : 18;
    p.attackHit.clear();
    if (type === 'normal') {
      p.attackCooldown = f.cooldown;
      beep('attack');
      if (p.grounded) p.vx += p.facing * (f.id === 'beast' ? 1.4 : .55);
    } else {
      p.specialCooldown = f.specialCooldown;
      p.specialFlash = 24;
      beep(f.projectile ? 'spell' : 'attack');
      doSpecial(p);
    }
  }

  function doSpecial(p) {
    const f = p.f;
    if (f.id === 'mage') {
      addEffect('portal', p.x + p.facing * 58, p.y - 40, p.facing, f.color, 46, f.id);
      projectiles.push({
        owner: p,
        x: p.x + p.facing * 72,
        y: p.y - 34,
        vx: p.facing * 10.7,
        vy: -0.2,
        r: 25,
        life: 105,
        power: 10.8,
        knock: 1.2,
        color: f.color,
      });
      for (let i=0;i<18;i++) addParticle(p.x + p.facing*52, p.y - 30, p.facing*rand(2,6), rand(-3,3), f.color, rand(4,11), 24);
    } else if (f.id === 'sword') {
      p.vx += p.facing * 10.5;
      addEffect('slash', p.x + p.facing * 82, p.y - 28, p.facing, f.color, 32, f.id);
      burst(p.x + p.facing * 68, p.y - 20, 'rgba(60,210,255,.9)', 24, 9);
    } else if (f.id === 'beast') {
      p.vx += p.facing * 3.4;
      cameraShake = Math.max(cameraShake, 16);
      addEffect('shock', p.x + p.facing * 46, p.y + 40, p.facing, f.color, 34, f.id);
      burst(p.x + p.facing * 42, p.y + 34, 'rgba(255,95,35,.95)', 34, 11);
    } else if (f.id === 'martial') {
      p.vx += p.facing * 9.0;
      p.vy -= 5.2;
      addEffect('cyclone', p.x + p.facing * 48, p.y - 22, p.facing, f.color, 32, f.id);
      burst(p.x + p.facing * 42, p.y - 8, 'rgba(80,255,150,.9)', 22, 8);
    }
  }

  function resolveHits(stage) {
    for (const a of alivePlayers()) {
      if (!a.attackType || a.attackTimer <= 0) continue;
      const f = a.f;
      const special = a.attackType === 'special';
      const range = special ? f.reach + (f.id === 'sword' ? 75 : f.id === 'beast' ? 42 : f.id === 'martial' ? 50 : 0) : f.reach;
      const width = range;
      const height = special && f.id === 'beast' ? 92 : 78;
      const hx = a.x + a.facing * (36 + width * .48);
      const hy = a.y - 10;
      for (const b of alivePlayers()) {
        if (a === b || a.attackHit.has(b.id) || b.invuln > 0) continue;
        if (Math.abs(b.x - hx) < width * .55 + 28 && Math.abs(b.y - hy) < height) {
          const power = (special ? f.power * 1.18 : f.power) * (f.id === 'beast' && special ? 1.25 : 1);
          const knock = f.knock * (special ? 1.18 : 1);
          hitPlayer(a, b, power, a.facing, knock, special ? 'special' : 'hit');
          a.attackHit.add(b.id);
        }
      }
    }
  }

  function hitPlayer(attacker, target, dmg, dir, knockMul, kind) {
    if (!target.alive || target.invuln > 0 && kind !== 'lava') return;
    const col = attacker ? attacker.f.color : 'rgba(255,100,20,.95)';
    if (target.guarding && kind !== 'lava') {
      const frontGuard = target.facing === -dir || !attacker;
      const guardRate = frontGuard ? 0.18 : 0.42;
      const guardCost = dmg * (frontGuard ? 2.8 : 4.2);
      target.guardEnergy = Math.max(0, target.guardEnergy - guardCost);
      target.vx += dir * (frontGuard ? 1.2 : 2.6);
      target.vy -= frontGuard ? 0.7 : 1.2;
      target.damage += dmg * guardRate;
      target.stun = frontGuard ? 4 : 10;
      cameraShake = Math.max(cameraShake, 7);
      addEffect('guard', target.x, target.y - 42, -dir, '#8fe9ff', 22, target.f.id);
      burst(target.x, target.y - 34, 'rgba(140,230,255,.95)', 18, 7);
      beep('spell');
      if (target.guardEnergy <= 0) {
        target.guarding = false;
        target.guardBroken = 90;
        target.stun = 78;
        target.vx = dir * 8;
        target.vy = -9;
        cameraShake = Math.max(cameraShake, 22);
        addEffect('break', target.x, target.y - 40, dir, '#ffffff', 34, target.f.id);
        beep('ko');
      }
      return;
    }
    target.damage += dmg;
    const damageScale = 1 + target.damage / 86;
    const weight = target.f.weight || 1;
    const k = knockMul * damageScale / weight;
    target.vx = dir * (6.2 + dmg * .23) * k;
    target.vy = -(5.8 + dmg * .18) * k;
    target.stun = clamp(12 + dmg * .9, 10, 42);
    target.grounded = false;
    cameraShake = Math.max(cameraShake, clamp(dmg * .65, 5, 18));
    beep(kind === 'lava' ? 'hit' : 'hit');
    burst(target.x, target.y - 16, col, Math.floor(12 + dmg), 7 + dmg * .25);
  }

  function updateProjectiles(dt) {
    for (const pr of projectiles) {
      pr.x += pr.vx; pr.y += pr.vy;
      pr.life -= dt;
      pr.r *= 0.998;
      addParticle(pr.x, pr.y, rand(-.6,.6), rand(-.6,.6), pr.color, rand(2,5), 16);
      for (const b of alivePlayers()) {
        if (b === pr.owner || b.invuln > 0) continue;
        const d = Math.hypot(b.x - pr.x, (b.y - 20) - pr.y);
        if (d < pr.r + 35) {
          hitPlayer(pr.owner, b, pr.power, sign(pr.vx), pr.knock, 'spell');
          pr.life = 0;
          burst(pr.x, pr.y, pr.color, 24, 10);
          break;
        }
      }
    }
    projectiles = projectiles.filter(p => p.life > 0 && p.x > -120 && p.x < W + 120 && p.y > -120 && p.y < H + 120);
  }

  function addParticle(x, y, vx, vy, color, size, life) {
    particles.push({ x, y, vx, vy, color, size, life, max: life });
  }

  function addEffect(type, x, y, dir, color, life, fighterId) {
    effects.push({ type, x, y, dir, color, life, max: life, fighterId });
  }

  function updateEffects(dt) {
    for (const e of effects) e.life -= dt;
    effects = effects.filter(e => e.life > 0);
  }

  function burst(x, y, color, count, power) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = rand(power * .25, power);
      addParticle(x, y, Math.cos(a) * s, Math.sin(a) * s, color, rand(3, 12), rand(16, 42));
    }
  }

  function updateParticles(dt) {
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy; p.vy += .18; p.vx *= .98; p.life -= dt;
    }
    particles = particles.filter(p => p.life > 0);
  }

  function draw() {
    ctx.save();
    ctx.clearRect(0,0,W,H);

    if (state === 'battle' || state === 'result') {
      drawBattle();
    } else {
      drawMenuBackdrop();
    }
    ctx.restore();
  }

  function drawMenuBackdrop() {
    const bg = img('battle_keyart.png') || img(stages[0].img);
    if (bg) ctx.drawImage(bg, 0, 0, W, H);
    const g = ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0, 'rgba(4,8,18,.12)');
    g.addColorStop(.7, 'rgba(3,5,12,.45)');
    g.addColorStop(1, 'rgba(2,3,9,.88)');
    ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
    drawSparkles();
  }

  function drawBattle() {
    const stage = stages[selectedStage];
    const bg = img(stage.img);
    const sx = cameraShake ? rand(-cameraShake, cameraShake) : 0;
    const sy = cameraShake ? rand(-cameraShake, cameraShake) : 0;
    ctx.save();
    ctx.translate(sx, sy);
    if (bg) ctx.drawImage(bg, 0, 0, W, H);
    ctx.fillStyle = 'rgba(0,0,0,.10)'; ctx.fillRect(0,0,W,H);
    ctx.fillStyle = stage.tint; ctx.fillRect(0,0,W,H);
    drawStageGuides(stage);
    drawProjectiles();
    drawSpecialEffects();
    [...players].sort((a,b)=>a.y-b.y).forEach(drawPlayer);
    drawGuardEffects();
    drawParticles();
    drawAttackEffects();
    ctx.restore();
    drawHUD();
    if (paused) drawPause();
  }

  function drawStageGuides(stage) {
    // Subtle collider shine so the generated background remains the main art.
    for (const p of stage.platforms) {
      const grad = ctx.createLinearGradient(p.x, p.y - 6, p.x, p.y + p.h);
      grad.addColorStop(0, 'rgba(255,255,255,.23)');
      grad.addColorStop(.4, 'rgba(40,220,255,.10)');
      grad.addColorStop(1, 'rgba(0,0,0,.08)');
      ctx.fillStyle = grad;
      roundRect(ctx, p.x, p.y - 4, p.w, p.h, p.type === 'main' ? 24 : 12);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.18)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  function drawPlayer(p) {
    if (!p.alive) return;
    const f = p.f;
    const sheet = img(f.sheet);
    const meta = spriteMeta.get(f.sheet);
    const row = p.state === 'idle' ? 0 : p.state === 'run' ? 1 : p.state === 'jump' ? 2 : 3;
    const speed = row === 1 ? 5.0 : row === 3 ? 3.4 : 7.2;
    let col = Math.floor(p.animT / speed) % 4;
    if (row === 3) col = clamp(3 - Math.floor(p.attackTimer / 7), 0, 3);

    const flash = p.invuln > 0 && Math.floor(p.invuln / 8) % 2 === 0;
    if (flash) ctx.globalAlpha = .45;

    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.scale(p.facing, 1);
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    ctx.beginPath();
    ctx.ellipse(0, 54 * f.scale, 42 * f.scale, 10 * f.scale, 0, 0, Math.PI*2);
    ctx.fill();
    if (p.dashTimer > 0) {
      ctx.save();
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = f.color;
      ctx.beginPath();
      ctx.ellipse(-p.facing * 46, -28, 72, 20, -0.25 * p.facing, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (p.guardBroken > 0) {
      ctx.save();
      ctx.globalAlpha = 0.45 + Math.sin(time * 0.4) * 0.15;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, -34, 54, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    const targetH = f.drawH * f.scale;
    if (sheet && meta) {
      const frame = meta.frames[row][col];
      const aspect = frame.sw / frame.sh;
      const dh = targetH;
      const dw = dh * aspect;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(sheet, frame.sx, frame.sy, frame.sw, frame.sh, -dw / 2, 52 - dh, dw, dh);
    } else if (sheet) {
      const dw = f.drawW * f.scale;
      const dh = f.drawH * f.scale;
      ctx.drawImage(sheet, col * CELL, row * CELL, CELL, CELL, -dw/2, -dh + 52, dw, dh);
    } else {
      ctx.fillStyle = f.color;
      ctx.fillRect(-30, -92, 60, 92);
    }
    ctx.restore();
    ctx.globalAlpha = 1;

    // Name tag
    ctx.save();
    ctx.translate(p.x, p.y - 150 * f.scale);
    ctx.textAlign = 'center';
    ctx.font = '900 20px ui-sans-serif';
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#06101f';
    ctx.fillStyle = f.color;
    ctx.strokeText(p.isHuman ? 'P1' : `CPU${p.id}`, 0, 0);
    ctx.fillText(p.isHuman ? 'P1' : `CPU${p.id}`, 0, 0);
    ctx.beginPath();
    ctx.moveTo(-8, 8);
    ctx.lineTo(8, 8);
    ctx.lineTo(0, 20);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawGuardEffects() {
    for (const p of alivePlayers()) {
      if (!p.guarding) continue;
      const t = time * 0.08;
      ctx.save();
      ctx.translate(p.x, p.y - 38);
      const energy = clamp(p.guardEnergy / 100, 0, 1);
      ctx.globalAlpha = 0.28 + energy * 0.26;
      const g = ctx.createRadialGradient(0, 0, 8, 0, 0, 74);
      g.addColorStop(0, 'rgba(255,255,255,.18)');
      g.addColorStop(.55, 'rgba(95,220,255,.23)');
      g.addColorStop(1, 'rgba(95,220,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 74, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = .85;
      ctx.strokeStyle = `rgba(150,235,255,${0.35 + energy * 0.45})`;
      ctx.lineWidth = 4;
      ctx.setLineDash([14, 9]);
      ctx.lineDashOffset = -t * 16;
      ctx.beginPath();
      ctx.arc(0, 0, 62, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawSpecialEffects() {
    for (const e of effects) {
      const t = 1 - e.life / e.max;
      const fade = clamp(e.life / e.max, 0, 1);
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.scale(e.dir || 1, 1);
      ctx.globalAlpha = fade;
      ctx.shadowColor = e.color;
      ctx.shadowBlur = 20;
      if (e.type === 'slash') {
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 18 * (1 - t * 0.45);
        ctx.beginPath();
        ctx.arc(0, 0, 86 + t * 52, -1.1, 1.15);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(255,255,255,.86)';
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(0, 0, 112 + t * 48, -0.95, 1.0);
        ctx.stroke();
      } else if (e.type === 'shock') {
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 9;
        ctx.beginPath();
        ctx.ellipse(0, 0, 36 + t * 150, 14 + t * 28, 0, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,120,35,.16)';
        ctx.beginPath();
        ctx.ellipse(0, 0, 24 + t * 124, 8 + t * 22, 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.type === 'cyclone') {
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 9;
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(0, -i * 18, 38 + i * 20 + t * 34, -0.4 + t * 5 + i, Math.PI * 1.35 + t * 5 + i);
          ctx.stroke();
        }
      } else if (e.type === 'portal') {
        ctx.strokeStyle = e.color;
        ctx.lineWidth = 6;
        ctx.rotate(t * Math.PI * 2);
        for (let i = 0; i < 3; i++) {
          ctx.beginPath();
          ctx.arc(0, 0, 26 + i * 18 + t * 12, i * 0.7, Math.PI * 1.45 + i * 0.7);
          ctx.stroke();
        }
        ctx.fillStyle = e.color;
        ctx.globalAlpha = fade * .25;
        ctx.beginPath();
        ctx.arc(0, 0, 58, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.type === 'guard' || e.type === 'break') {
        ctx.strokeStyle = e.color;
        ctx.lineWidth = e.type === 'break' ? 8 : 5;
        ctx.beginPath();
        ctx.arc(0, 0, 32 + t * 70, 0, Math.PI * 2);
        ctx.stroke();
        for (let i = 0; i < 8; i++) {
          const a = i / 8 * Math.PI * 2 + t * 2;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * 18, Math.sin(a) * 18);
          ctx.lineTo(Math.cos(a) * (62 + t * 40), Math.sin(a) * (62 + t * 40));
          ctx.stroke();
        }
      } else if (e.type === 'dash') {
        ctx.fillStyle = e.color;
        ctx.globalAlpha = fade * .38;
        ctx.beginPath();
        ctx.ellipse(-40, 0, 120 * (1 - t * .25), 20, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  function drawAttackEffects() {
    for (const p of alivePlayers()) {
      if (!p.attackType || p.attackTimer <= 0) continue;
      const f = p.f;
      const t = 1 - p.attackTimer / (p.attackType === 'special' ? 30 : 18);
      ctx.save();
      ctx.translate(p.x + p.facing * (62 + f.reach * .2), p.y - 22);
      ctx.scale(p.facing, 1);
      ctx.globalAlpha = .65 * (1 - Math.abs(t - .5));
      ctx.strokeStyle = f.accent;
      ctx.lineWidth = p.attackType === 'special' ? 12 : 7;
      ctx.shadowColor = f.color; ctx.shadowBlur = 18;
      ctx.beginPath();
      const r = f.reach * (p.attackType === 'special' ? 1.35 : 1.0);
      ctx.arc(0, 0, r, -0.95 + t * .6, 0.85 + t * .75);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawProjectiles() {
    for (const p of projectiles) {
      const g = ctx.createRadialGradient(p.x, p.y, 4, p.x, p.y, p.r * 2.4);
      g.addColorStop(0, 'rgba(255,255,255,.95)');
      g.addColorStop(.25, p.color);
      g.addColorStop(1, 'rgba(140,40,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 2.4, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.72)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2); ctx.stroke();
    }
  }

  function drawParticles() {
    for (const p of particles) {
      const a = clamp(p.life / p.max, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * a, 0, Math.PI*2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawHUD() {
    ctx.save();
    const bw = 285, bh = 82, gap = 16;
    const startX = 22;
    players.forEach((p, i) => {
      const x = startX + i * (bw + gap);
      const y = H - bh - 18;
      const f = p.f;
      ctx.fillStyle = 'rgba(5,9,20,.72)';
      roundRect(ctx, x, y, bw, bh, 18); ctx.fill();
      ctx.strokeStyle = p.isHuman ? 'rgba(255,223,99,.8)' : 'rgba(255,255,255,.14)';
      ctx.lineWidth = 2; ctx.stroke();
      const portrait = img(f.portrait);
      if (portrait) {
        ctx.save();
        roundRect(ctx, x+8, y+8, 66, 66, 14); ctx.clip();
        ctx.drawImage(portrait, x+8, y+8, 66, 66);
        ctx.restore();
      }
      ctx.fillStyle = f.color;
      ctx.font = '900 14px ui-sans-serif';
      ctx.fillText(p.isHuman ? 'P1' : `CPU${p.id}`, x+84, y+23);
      ctx.fillStyle = '#fff';
      ctx.font = '900 42px ui-sans-serif';
      ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,.72)';
      const dmg = `${Math.floor(p.damage)}%`;
      ctx.strokeText(dmg, x+84, y+62); ctx.fillText(dmg, x+84, y+62);
      ctx.fillStyle = 'rgba(255,255,255,.82)';
      ctx.font = '800 13px ui-sans-serif';
      ctx.fillText(`${f.role}`, x+174, y+25);
      for (let s=0; s<3; s++) {
        ctx.globalAlpha = s < p.stocks ? 1 : .18;
        ctx.fillStyle = f.color;
        ctx.beginPath(); ctx.arc(x+184+s*24, y+56, 8, 0, Math.PI*2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(255,255,255,.12)';
      roundRect(ctx, x+174, y+66, 86, 6, 999); ctx.fill();
      ctx.fillStyle = p.guardEnergy > 28 ? 'rgba(120,230,255,.88)' : 'rgba(255,80,80,.9)';
      roundRect(ctx, x+174, y+66, 86 * clamp(p.guardEnergy/100,0,1), 6, 999); ctx.fill();
    });
    ctx.fillStyle = 'rgba(5,9,20,.62)';
    roundRect(ctx, W-232, 16, 210, 42, 16); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '800 15px ui-sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${stages[selectedStage].name}  |  DASH/GUARD/SKILL`, W-40, 43);
    ctx.restore();
  }

  function drawPause() {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0,0,W,H);
    ctx.textAlign = 'center';
    ctx.font = '900 72px ui-sans-serif';
    ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(0,0,0,.8)'; ctx.fillStyle = '#fff';
    ctx.strokeText('PAUSE', W/2, H/2); ctx.fillText('PAUSE', W/2, H/2);
    ctx.font = '700 18px ui-sans-serif';
    ctx.fillText('Pで再開 / Escでタイトルへ', W/2, H/2 + 44);
    ctx.restore();
  }

  function drawSparkles() {
    ctx.save();
    ctx.globalAlpha = .55;
    for (let i=0;i<36;i++) {
      const x = (i * 97 + time * .18) % W;
      const y = (Math.sin(i*3.1 + time*.01) * 110 + 190 + i*13) % H;
      ctx.fillStyle = i % 3 ? 'rgba(80,220,255,.6)' : 'rgba(255,215,90,.65)';
      ctx.beginPath(); ctx.arc(x, y, i%3+1, 0, Math.PI*2); ctx.fill();
    }
    ctx.restore();
  }

  function roundRect(c, x, y, w, h, r) {
    const rr = Math.min(r, w/2, h/2);
    c.beginPath();
    c.moveTo(x+rr, y);
    c.arcTo(x+w, y, x+w, y+h, rr);
    c.arcTo(x+w, y+h, x, y+h, rr);
    c.arcTo(x, y+h, x, y, rr);
    c.arcTo(x, y, x+w, y, rr);
    c.closePath();
  }

  function loop(now) {
    const dt = clamp((now - lastTime) / 16.666, 0, 2.2);
    lastTime = now;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  overlay.addEventListener('click', (e) => {
    const target = e.target.closest('[data-action], [data-fighter], [data-stage]');
    if (!target) return;
    ensureAudio(); beep('click');
    if (target.dataset.fighter != null) {
      selectedFighter = Number(target.dataset.fighter);
      showCharacterSelect();
      return;
    }
    if (target.dataset.stage != null) {
      selectedStage = Number(target.dataset.stage);
      showStageSelect();
      return;
    }
    const a = target.dataset.action;
    if (a === 'title') showTitle();
    if (a === 'howto') showHowTo();
    if (a === 'character') showCharacterSelect();
    if (a === 'stage') showStageSelect();
    if (a === 'start') startBattle();
    if (a === 'restart') startBattle();
  });

  window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','ShiftLeft','ShiftRight'].includes(e.code)) e.preventDefault();
    if (e.code === 'KeyP' && state === 'battle') { paused = !paused; ensureAudio(); beep('click'); }
    if (e.code === 'Escape') { showTitle(); }
    if (e.code === 'KeyR' && (state === 'battle' || state === 'result')) startBattle();
  }, { passive: false });
  window.addEventListener('keyup', (e) => { keys[e.code] = false; });

  function bindTouch() {
    for (const btn of touchControls.querySelectorAll('button')) {
      const k = btn.dataset.touch;
      const on = (e) => {
        e.preventDefault();
        if (btn.setPointerCapture) btn.setPointerCapture(e.pointerId);
        touch[k] = true;
        ensureAudio();
      };
      const off = (e) => {
        e.preventDefault();
        touch[k] = false;
        if (btn.releasePointerCapture) { try { btn.releasePointerCapture(e.pointerId); } catch (_) {} }
      };
      btn.addEventListener('pointerdown', on, { passive: false });
      btn.addEventListener('pointerup', off, { passive: false });
      btn.addEventListener('pointercancel', off, { passive: false });
      btn.addEventListener('pointerleave', off, { passive: false });
      btn.addEventListener('contextmenu', (e) => e.preventDefault());
    }
  }

  bindTouch();
  window.addEventListener('contextmenu', (e) => { if (e.target.closest('#touchControls')) e.preventDefault(); });
  preload().catch(err => {
    console.error(err);
    setOverlay(`<section class="menu narrow"><h1 class="logo" style="font-size:42px">読み込みエラー</h1><p class="sub">画像アセットが見つかりません。ローカルサーバーで起動してください。</p></section>`);
  });
})();
