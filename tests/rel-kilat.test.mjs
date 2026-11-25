import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const htmlPath = path.resolve(process.cwd(), 'public/assets/aistudio/rel-kilat-lengkap_ab50420c.html');
const html = fs.readFileSync(htmlPath, 'utf8');
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(scriptMatch, 'Inline <script> should exist');
const js = scriptMatch[1];

function createDomSandbox(initialStorage = {}) {
  const store = new Map(Object.entries(initialStorage).map(([k, v]) => [k, String(v)]));
  const elements = new Map();

  function makeEl(id = '') {
    const classSet = new Set();
    const listeners = new Map();
    const children = [];
    const el = {
      id,
      tagName: 'DIV',
      hidden: false,
      disabled: false,
      textContent: '',
      _innerHTML: '',
      style: {},
      dataset: {},
      children,
      _className: '',
      get className() { return [...classSet].join(' '); },
      set className(val) {
        classSet.clear();
        String(val || '').split(/\s+/).filter(Boolean).forEach((c) => classSet.add(c));
      },
      classList: {
        add: (...cls) => cls.forEach((c) => classSet.add(c)),
        remove: (...cls) => cls.forEach((c) => classSet.delete(c)),
        toggle: (c, force) => {
          const on = force === undefined ? !classSet.has(c) : !!force;
          if (on) classSet.add(c);
          else classSet.delete(c);
          return on;
        },
        contains: (c) => classSet.has(c),
      },
      setAttribute: (k, v) => { el._attrs[k] = String(v); },
      getAttribute: (k) => (el._attrs[k] !== undefined ? el._attrs[k] : null),
      _attrs: {},
      closest: () => null,
      blur: () => {},
      append: (...nodes) => children.push(...nodes),
      appendChild: (n) => {
        children.push(n);
        return n;
      },
      addEventListener: (evt, fn) => {
        if (!listeners.has(evt)) listeners.set(evt, []);
        listeners.get(evt).push(fn);
      },
      click: () => {
        for (const fn of listeners.get('click') || []) fn({ currentTarget: el, target: el });
        if (typeof el.onclick === 'function') el.onclick({ currentTarget: el, target: el });
      },
      get innerHTML() {
        return el._innerHTML;
      },
      set innerHTML(val) {
        el._innerHTML = String(val);
        if (val === '') children.length = 0;
      },
      getBoundingClientRect: () => ({ width: 400, height: 800, left: 0, top: 0 }),
      getContext: () => ({
        scale: () => {},
        clearRect: () => {},
        fillRect: () => {},
        beginPath: () => {},
        closePath: () => {},
        moveTo: () => {},
        lineTo: () => {},
        arc: () => {},
        arcTo: () => {},
        ellipse: () => {},
        fill: () => {},
        stroke: () => {},
        save: () => {},
        restore: () => {},
        translate: () => {},
        rotate: () => {},
        setTransform: () => {},
        setLineDash: () => {},
        drawImage: () => {},
        fillText: () => {},
        createLinearGradient: () => ({ addColorStop: () => {} }),
        createRadialGradient: () => ({ addColorStop: () => {} }),
      }),
    };
    return el;
  }

  for (const m of html.matchAll(/id="([^"]+)"/g)) {
    elements.set(m[1], makeEl(m[1]));
  }

  const body = makeEl('body');
  const windowListeners = new Map();
  const sandbox = {
    Math,
    Date,
    JSON,
    Array,
    Object,
    String,
    Number,
    Set,
    URLSearchParams,
    console,
    setTimeout: () => 1,
    clearTimeout: () => {},
    requestAnimationFrame: () => 1,
    performance: { now: () => 1000 },
    matchMedia: () => ({ matches: false }),
    ResizeObserver: class { observe() {} },
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
    },
    location: { search: '' },
    document: {
      body,
      hidden: false,
      activeElement: null,
      getElementById: (id) => {
        if (!elements.has(id)) elements.set(id, makeEl(id));
        return elements.get(id);
      },
      createElement: () => makeEl(),
      addEventListener: () => {},
    },
    addEventListener: (evt, fn) => {
      if (!windowListeners.has(evt)) windowListeners.set(evt, []);
      windowListeners.get(evt).push(fn);
    },
  };
  sandbox.window = sandbox;
  return { sandbox, store, elements, body };
}

test('contains 20 unique secret achievements and daily 50-coin mission', () => {
  const { sandbox } = createDomSandbox();
  const exportCode = js.replace('})();', 'this.__testExports={CHARS,BOARDS,UPGRADE_DEFS,GEAR_DEFS,SPIN_PRIZES,SECRET_ACHS,DAILY_POOL};})();');
  vm.runInNewContext(exportCode, sandbox);
  const { CHARS, BOARDS, UPGRADE_DEFS, GEAR_DEFS, SPIN_PRIZES, SECRET_ACHS, DAILY_POOL } = sandbox.__testExports;

  assert.equal(SECRET_ACHS.length, 20);
  assert.equal(new Set(SECRET_ACHS.map((a) => a.id)).size, 20);
  assert.equal(CHARS.length, 4);
  assert.equal(CHARS[0].price, 0);
  assert.ok(BOARDS.length >= 4);
  assert.ok(UPGRADE_DEFS.length >= 3);
  assert.ok(GEAR_DEFS.length >= 4);
  assert.equal(SPIN_PRIZES.length, 8);
  assert.ok(DAILY_POOL.flat().some((m) => m.id === 'm_rc50' && m.target === 50 && m.reward > 0));
});

test('shop purchases unlock characters, skateboards, and gear with coin deduction', () => {
  const { sandbox, store, elements } = createDomSandbox({ rk_bank: '1000' });
  const exportCode = js.replace(
    '})();',
    'this.__api={showOverlay,renderShop,activateBoard,startGame,getState:()=>({totalCoins,charIdx,ownedChars,boardState,inv,boardT,freeBoardLeft})};})();'
  );
  vm.runInNewContext(exportCode, sandbox);
  const api = sandbox.__api;

  // Open Shop -> Characters, buy Sari (120 coins)
  elements.get('shopBtn').click();
  let rows = elements.get('shopList').children;
  assert.equal(rows.length, 4);
  assert.equal(rows[0].children[2].textContent, 'Dipilih');
  assert.equal(rows[1].children[2].textContent, 'Beli • 120');
  rows[1].children[2].click();
  assert.equal(api.getState().totalCoins, 880);
  assert.equal(api.getState().charIdx, 1);
  assert.ok(api.getState().ownedChars.includes(1));

  // Switch to Skateboard tab, buy Kilat Klasik (90 coins)
  elements.get('tabBoard').click();
  rows = elements.get('shopList').children;
  assert.equal(rows.length, 4);
  rows[0].children[2].click();
  assert.equal(api.getState().totalCoins, 790);
  assert.equal(api.getState().boardState.equipped, 0);

  // Switch to Barang tab, upgrade Magnet Lv1 (100 coins) & buy Roket Awal (75 coins)
  elements.get('tabItem').click();
  rows = elements.get('shopList').children;
  rows[0].children[2].click(); // Magnet Lv1
  rows[4].children[2].click(); // Roket Awal
  assert.equal(api.getState().totalCoins, 615);
  assert.equal(api.getState().inv.magLv, 1);
  assert.equal(api.getState().inv.rocket, 1);
  assert.equal(store.get('rk_bank'), '615');

  // Start run and activate equipped skateboard
  api.startGame();
  assert.equal(api.getState().freeBoardLeft, 1);
  api.activateBoard();
  assert.equal(api.getState().boardT, 10);
  assert.equal(api.getState().freeBoardLeft, 0);
});

test('daily spin wheel awards 1 free spin per day and switches to paid extra spin afterwards', () => {
  let nowMs = 1000;
  const rafQueue = [];
  const { sandbox, store, elements } = createDomSandbox({ rk_bank: '10' });
  sandbox.performance = { now: () => nowMs };
  sandbox.requestAnimationFrame = (cb) => {
    if (cb && cb.name !== 'frame') rafQueue.push(cb);
    return rafQueue.length;
  };
  const exportCode = js.replace(
    '})();',
    'this.__api={SPIN_PRIZES,getState:()=>({totalCoins,spinState,inv})};})();'
  );
  vm.runInNewContext(exportCode, sandbox);
  const api = sandbox.__api;

  elements.get('spinBtn').click();
  const spinBtn = elements.get('doSpinBtn');
  assert.equal(spinBtn.textContent, 'Putar Gratis!');
  assert.equal(spinBtn.disabled, false);

  // Trigger free spin and drive RAF past 2900ms animation duration
  spinBtn.click();
  assert.equal(spinBtn.textContent, 'Memutar...');
  assert.equal(api.getState().spinState.freeUsed, true);
  assert.ok(JSON.parse(store.get('rk_spin')).freeUsed);

  let guard = 0;
  while (rafQueue.length && guard++ < 20) {
    nowMs += 3100;
    const cb = rafQueue.shift();
    cb(nowMs);
  }

  // Verify spin completed, prize awarded, and button transitioned to paid extra spin
  const stateAfter = api.getState();
  const itemCount =
    stateAfter.inv.boardPack + stateAfter.inv.rocket + stateAfter.inv.doubleScore + stateAfter.inv.shield;
  assert.ok(stateAfter.totalCoins > 10 || itemCount === 1, 'Spin prize should be awarded');
  assert.equal(spinBtn.textContent, 'Putar Lagi (50 Koin)');
  assert.equal(spinBtn.disabled, stateAfter.totalCoins < 50);
});

test('multi-layer parallax scales monotonically by depth across camX, camY, and forward distance', () => {
  const { sandbox } = createDomSandbox();
  const exportCode = js.replace(
    '})();',
    'this.__api={PARALLAX,parallaxX,parallaxY,startGame,jump,move,update,render,getCam:()=>({camX,camY,dist,py})};})();'
  );
  vm.runInNewContext(exportCode, sandbox);
  const api = sandbox.__api;
  const { PARALLAX, parallaxX, parallaxY } = api;

  // Verify strict depth ordering: stars < orb < clouds < far < near
  assert.ok(PARALLAX.stars.x < PARALLAX.orb.x);
  assert.ok(PARALLAX.orb.x < PARALLAX.clouds.x);
  assert.ok(PARALLAX.clouds.x < PARALLAX.far.x);
  assert.ok(PARALLAX.far.x < PARALLAX.near.x);

  assert.ok(PARALLAX.stars.y < PARALLAX.orb.y);
  assert.ok(PARALLAX.orb.y < PARALLAX.clouds.y);
  assert.ok(PARALLAX.clouds.y < PARALLAX.far.y);
  assert.ok(PARALLAX.far.y < PARALLAX.near.y);

  // Verify near skyline moves further than far skyline for same horizontal camera pan and forward distance
  const dxFar = parallaxX(80, 1200, 3, PARALLAX.far, 880, 1);
  const dxNear = parallaxX(80, 1200, 3, PARALLAX.near, 880, 1);
  assert.notEqual(dxFar, dxNear);
  assert.ok(parallaxY(40, PARALLAX.near, 1) > parallaxY(40, PARALLAX.far, 1));

  // Simulate lane switch + jump + render frames cleanly
  api.startGame();
  api.move(1);
  api.jump();
  for (let i = 0; i < 15; i++) {
    api.update(0.016);
    api.render();
  }
  const cam = api.getCam();
  assert.ok(cam.dist > 0, 'Forward distance should advance');
  assert.ok(cam.camX > 0, 'camX should track lane change');
  assert.ok(cam.camY > 0, 'camY should track vertical jump height');
});

test('sound engine drives BGM sequencer in play mode, respects Musik/Suara toggles, and triggers gameplay SFX', () => {
  const { sandbox, store, elements } = createDomSandbox({ rk_bank: '500' });
  const createdOscs = [];
  const createdNoises = [];
  const gainNodes = [];
  let resumed = 0;
  let suspended = 0;

  sandbox.AudioContext = class MockAudioContext {
    constructor() {
      this.state = 'suspended';
      this.currentTime = 1.0;
      this.sampleRate = 8000;
      this.destination = { kind: 'dest' };
    }
    resume() {
      this.state = 'running';
      resumed++;
    }
    suspend() {
      this.state = 'suspended';
      suspended++;
    }
    createGain() {
      const g = {
        value: 0,
        lastTarget: null,
        setValueAtTime(v) {
          this.value = v;
        },
        linearRampToValueAtTime(v) {
          this.value = v;
        },
        exponentialRampToValueAtTime(v) {
          this.value = v;
        },
        setTargetAtTime(v) {
          this.lastTarget = v;
          this.value = v;
        },
      };
      const node = { gain: g, connect() {} };
      gainNodes.push(node);
      return node;
    }
    createOscillator() {
      const rec = { type: 'sine', freq: 0, rampFreq: null, started: false, stopped: false };
      createdOscs.push(rec);
      return {
        set type(v) {
          rec.type = v;
        },
        get type() {
          return rec.type;
        },
        frequency: {
          setValueAtTime(v) {
            rec.freq = v;
          },
          exponentialRampToValueAtTime(v) {
            rec.rampFreq = v;
          },
        },
        connect() {},
        start() {
          rec.started = true;
        },
        stop() {
          rec.stopped = true;
        },
      };
    }
    createBuffer(ch, len) {
      return { getChannelData: () => new Float32Array(len) };
    }
    createBufferSource() {
      const rec = { started: false, stopped: false };
      createdNoises.push(rec);
      return {
        buffer: null,
        connect() {},
        start() {
          rec.started = true;
        },
        stop() {
          rec.stopped = true;
        },
      };
    }
    createBiquadFilter() {
      return { type: 'lowpass', frequency: { setValueAtTime() {} }, connect() {} };
    }
  };

  const exportCode = js.replace(
    '})();',
    'this.__api={Sound,BGM_PATTERNS,startGame,pauseGame,resumeGame,jump,slide,move,crash,update,collide,cns,obs,getState:()=>({mode,sound,music,bgmG,sfxG})};})();'
  );
  vm.runInNewContext(exportCode, sandbox);
  const api = sandbox.__api;

  assert.equal(api.BGM_PATTERNS.length, 3);
  assert.equal(elements.get('mBtn').textContent, 'Musik: Nyala');

  // Start run: AudioContext resumes and BGM steps forward on updateMusic(dt)
  api.startGame();
  assert.ok(resumed >= 1, 'AudioContext should resume on startGame');
  const stepBefore = api.Sound.bgmStep;
  const oscBeforeBgm = createdOscs.length;
  api.update(0.15); // >= 1 sixteenth step at 124 BPM (~0.121s)
  assert.ok(api.Sound.bgmStep > stepBefore, 'BGM step should advance in play mode');
  assert.ok(createdOscs.length > oscBeforeBgm, 'BGM step should synthesize oscillator notes');

  // Jump, air-drop slide, lane move, and landing trigger SFX
  const sfxBefore = createdOscs.length;
  const noiseBefore = createdNoises.length;
  api.move(1);
  api.jump();
  api.slide();
  for (let i = 0; i < 40; i++) api.update(0.03); // rise & land
  assert.ok(createdOscs.length > sfxBefore);
  assert.ok(createdNoises.length > noiseBefore);
  assert.ok(api.Sound.playedSfx.includes('move'));
  assert.ok(api.Sound.playedSfx.includes('jump'));
  assert.ok(api.Sound.playedSfx.includes('slide'));
  assert.ok(api.Sound.playedSfx.includes('land'));

  // Coin collection + powerup + crash SFX
  api.cns.push({ x: 110, y: 48, wz: api.Sound ? 999999 : 0, p: 0 }); // sanity check array push
  api.cns.pop();
  api.Sound.play('coin', 3);
  api.Sound.play('powerup', 'magnet');
  assert.ok(api.Sound.playedSfx.includes('coin'));
  assert.ok(api.Sound.playedSfx.includes('powerup'));

  // Toggle Musik off -> persists rk_m='0', mutes bgmG, halts BGM stepping
  elements.get('mBtn').click();
  assert.equal(api.getState().music, false);
  assert.equal(store.get('rk_m'), '0');
  assert.equal(elements.get('mBtn').textContent, 'Musik: Mati');
  assert.equal(api.getState().bgmG.gain.value, 0);
  const pausedBgmStep = api.Sound.bgmStep;
  api.update(0.2);
  assert.equal(api.Sound.bgmStep, pausedBgmStep, 'BGM should not step when music is off');

  // Toggle Suara off -> no new oscillators/noises created on SFX calls
  elements.get('sBtn').click();
  assert.equal(api.getState().sound, false);
  assert.equal(store.get('rk_s'), '0');
  const oscFrozen = createdOscs.length;
  const noiseFrozen = createdNoises.length;
  api.Sound.play('coin', 1);
  api.Sound.play('crash');
  assert.equal(createdOscs.length, oscFrozen, 'Muted sound should not create oscillators');
  assert.equal(createdNoises.length, noiseFrozen, 'Muted sound should not create noise nodes');

  // Re-enable sound and verify crash + pause/suspend behavior
  elements.get('sBtn').click();
  elements.get('mBtn').click();
  api.crash();
  assert.equal(api.getState().mode, 'over');
  assert.ok(api.Sound.playedSfx.includes('crash'));
  assert.equal(api.getState().bgmG.gain.value, 0, 'BGM bus should mute on crash');
  api.Sound.suspend();
  assert.ok(suspended >= 1, 'Sound.suspend should suspend running AudioContext');
});

test('tutorial overlay guides first-time run via #go and supports step navigation and reopening', () => {
  const { sandbox, store, elements } = createDomSandbox();
  const exportCode = js.replace(
    '})();',
    'this.__api={TUT_STEPS,getState:()=>({mode,tutDone,tutOpen,tutStep})};})();'
  );
  vm.runInNewContext(exportCode, sandbox);
  const api = sandbox.__api;

  assert.equal(api.TUT_STEPS.length, 4);
  assert.equal(elements.get('tutOv').hidden, true);

  // First click on #go opens tutorial overlay instead of dropping directly into obstacles
  elements.get('go').click();
  assert.equal(api.getState().mode, 'menu');
  assert.equal(api.getState().tutOpen, true);
  assert.equal(elements.get('tutOv').hidden, false);
  assert.equal(elements.get('tutStepLbl').textContent, 'Langkah 1 / 4');
  assert.equal(elements.get('tutPrevBtn').hidden, true);

  // Advance through steps and verify Back button
  elements.get('tutNextBtn').click();
  assert.equal(elements.get('tutStepLbl').textContent, 'Langkah 2 / 4');
  assert.equal(elements.get('tutPrevBtn').hidden, false);
  elements.get('tutPrevBtn').click();
  assert.equal(elements.get('tutStepLbl').textContent, 'Langkah 1 / 4');

  elements.get('tutNextBtn').click();
  elements.get('tutNextBtn').click();
  elements.get('tutNextBtn').click();
  assert.equal(elements.get('tutStepLbl').textContent, 'Langkah 4 / 4');
  assert.equal(elements.get('tutNextBtn').textContent, 'Mulai Lari!');

  // Finish tutorial -> marks rk_tut='1' and launches play mode
  elements.get('tutNextBtn').click();
  assert.equal(elements.get('tutOv').hidden, true);
  assert.equal(store.get('rk_tut'), '1');
  assert.equal(api.getState().tutDone, true);
  assert.equal(api.getState().mode, 'play');

  // Reopen tutorial from pause via #tutBtn and skip without resetting run
  elements.get('pauseBtn').click();
  assert.equal(api.getState().mode, 'paused');
  elements.get('tutBtn').click();
  assert.equal(elements.get('tutOv').hidden, false);
  assert.equal(elements.get('tutNextBtn').textContent, 'Lanjut');
  elements.get('tutSkipBtn').click();
  assert.equal(elements.get('tutOv').hidden, true);
  assert.equal(api.getState().mode, 'paused');
});

test('run system supports run modes, live distance HUD, sprint charge/boost, and practice safety', () => {
  const { sandbox, store, elements } = createDomSandbox({ rk_tut: '1' });
  const exportCode = js.replace(
    '})();',
    'this.__api={RUN_MODES,startGame,update,collide,activateSprint,obs,getState:()=>({mode,runMode,speed,dist,runMeters,score,sprintCharge,sprintT,invulnT,stats})};})();'
  );
  vm.runInNewContext(exportCode, sandbox);
  const api = sandbox.__api;

  // Switch to Kilat (turbo) mode
  elements.get('rmTurboBtn').click();
  assert.equal(api.getState().runMode, 'turbo');
  assert.equal(store.get('rk_rm'), 'turbo');
  api.startGame();
  assert.equal(api.getState().speed, api.RUN_MODES.turbo.baseSpd);
  assert.equal(elements.get('hudModeLbl').textContent, 'Kilat');

  // Advance frames -> distance meters and sprintCharge reach 100% deterministically
  for (let i = 0; i < 400; i++) {
    api.obs.length = 0;
    api.update(0.05);
  }
  assert.ok(api.getState().runMeters > 50);
  assert.ok(elements.get('hudDist').textContent.endsWith(' m'));
  assert.equal(api.getState().sprintCharge, 100);
  assert.equal(elements.get('sprintPctLbl').textContent, 'SIAP!');

  // Activate Sprint (Lari Kilat)
  elements.get('useSprintBtn').click();
  assert.ok(api.getState().sprintT > 2);
  assert.equal(elements.get('puSp').hidden, false);

  // Switch to Latihan (practice) mode -> collision does not end the run
  elements.get('rmPracticeBtn').click();
  api.startGame();
  assert.equal(api.getState().runMode, 'practice');
  api.obs.push({ type: 'barrier', x: 0, wz: api.getState().dist, len: 30, hw: 44 });
  api.collide();
  assert.equal(api.getState().mode, 'play', 'Practice mode should absorb collision instead of crashing');
  assert.ok(api.getState().invulnT > 1);
});

test('daily login awards 7-day escalating rewards, advances consecutive streaks, and resets missed streaks', () => {
  const { sandbox, store, elements } = createDomSandbox({ rk_bank: '100' });
  const exportCode = js.replace(
    '})();',
    'this.__api={LOGIN_REWARDS,dayKeyOffset,claimDailyLogin,getState:()=>({totalCoins,inv,loginState})};})();'
  );
  vm.runInNewContext(exportCode, sandbox);
  const api = sandbox.__api;

  // Day 1 unclaimed banner visible on menu
  assert.equal(elements.get('loginBanner').hidden, false);
  elements.get('loginBtn').click();
  assert.equal(elements.get('loginGrid').children.length, 7);
  assert.equal(elements.get('claimLoginBtn').disabled, false);

  // Claim Day 1 (+25 coins)
  elements.get('claimLoginBtn').click();
  assert.equal(api.getState().totalCoins, 125);
  assert.equal(api.getState().loginState.streak, 1);
  assert.equal(elements.get('claimLoginBtn').disabled, true);
  assert.equal(elements.get('loginBanner').hidden, true);
  assert.equal(api.claimDailyLogin(), null, 'Cannot claim twice on the same day');
  assert.equal(JSON.parse(store.get('rk_login')).streak, 1);

  // Consecutive day (yesterday -> Day 3 reward: 1x Baterai Papan)
  const yest = api.dayKeyOffset(-1);
  const s2 = createDomSandbox({
    rk_bank: '50',
    rk_login: JSON.stringify({ streak: 2, lastClaim: yest, totalDays: 2 }),
  });
  vm.runInNewContext(exportCode, s2.sandbox);
  const api2 = s2.sandbox.__api;
  const rw3 = api2.claimDailyLogin();
  assert.equal(rw3.day, 3);
  assert.equal(api2.getState().inv.boardPack, 1);
  assert.equal(api2.getState().loginState.streak, 3);

  // Missed day -> streak resets to 0 and awards Day 1
  const s3 = createDomSandbox({
    rk_bank: '50',
    rk_login: JSON.stringify({ streak: 5, lastClaim: '2020-01-01', totalDays: 5 }),
  });
  vm.runInNewContext(exportCode, s3.sandbox);
  const api3 = s3.sandbox.__api;
  const rw1 = api3.claimDailyLogin();
  assert.equal(rw1.day, 1);
  assert.equal(api3.getState().totalCoins, 75);
  assert.equal(api3.getState().loginState.streak, 1);
});

test('game over hides HUD/settings, displays hero score with record gap, run delta chips, and neutral Menu button', () => {
  const { sandbox, elements, body } = createDomSandbox({ rk_tut: '1', rk_best: '5537', rk_bank: '100' });
  const exportCode = js.replace(
    '})();',
    'this.__api={startGame,crash,showOverlay,unlockAch,setScore:(s,m,c)=>{score=s;runMeters=m;coins=c;totalCoins+=c},getState:()=>({mode,best,score,totalCoins,stats})};})();'
  );
  vm.runInNewContext(exportCode, sandbox);
  const api = sandbox.__api;

  api.startGame();
  api.setScore(25, 129, 14);
  api.crash();
  api.showOverlay('over');

  assert.equal(body.dataset.state, 'gameover');
  assert.equal(elements.get('hud').hidden, true);
  assert.equal(elements.get('pusBox').hidden, true);
  assert.equal(elements.get('hudItems').hidden, true);
  assert.equal(elements.get('ovOpts').hidden, true);
  assert.equal(elements.get('ovTag').textContent, 'Tertabrak');
  assert.equal(elements.get('ovTitle').textContent, 'Selesai');
  assert.equal(elements.get('go').textContent, 'Lari Lagi');
  assert.equal(elements.get('exitBtn').textContent, 'Menu');
  assert.equal(elements.get('exitBtn').className, 'chip neutral-nav');
  assert.equal(elements.get('goRecBadge').hidden, true);
  assert.equal(elements.get('goRecLine').hidden, false);
  assert.equal(elements.get('goRecLine').textContent, 'Rekor 5.537 • kurang 5.512');
  assert.equal(elements.get('sDist').textContent, '129 m');
  assert.equal(elements.get('sCoins').textContent, '+14');
  assert.equal(elements.get('sRun').textContent, 'ke-1');
  assert.equal(elements.get('goLoadoutLbl').textContent, 'Raka • Klasik');

  // Run delta chips appear when achievement unlocked in run
  assert.equal(elements.get('goDelta').hidden, false);
  assert.equal(elements.get('goMsDot').hidden, false);
  assert.ok(elements.get('goDelta').children.some((c) => c.textContent.includes('Kolektor Pemula')));

  // New record run shows Rekor baru! badge and hides delta when nothing newly unlocked
  const s2 = createDomSandbox({ rk_tut: '1', rk_best: '100', rk_bank: '0', rk_ach: JSON.stringify({ coin10: 1, bank100: 1, score500: 1, score1500: 1, coin50: 1, combo10: 1, pu2: 1, sec_fast_lane: 1 }) });
  vm.runInNewContext(exportCode, s2.sandbox);
  const api2 = s2.sandbox.__api;
  api2.startGame();
  api2.setScore(320, 410, 0);
  api2.crash();
  api2.showOverlay('over');
  assert.equal(s2.elements.get('goRecBadge').hidden, false);
  assert.equal(s2.elements.get('goRecLine').hidden, true);
});

test('game over ignores panic taps for first 500ms, animates score in 600ms, and honors prefers-reduced-motion', () => {
  let nowMs = 2000;
  const rafQueue = [];
  const { sandbox, elements } = createDomSandbox({ rk_tut: '1', rk_bank: '100' });
  sandbox.performance = { now: () => nowMs };
  sandbox.requestAnimationFrame = (cb) => {
    if (cb && cb.name !== 'frame') rafQueue.push(cb);
    return rafQueue.length;
  };
  const exportCode = js.replace(
    '})();',
    'this.__api={startGame,crash,showOverlay,setScore:(s,c)=>{score=s;coins=c;totalCoins+=c},getState:()=>({mode})};})();'
  );
  vm.runInNewContext(exportCode, sandbox);
  const api = sandbox.__api;

  api.startGame();
  api.setScore(1250, 40);
  api.crash();
  api.showOverlay('over');

  // Score starts at 0 and counts up over 600ms
  assert.equal(elements.get('sScore').textContent, '0');
  assert.equal(elements.get('sCoinBank').textContent, 'Total 100');

  // Panic taps within 500ms are ignored
  nowMs += 200;
  elements.get('goTabLb').click();
  assert.equal(elements.get('sheetOv').hidden, true);
  elements.get('go').click();
  assert.equal(api.getState().mode, 'over');
  elements.get('exitBtn').click();
  assert.equal(api.getState().mode, 'over');

  // Advance clock past 600ms and flush animation RAF
  while (rafQueue.length) {
    nowMs += 350;
    rafQueue.shift()(nowMs);
  }
  assert.equal(elements.get('sScore').textContent, '1.250');
  assert.equal(elements.get('sCoinBank').textContent, 'Total 140');

  // After 500ms, actions work normally
  elements.get('goTabLb').click();
  assert.equal(elements.get('sheetOv').hidden, false);
  elements.get('sheetCloseBtn').click();
  assert.equal(elements.get('sheetOv').hidden, true);
  elements.get('go').click();
  assert.equal(api.getState().mode, 'play');

  // Reduced motion skips count-up delay and shows final score immediately
  const sRed = createDomSandbox({ rk_tut: '1', rk_bank: '100' });
  sRed.sandbox.matchMedia = () => ({ matches: true });
  vm.runInNewContext(exportCode, sRed.sandbox);
  const apiRed = sRed.sandbox.__api;
  apiRed.startGame();
  apiRed.setScore(980, 25);
  apiRed.crash();
  apiRed.showOverlay('over');
  assert.equal(sRed.elements.get('sScore').textContent, '980');
  assert.equal(sRed.elements.get('sCoinBank').textContent, 'Total 125');
});

test('bottom sheets render Leaderboard highlight, sorted 2-col Secret Missions with ???, 7/7 summary, Loadout, Shop, and Settings', () => {
  let nowMs = 1000;
  const baseAch = { coin10: 1, coin50: 1, bank100: 1, combo10: 1, score500: 1, score1500: 1, pu2: 1, sec_bunny: 1 };
  const { sandbox, elements } = createDomSandbox({ rk_tut: '1', rk_ach: JSON.stringify(baseAch) });
  sandbox.performance = { now: () => nowMs };
  const exportCode = js.replace(
    '})();',
    'this.__api={startGame,crash,showOverlay,unlockAch,setScore:(s,m)=>{score=s;runMeters=m;coins=5},getState:()=>({mode,runMode})};})();'
  );
  vm.runInNewContext(exportCode, sandbox);
  const api = sandbox.__api;

  // Gear icon opens Settings Bottom Sheet on main menu
  elements.get('gearMenuBtn').click();
  assert.equal(elements.get('sheetOv').hidden, false);
  assert.equal(elements.get('sheetSettings').hidden, false);
  assert.equal(elements.get('sheetTitle').textContent, 'Pengaturan');
  elements.get('sheetCloseBtn').click();

  // Start run, unlock a new secret mission in-run, crash, and advance past 500ms guard
  api.startGame();
  api.setScore(420, 310);
  api.unlockAch('sec_switcher');
  api.crash();
  api.showOverlay('over');
  nowMs += 600;

  // Leaderboard Bottom Sheet highlights current run with "Lari ini #1"
  elements.get('goTabLb').click();
  assert.equal(elements.get('sheetLb').hidden, false);
  const lbRows = elements.get('sheetLbList').children;
  assert.equal(lbRows.length, 1);
  assert.equal(lbRows[0].classList.contains('new'), true);
  assert.equal(lbRows[0].children[2].children[0].children[1].textContent, 'Lari ini #1');

  // Missions Bottom Sheet: 7/7 summary collapsed initially and expandable, Misi Rahasia sorted [new -> unlocked -> locked], locked shows "???"
  elements.get('goTabMs').click();
  assert.equal(elements.get('sheetMissions').hidden, false);
  assert.equal(elements.get('sheetAchCount').textContent, '7/7 Pencapaian selesai');
  assert.equal(elements.get('sheetAchList').hidden, true);
  elements.get('sheetAchToggle').click();
  assert.equal(elements.get('sheetAchList').hidden, false);
  assert.equal(elements.get('sheetAchToggle').getAttribute('aria-expanded'), 'true');

  assert.equal(elements.get('sheetSecCnt').textContent, '2/20');
  assert.equal(elements.get('sheetSecBar').style.width, '10%');
  const secCards = elements.get('sheetSecGrid').children;
  assert.equal(secCards.length, 20);
  assert.equal(secCards[0].children[1].textContent, 'Penari Jalur'); // newly unlocked first
  assert.equal(secCards[1].children[1].textContent, 'Kaki Pegas'); // previously unlocked second
  assert.equal(secCards[2].children[0].children[0].textContent, '🔒'); // locked has lock icon
  assert.equal(secCards[2].children[1].textContent, '???'); // locked hides name without #1/#2 numbers

  // Loadout Bottom Sheet switches run mode
  elements.get('goLoadoutBtn').click();
  assert.equal(elements.get('sheetLoadout').hidden, false);
  elements.get('sheetRmTurbo').click();
  assert.equal(api.getState().runMode, 'turbo');
  assert.equal(elements.get('goLoadoutLbl').textContent, 'Raka • Kilat');

  // Shop Bottom Sheet accessible from Game Over dock
  elements.get('goTabShop').click();
  assert.equal(elements.get('sheetShop').hidden, false);
  assert.equal(elements.get('sheetShopList').children.length, 4);
});

test('dynamic difficulty scales speed and obstacle frequency smoothly over run duration', () => {
  const { sandbox } = createDomSandbox({ rk_tut: '1' });
  const exportCode = js.replace(
    '})();',
    'this.__api={RUN_MODES,getDifficultyMod,startGame,update,spawn,obs,cns,setRunTime:(rt)=>{runTime=rt},getState:()=>({mode,runTime,baseSpeed,speed,nextAt,dist})};})();'
  );
  vm.runInNewContext(exportCode, sandbox);
  const api = sandbox.__api;

  // Pure getDifficultyMod checks: neutral at t=0, monotonic growth, softer curve in Practice
  const d0 = api.getDifficultyMod(0, api.RUN_MODES.classic);
  const d30 = api.getDifficultyMod(30, api.RUN_MODES.classic);
  const d120 = api.getDifficultyMod(120, api.RUN_MODES.classic);
  const dPrac = api.getDifficultyMod(120, api.RUN_MODES.practice);

  assert.equal(d0.speedMult, 1);
  assert.equal(d0.freqMult, 1);
  assert.ok(d30.speedMult > d0.speedMult && d120.speedMult > d30.speedMult);
  assert.ok(d30.freqMult > d0.freqMult && d120.freqMult > d30.freqMult);
  assert.ok(d120.speedMult > dPrac.speedMult && d120.freqMult > dPrac.freqMult);

  // Start run: initial speed matches RUN_MODES.classic.baseSpd
  api.startGame();
  assert.equal(api.getState().speed, api.RUN_MODES.classic.baseSpd);

  // Advance runTime past maxSpd cap -> speed continues modest scaling above baseSpeed
  for (let i = 0; i < 900; i++) {
    api.obs.length = 0;
    api.cns.length = 0;
    api.update(0.1);
  }
  const stLate = api.getState();
  assert.ok(stLate.runTime >= 89);
  assert.equal(stLate.baseSpeed, api.RUN_MODES.classic.maxSpd);
  assert.ok(stLate.speed > api.RUN_MODES.classic.maxSpd, 'Dynamic modifier slightly increases speed beyond base maxSpd');

  // Measure spawn wave intervals at runTime=0 vs runTime=120s at same speed
  let gapEarlySum = 0;
  api.setRunTime(0);
  for (let i = 0; i < 40; i++) {
    api.obs.length = 0;
    const before = api.getState().nextAt;
    api.spawn();
    gapEarlySum += api.getState().nextAt - before;
    // Every spawned wave must keep at most 2 trains so >=1 lane remains open/passable
    const trainCount = api.obs.filter((o) => o.type === 'train').length;
    assert.ok(trainCount <= 2, 'Wave should never spawn 3 trains blocking all lanes');
  }

  let gapLateSum = 0;
  api.setRunTime(120);
  for (let i = 0; i < 40; i++) {
    api.obs.length = 0;
    const before = api.getState().nextAt;
    api.spawn();
    gapLateSum += api.getState().nextAt - before;
    const trainCount = api.obs.filter((o) => o.type === 'train').length;
    assert.ok(trainCount <= 2, 'Late-run wave should never block all 3 lanes with trains');
  }
  assert.ok(gapLateSum / 40 < gapEarlySum / 40, 'Obstacle wave spacing should tighten later in a run');
});

test('haptic engine vibrates via navigator.vibrate and AndroidHost, throttles coins, and honors #hBtn toggle', () => {
  let nowMs = 1000;
  const webPatterns = [];
  const { sandbox, store, elements } = createDomSandbox({ rk_tut: '1', rk_bank: '100' });
  sandbox.performance = { now: () => nowMs };
  sandbox.navigator = {
    vibrate: (pat) => {
      webPatterns.push(pat);
      return true;
    },
  };

  const exportCode = js.replace(
    '})();',
    'this.__api={Haptic,startGame,move,jump,slide,update,collide,crash,unlockAch,activateBoard,obs,cns,setInv:(k,v)=>{inv[k]=v},getState:()=>({haptic,mode,dist})};})();'
  );
  vm.runInNewContext(exportCode, sandbox);
  const api = sandbox.__api;

  assert.equal(elements.get('hBtn').textContent, 'Getar Haptik: Nyala');
  api.startGame();

  // Gameplay gestures: move, jump, slide, land trigger haptic patterns
  api.move(1);
  api.jump();
  api.slide();
  for (let i = 0; i < 40; i++) api.update(0.03);
  const kinds = api.Haptic.log.map((e) => e.kind);
  assert.ok(kinds.includes('move'));
  assert.ok(kinds.includes('jump'));
  assert.ok(kinds.includes('slide'));
  assert.ok(kinds.includes('land'));
  assert.ok(webPatterns.length >= 4);

  // Rapid coin pickups within 65ms are throttled to 1 pulse
  const beforeCoins = webPatterns.length;
  api.Haptic.trigger('coin');
  api.Haptic.trigger('coin');
  assert.equal(webPatterns.length, beforeCoins + 1);
  nowMs += 70;
  api.Haptic.trigger('coin');
  assert.equal(webPatterns.length, beforeCoins + 2);

  // Shield save & crash trigger distinct strong patterns
  api.setInv('shield', 1);
  api.obs.push({ type: 'barrier', x: 100, wz: api.getState().dist, len: 30, hw: 44 });
  api.collide();
  assert.ok(api.Haptic.log.some((e) => e.kind === 'save'));

  api.crash();
  assert.ok(api.Haptic.log.some((e) => e.kind === 'crash'));

  // AndroidHost.vibratePattern takes precedence when present
  const androidCalls = [];
  sandbox.AndroidHost = { vibratePattern: (csv) => androidCalls.push(csv) };
  api.Haptic.trigger('powerup');
  assert.deepEqual(androidCalls, ['18,32,26']);

  // Toggling #hBtn off persists rk_haptic='0' and suppresses haptic pulses
  elements.get('hBtn').click();
  assert.equal(api.getState().haptic, false);
  assert.equal(store.get('rk_haptic'), '0');
  assert.equal(elements.get('hBtn').textContent, 'Getar Haptik: Mati');
  const frozenCount = androidCalls.length;
  assert.equal(api.Haptic.trigger('crash'), false);
  assert.equal(androidCalls.length, frozenCount);
});

test('menu loading transition system coordinates 8px-grid sweeps, view animations, active tab states, and reduced-motion', () => {
  const scheduled = [];
  const { sandbox, elements, body } = createDomSandbox({ rk_tut: '1' });
  sandbox.setTimeout = (cb, ms) => {
    scheduled.push({ cb, ms });
    return scheduled.length;
  };
  const exportCode = js.replace(
    '})();',
    'this.__api={computeMenuTransition,MenuTransition,startGame,pauseGame,resumeGame,exitToMenu,getState:()=>({mode,menuTab,shopTab,activeSheet})};})();'
  );
  vm.runInNewContext(exportCode, sandbox);
  const api = sandbox.__api;

  // Pure 8px-grid transition specs
  const tabSpec = api.computeMenuTransition('menu:main', 'menu:shop', false);
  assert.equal(tabSpec.changed, true);
  assert.equal(tabSpec.major, false);
  assert.equal(tabSpec.durationMs, 180);
  assert.equal(tabSpec.slidePx, 8);
  assert.equal(tabSpec.showSweep, true);
  assert.equal(tabSpec.showVeil, false);

  const sheetSpec = api.computeMenuTransition('over', 'sheet:lb', false);
  assert.equal(sheetSpec.major, true);
  assert.equal(sheetSpec.durationMs, 220);
  assert.equal(sheetSpec.slidePx, 24);
  assert.equal(sheetSpec.showVeil, true);

  const redSpec = api.computeMenuTransition('menu:main', 'play', true);
  assert.equal(redSpec.durationMs, 0);
  assert.equal(redSpec.slidePx, 0);
  assert.equal(redSpec.showSweep, false);
  assert.equal(redSpec.showVeil, false);

  // Startup should not fire loading sweep on initial menu:main render
  assert.equal(elements.get('menuLoadBar').classList.contains('active'), false);
  assert.equal(elements.get('stageTrans').classList.contains('active'), false);

  // Switch Main Menu -> Toko -> sweeps menuLoadBar, animates #ovShop, marks #shopBtn active
  elements.get('shopBtn').click();
  assert.equal(api.getState().menuTab, 'shop');
  assert.equal(elements.get('ovShop').hidden, false);
  assert.equal(elements.get('menuLoadBar').classList.contains('active'), true);
  assert.equal(elements.get('ovShop').classList.contains('nav-anim'), true);
  assert.equal(elements.get('shopBtn').classList.contains('on'), true);
  assert.equal(elements.get('stageTrans').classList.contains('active'), false);

  // Switch Shop sub-tab Karakter -> Skateboard -> triggers sweep and #shopList animation
  elements.get('tabBoard').click();
  assert.equal(api.getState().shopTab, 'board');
  assert.equal(elements.get('shopList').classList.contains('nav-anim'), true);

  // Flush timers -> active transition classes clear cleanly
  while (scheduled.length) scheduled.shift().cb();
  assert.equal(elements.get('menuLoadBar').classList.contains('active'), false);
  assert.equal(elements.get('ovShop').classList.contains('nav-anim'), false);
  assert.equal(elements.get('shopList').classList.contains('nav-anim'), false);

  // Open Settings Bottom Sheet -> animates sheetLoadBar, #sheetOv backdrop, and #sheetSettings
  elements.get('gearMenuBtn').click();
  assert.equal(api.getState().activeSheet, 'settings');
  assert.equal(elements.get('sheetLoadBar').classList.contains('active'), true);
  assert.equal(elements.get('sheetOv').classList.contains('nav-entering'), true);
  assert.equal(elements.get('sheetSettings').classList.contains('nav-anim'), true);
  elements.get('sheetCloseBtn').click();

  // Start Game -> major transition pulses #stageTrans veil without blocking immediate play state
  elements.get('go').click();
  assert.equal(api.getState().mode, 'play');
  assert.equal(body.dataset.state, 'playing');
  assert.equal(elements.get('stageTrans').classList.contains('active'), true);

  // Reduced motion disables sweep, veil, and entrance animation classes
  const sRed = createDomSandbox({ rk_tut: '1' });
  sRed.sandbox.matchMedia = () => ({ matches: true });
  vm.runInNewContext(exportCode, sRed.sandbox);
  sRed.elements.get('missionBtn').click();
  assert.equal(sRed.elements.get('ovMissions').hidden, false);
  assert.equal(sRed.elements.get('menuLoadBar').classList.contains('active'), false);
  assert.equal(sRed.elements.get('ovMissions').classList.contains('nav-anim'), false);
});

test('dynamic weather transitions over run duration, intensifies fog/rain/difficulty, and renders safely', () => {
  const { sandbox, elements, body } = createDomSandbox({ rk_tut: '1' });
  const exportCode = js.replace(
    '})();',
    'this.__api={WEATHER_PHASES,getWeatherState,getDifficultyMod,startGame,update,render,obs,cns,rainDrops,setRunTime:(rt)=>{runTime=rt},getState:()=>({weatherId,weatherFog,weatherRain,weatherWind,stormFlash,runTime})};})();'
  );
  vm.runInNewContext(exportCode, sandbox);
  const api = sandbox.__api;

  // Pure weather cycle checks
  assert.equal(api.getWeatherState(0).id, 'cerah');
  assert.equal(api.getWeatherState(25).id, 'kabut');
  assert.equal(api.getWeatherState(50).id, 'hujan');
  assert.equal(api.getWeatherState(80).id, 'badai');
  assert.equal(api.getWeatherState(105).id, 'cerah');

  // Badai slightly raises difficulty above Cerah
  const dClear = api.getDifficultyMod(0);
  const dStorm = api.getDifficultyMod(80);
  assert.ok(dStorm.speedMult > dClear.speedMult);
  assert.ok(dStorm.freqMult > dClear.freqMult);

  api.startGame();
  assert.equal(body.dataset.weather, 'cerah');
  assert.equal(elements.get('hudWeather').textContent, '☀ Cerah');

  // Advance into Kabut (25s)
  api.setRunTime(25);
  for (let i = 0; i < 20; i++) {
    api.obs.length = 0;
    api.update(0.1);
    api.render();
  }
  assert.equal(api.getState().weatherId, 'kabut');
  assert.equal(body.dataset.weather, 'kabut');
  assert.equal(elements.get('hudWeather').textContent, '🌫 Kabut');
  assert.ok(api.getState().weatherFog > 0.4);

  // Advance into Hujan (50s) -> spawns rain drops & updates HUD
  api.setRunTime(50);
  for (let i = 0; i < 20; i++) {
    api.obs.length = 0;
    api.update(0.1);
    api.render();
  }
  assert.equal(api.getState().weatherId, 'hujan');
  assert.ok(api.getState().weatherRain > 0.4);
  assert.ok(api.rainDrops.length > 0);
  assert.equal(elements.get('hudWeather').textContent, '🌧 Hujan');

  // Advance into Badai (80s)
  api.setRunTime(80);
  for (let i = 0; i < 15; i++) {
    api.obs.length = 0;
    api.update(0.1);
    api.render();
  }
  assert.equal(api.getState().weatherId, 'badai');
  assert.equal(elements.get('hudWeather').textContent, '⛈ Badai');
});

test('cinematic camera banks on lane moves, zooms with speed/boost, and toggles cleanly via #camBtn', () => {
  const { sandbox, store, elements } = createDomSandbox({ rk_tut: '1' });
  const exportCode = js.replace(
    '})();',
    'this.__api={computeCameraTransform,startGame,move,update,render,getState:()=>({camMode,camRoll,camZoom,camPitch})};})();'
  );
  vm.runInNewContext(exportCode, sandbox);
  const api = sandbox.__api;

  assert.equal(api.getState().camMode, 'cinematic');
  assert.equal(elements.get('camBtn').textContent, 'Kamera: Sinematik');

  // Pure transform returns neutral values in classic or reduced-motion
  const classicT = api.computeCameraTransform({ camMode: 'classic', mode: 'play', lane: 2, px: 0, speed: 1200 });
  assert.deepEqual({ ...classicT }, { roll: 0, zoom: 1, pitchY: 0 });
  const redT = api.computeCameraTransform({ camMode: 'cinematic', reduce: true, mode: 'play', lane: 2, px: 0, speed: 1200 });
  assert.deepEqual({ ...redT }, { roll: 0, zoom: 1, pitchY: 0 });

  // Cinematic camera banks and zooms smoothly on lane switch while running
  api.startGame();
  api.move(1);
  api.update(0.05);
  api.render();
  const stCin = api.getState();
  assert.ok(Math.abs(stCin.camRoll) > 0, 'camRoll should bank toward new lane');
  assert.ok(stCin.camZoom > 1, 'camZoom should punch slightly in cinematic play mode');

  // Toggle to classic camera via Settings button -> persists rk_cam='classic' and resets transform
  elements.get('camBtn').click();
  assert.equal(api.getState().camMode, 'classic');
  assert.equal(store.get('rk_cam'), 'classic');
  assert.equal(elements.get('camBtn').textContent, 'Kamera: Klasik');
  for (let i = 0; i < 40; i++) api.update(0.05);
  assert.ok(Math.abs(api.getState().camRoll) < 0.001);
  assert.ok(Math.abs(api.getState().camZoom - 1) < 0.001);
});

test('interactive tutorial overlay shows first-run banner and lets new players practice lanes, jump/slide, items, and weather', () => {
  const { sandbox, store, elements } = createDomSandbox();
  const exportCode = js.replace(
    '})();',
    'this.__api={tutSim,getState:()=>({tutDone,tutOpen,tutStep,mode})};})();'
  );
  vm.runInNewContext(exportCode, sandbox);
  const api = sandbox.__api;

  // First launch shows interactive tutorial banner while keeping #tutOv hidden until triggered
  assert.equal(elements.get('tutFirstBanner').hidden, false);
  assert.equal(elements.get('tutOv').hidden, true);

  // Clicking #tutOpenMenuBtn launches interactive overlay at Step 1
  elements.get('tutOpenMenuBtn').click();
  assert.equal(api.getState().tutOpen, true);
  assert.equal(elements.get('tutOv').hidden, false);
  assert.equal(elements.get('tutActA').dataset.act, 'left');
  assert.equal(elements.get('tutActB').dataset.act, 'right');

  // Practice Step 1 (switch lanes)
  elements.get('tutActB').click();
  assert.equal(api.tutSim.lane, 2);
  assert.equal(api.tutSim.practiced[0], true);
  assert.ok(elements.get('tutTryStatus').textContent.includes('1/4 dilatih'));

  // Step 2: Practice Jump & Slide
  elements.get('tutNextBtn').click();
  elements.get('tutActA').click();
  assert.equal(api.tutSim.pose, 'jump');
  assert.equal(api.tutSim.practiced[1], true);
  elements.get('tutActB').click();
  assert.equal(api.tutSim.pose, 'slide');

  // Step 3: Practice Item activation (Skateboard / Rocket / x2)
  elements.get('tutNextBtn').click();
  assert.equal(elements.get('tutActC').hidden, false);
  elements.get('tutActB').click();
  assert.equal(api.tutSim.item, 'rocket');
  assert.equal(api.tutSim.practiced[2], true);

  // Step 4: Practice Coin combo & Weather preview, then launch run
  elements.get('tutNextBtn').click();
  elements.get('tutActA').click();
  elements.get('tutActB').click();
  assert.equal(api.tutSim.practiced[3], true);
  assert.ok(elements.get('tutTryStatus').textContent.includes('4/4 dilatih'));

  elements.get('tutNextBtn').click();
  assert.equal(store.get('rk_tut'), '1');
  assert.equal(elements.get('tutFirstBanner').hidden, true);
  assert.equal(api.getState().mode, 'play');
});

