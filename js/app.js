/* ═══════════════════════════════════════════════
   app.js — 연습 진행 상태기계
   대기 → 대기열 → 보안문자 → 회차 → 구역 → 좌석 → 결제 직전 → 분석
   ═══════════════════════════════════════════════ */
(function (TP) {

const u = TP.u, $ = u.$, T = TP.telemetry;
const TICK = 100;                 // 시뮬레이션 틱 (ms)

const App = {
  cfg: {
    concert: TP.CONCERTS[0],
    venue: TP.CONCERTS[0].venue,   // 홈에서 직접 고른다. 공연을 바꾸면 그 공연의 기본값으로 따라간다
    difficulty: TP.DIFFS[1],
    target: 'any',
    round: null,                  // 선택한 회차 (대기열 통과 후 결정)
    qty: 2,                       // 예매 매수
    opts: { captcha: true, errors: true, refreshLimit: true, countdown: true }
  },
  phase: 'home',
  running: false,

  /* ══════════════════════════════════════
     초기화 · 홈 화면
     ══════════════════════════════════════ */
  init() {
    this.renderHome();
    this.bindHome();
    this.bindMenu();
    this.bindGlobal();
    T.detectPointer();
    if (!T.hasMouse) {
      ui.toast('터치 환경으로 감지되었습니다.<br>마우스 관련 지표는 분석에서 제외됩니다.', 'warn', 5000);
    }
  },

  renderHome() {
    // 공연
    const cg = $('#concert-grid');
    cg.textContent = '';
    TP.CONCERTS.forEach(c => {
      const el = u.el('button.concert', { type: 'button', 'data-id': c.id });
      // 대기 화면 포스터와 gradient id 가 겹치지 않도록 인스턴스 구분자를 다르게 준다
      el.appendChild(u.el('div.c-art', { html: TP.posterSVG(c.id, 'card') }));
      const body = u.el('div.c-body');
      body.appendChild(u.el('div.c-name', { text: c.name }));
      // 공연장은 아래에서 따로 고르므로 여기서는 표기하지 않는다 (덮어쓰면 서로 어긋난다)
      body.appendChild(u.el('div.c-venue', { text: c.artist }));
      body.appendChild(u.el('div.c-venue', { text: c.date }));
      const tags = u.el('div.c-tags');
      c.tags.forEach(t => tags.appendChild(u.el('span.c-tag' + (t === 'HOT' ? '.hot' : ''), { text: t })));
      body.appendChild(tags);
      el.appendChild(body);
      el.addEventListener('click', () => {
        this.cfg.concert = c;
        // 공연을 바꾸면 공연장도 그 공연의 기본 공연장으로 따라간다 (원하면 아래에서 다시 고를 수 있다)
        this.cfg.venue = c.venue;
        u.$$('.concert').forEach(x => x.classList.toggle('on', x.dataset.id === c.id));
        this.paintVenues();
      });
      cg.appendChild(el);
    });
    cg.firstChild.classList.add('on');

    // 공연장
    const vg = $('#venue-grid');
    vg.textContent = '';
    TP.VENUE_LIST.forEach(key => {
      const v = TP.VENUES[key];
      let seats = 0;
      v.rows.forEach(row => row.forEach(z => { seats += z.r * z.c; }));
      const el = u.el('button.venue-pick', { type: 'button', 'data-venue': key });
      el.appendChild(u.el('div.vp-label', { text: v.label }));
      el.appendChild(u.el('div.vp-name', { text: v.name }));
      el.appendChild(u.el('div.vp-desc', { text: v.desc }));
      el.appendChild(u.el('div.vp-spec', {
        text: `${v.rows.length}개 층 · ${v.rows.reduce((a, r) => a + r.length, 0)}개 구역`
      }));
      el.addEventListener('click', () => {
        this.cfg.venue = key;
        this.paintVenues();
      });
      vg.appendChild(el);
    });
    this.paintVenues();

    // 난이도
    const dg = $('#diff-grid');
    dg.textContent = '';
    TP.DIFFS.forEach(d => {
      const el = u.el('button.diff', { type: 'button', 'data-id': d.id });
      const dots = u.el('div.d-dots');
      for (let i = 0; i < 4; i++) dots.appendChild(u.el('i' + (i < d.level ? '.f' : '')));
      el.appendChild(u.el('div.d-name', {}, [document.createTextNode(d.name), dots]));
      el.appendChild(u.el('div.d-desc', { text: d.desc }));
      el.appendChild(u.el('div.d-spec', {}, [
        u.el('span', { text: `동시접속 ${u.n(d.users)}명` }),
        u.el('span', { text: `총 ${u.n(d.seats)}석 · 약 ${u.dur(d.selloutSec)} 내 매진` })
      ]));
      el.addEventListener('click', () => {
        this.cfg.difficulty = d;
        u.$$('.diff').forEach(x => x.classList.toggle('on', x.dataset.id === d.id));
      });
      dg.appendChild(el);
    });
    dg.children[1].classList.add('on');

    // 목표
    const tg = $('#target-grid');
    tg.textContent = '';
    TP.TARGETS.forEach(t => {
      const el = u.el('button.target', { type: 'button', 'data-id': t.id, title: t.desc, text: t.label });
      el.addEventListener('click', () => {
        this.cfg.target = t.id;
        u.$$('.target').forEach(x => x.classList.toggle('on', x.dataset.id === t.id));
      });
      tg.appendChild(el);
    });
    tg.firstChild.classList.add('on');

    this.renderRecords();
  },

  paintVenues() {
    u.$$('.venue-pick').forEach(x => x.classList.toggle('on', x.dataset.venue === this.cfg.venue));
  },

  renderRecords() {
    const recs = TP.store.load();
    const box = $('#home-record');
    box.textContent = '';
    if (!recs.length) return;
    const ok = recs.filter(r => r.success).length;
    const rx = recs.map(r => r.reaction).filter(v => v != null && isFinite(v));
    const best = rx.length ? Math.min.apply(null, rx) : null;
    const avgScore = u.mean(recs.map(r => r.score)) || 0;
    const avgGrade = TP.TIER_NAMES[avgScore >= 85 ? 0 : avgScore >= 70 ? 1 : avgScore >= 55 ? 2 : avgScore >= 38 ? 3 : 4];

    const items = [
      ['연습 횟수', recs.length + '회'],
      ['성공률', Math.round(ok / recs.length * 100) + '%'],
      ['최고 반응속도', best == null ? '—' : u.ms(best)],
      ['평균 등급', avgGrade]
    ];
    const grid = u.el('div.rec-grid');
    items.forEach(([lab, val]) => grid.appendChild(u.el('div.rec-item', {}, [
      u.el('div.rec-val', { text: val }), u.el('div.rec-lab', { text: lab })
    ])));

    const clearBtn = u.el('button.btn-link', { type: 'button', text: '기록 초기화' });
    clearBtn.addEventListener('click', () => {
      TP.store.clear();
      this.renderRecords();
      ui.toast('기록을 삭제했습니다.', 'ok');
    });

    box.appendChild(u.el('div.rec-box', {}, [
      u.el('div.rec-head', {}, [u.el('h3', { text: '내 누적 기록' }), clearBtn]),
      grid
    ]));
  },

  bindHome() {
    $('#btn-start').addEventListener('click', () => this.start());

    const pn = $('#player-name');
    pn.value = TP.rank.player();
    pn.addEventListener('input', e => TP.rank.setPlayer(e.target.value.trim().slice(0, 12)));

    ['captcha', 'errors', 'refresh', 'countdown'].forEach(k => {
      const id = { captcha: 'opt-captcha', errors: 'opt-errors', refresh: 'opt-refresh', countdown: 'opt-countdown' }[k];
      $('#' + id).addEventListener('change', e => {
        this.cfg.opts[k === 'refresh' ? 'refreshLimit' : k] = e.target.checked;
      });
    });
  },

  /* ══════════════════════════════════════
     연습 모드 선택 메뉴 (햄버거)
     ══════════════════════════════════════ */
  bindMenu() {
    const btn = $('#btn-menu'), panel = $('#menu-panel'), back = $('#menu-backdrop');

    const setOpen = (on) => {
      btn.classList.toggle('open', on);
      btn.setAttribute('aria-expanded', on ? 'true' : 'false');
      panel.classList.toggle('hidden', !on);
      back.classList.toggle('hidden', !on);
      // 말풍선이 메뉴 패널과 같은 자리에 있어 열려 있는 동안만 비켜준다
      if (on) { this.paintMenu(); this.hideMenuHint(); }
      else if ($('#screen-home.active')) this.showMenuHint();
    };

    $('#btn-hint-close').onclick = () => this.hideMenuHint();
    this.showMenuHint();

    btn.onclick = () => setOpen(panel.classList.contains('hidden'));
    back.onclick = () => setOpen(false);
    window.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !panel.classList.contains('hidden')) setOpen(false);
    });

    u.$$('.menu-item', panel).forEach(item => {
      item.addEventListener('click', () => {
        setOpen(false);
        if (!this.leaveGuard()) return;
        const go = item.dataset.go;
        if (go === 'drill') TP.Drill.open();
        else this.goHome();
      });
    });
  },

  /* ─────────── 메뉴 안내 말풍선 ───────────
     홈 화면에서는 항상 띄운다. 한 번 봤다고 없애면 메뉴 위치를 다시 잊게 된다.
     연습 화면과 메뉴 패널을 가릴 때만 잠깐 숨긴다. */
  showMenuHint() {
    $('#menu-hint').classList.remove('hidden');
  },

  hideMenuHint() {
    $('#menu-hint').classList.add('hidden');
  },

  /** 지금 어느 모드에 있는지 표시. 화면 상태에서 직접 읽어 모듈 간 상태 공유를 피한다 */
  paintMenu() {
    const q = (sel) => !!document.querySelector(sel);
    const active =
      q('#screen-cd-setup.active, #screen-cd-run.active, #screen-cd-result.active') ? 'drill' : 'home';
    u.$$('.menu-item').forEach(i => i.classList.toggle('on', i.dataset.go === active));
  },

  /** 연습 중이면 확인을 받고 정리한다 */
  leaveGuard() {
    if (!this.running) return true;
    if (!confirm('진행 중인 연습을 중단하고 이동할까요?')) return false;
    this.abort();
    return true;
  },

  /** 결과를 내지 않고 진행 중인 판을 정리한다 */
  abort() {
    this.running = false;
    this.timerOn = false;
    this.stopLoop();
    T.stop();
    window.removeEventListener('pointerdown', this._earlyHandler);
    ui.loading(false);
    this.phase = 'home';
  },

  goHome() {
    if (TP.Drill) TP.Drill.stop();
    this.renderRecords();
    ui.topbar(false);
    ui.show('home');
    this.phase = 'home';
    this.showMenuHint();
  },

  bindGlobal() {
    // 실제 브라우저 새로고침은 연습 중 치명적이므로 가로채서 시뮬레이션 안에서 처리한다
    window.addEventListener('keydown', e => {
      if (!this.running) return;
      const isRefresh = e.key === 'F5' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'r');
      if (isRefresh) {
        e.preventDefault();
        this.doRefresh();
      }
    });
    window.addEventListener('beforeunload', e => {
      if (!this.running) return;
      e.preventDefault();
      e.returnValue = '';
    });
  },

  /* ══════════════════════════════════════
     연습 시작
     ══════════════════════════════════════ */
  start() {
    const d = this.cfg.difficulty;
    this.seed = (Date.now() ^ (Math.random() * 0xffffffff)) >>> 0;
    this.rng = TP.Rng(this.seed);
    this.cfg.users = d.users;

    this.cfg.round = null;
    this.cfg.qty = 2;

    this.server = TP.Server(this.cfg, this.rng);
    this.map = TP.SeatMap(this.cfg, this.rng);
    this.queue = TP.Queue(this.cfg, this.server, this.rng);

    this.run = {
      cfg: this.cfg, map: this.map,
      reactionMs: null, schedTimeMs: null, seatTimeMs: null, captchaMs: null,
      seatFails: 0, errorsHit: 0, peakLoad: 0,
      soldAtEntry: 0, aheadStart: 0, pushedBack: 0,
      seatCount: 0, price: 0, discount: null, payMethod: null,
      success: false, reason: 'fail', totalMs: 0
    };

    this.elapsed = 0;            // 오픈 이후 경과 (초)
    this.timeLeft = d.limitSec;  // 예매 제한시간
    this.timerOn = false;
    this.running = true;
    this.openAt = null;
    this.curZone = null;
    // 회차를 고르기 전에는 경쟁률 배수가 중립(1)이다
    this.roundHeat = 1;
    // 대기번호를 받기 전에는 대기열 압박도 중립(1)
    this.queueHeat = 1;
    this._selDate = null;

    // 이전 연습에서 남은 진행 플래그 초기화
    this._entering = false;
    this._finished = false;
    this._picking = false;
    this._qState = null;
    this._qPaint = 0;
    this._feedT = 0;
    $('#q-refresh-count').textContent = '';
    $('#live-feed-sch').textContent = '';
    $('#live-feed-zone').textContent = '';
    $('#live-feed-seat').textContent = '';

    T.start();
    T.log('연습 시작', 'info');
    // 연습 화면 위로 안내가 떠 있으면 방해된다. 홈으로 돌아오면 다시 띄운다.
    this.hideMenuHint();
    ui.topbar(true);
    this.startLoop();
    this.goStandby();
  },

  startLoop() {
    clearInterval(this._loop);
    let last = performance.now();
    this._loop = setInterval(() => {
      const now = performance.now();
      const dt = Math.min((now - last) / 1000, 0.5);
      last = now;
      this.tick(dt);
    }, TICK);
  },

  stopLoop() { clearInterval(this._loop); clearInterval(this._cdLoop); },

  /* ══════════════════════════════════════
     메인 틱
     ══════════════════════════════════════ */
  tick(dt) {
    if (!this.running) return;
    const p = this.phase;

    // 오픈 전에는 서버/좌석이 아직 움직이지 않는다
    if (p !== 'standby') {
      this.elapsed += dt;
      this.server.tick(dt);
      // 인기 회차를 고르거나 대기번호가 뒤쪽이면 같은 시간에 더 많이 팔려 있다
      this.map.advance(this.elapsed * this.roundHeat * this.queueHeat, dt);
      this.run.peakLoad = Math.max(this.run.peakLoad, this.server.load);
    }

    if (p === 'queue') this.tickQueue(dt);
    if (this.timerOn) {
      this.timeLeft -= dt;
      this.updateTimers();
      if (this.timeLeft <= 0) return this.finish(false, 'timeout');
    }

    // 좌석을 잡지 못한 채 전석 매진
    if ((p === 'queue' || p === 'schedule' || p === 'zone' || p === 'seat') &&
        this.map.available() === 0 && this.map.mine.length === 0) {
      return this.finish(false, 'soldout');
    }

    if (p === 'schedule') this.paintSchedule(true);
    if (p === 'zone') ui.updateVenue(this.map);
    if (p === 'seat' && this.curZone) ui.syncSeats(this.curZone);

    this.updateTopbar();
    this.tickFeed(dt);
  },

  updateTopbar() {
    $('#tb-clock').textContent = u.hhmmss(new Date());
    $('#tb-users').textContent = u.n(this.server.users);
    $('#tb-seats').textContent = u.n(this.map.available());
    const L = Math.round(this.server.load * 100);
    $('#tb-load').textContent = L + '%';
    const fill = $('#tb-loadfill');
    fill.style.width = L + '%';
    fill.className = 'load-fill' + (L > 85 ? ' high' : L > 60 ? ' mid' : '');
  },

  updateTimers() {
    const s = u.mmss(this.timeLeft);
    const urgent = this.timeLeft < 60;
    ['#sch-timer', '#zone-timer', '#seat-timer', '#captcha-timer', '#co-timer'].forEach(sel => {
      const el = $(sel);
      if (el) {
        el.textContent = s;
        if (el.parentElement) el.parentElement.classList.toggle('urgent', urgent);
      }
    });
  },

  /* ─────────── 실시간 피드 ─────────── */
  tickFeed(dt) {
    this._feedT = (this._feedT || 0) + dt;
    if (this._feedT < 0.65) return;
    this._feedT = 0;

    const r = this.rng;
    const sel = { schedule: '#live-feed-sch', zone: '#live-feed-zone', seat: '#live-feed-seat' }[this.phase];
    if (!sel) return;
    if (r.chance(0.25)) {
      const msgs = TP.FEED.sys;
      let m = r.pick(msgs)
        .replace('{ms}', Math.round(this.server.avgLatency()))
        .replace('{n}', u.n(this.server.users));
      ui.feed(sel, m);
    } else {
      const stats = this.map.zoneStats().filter(s => s.left > 0);
      if (!stats.length) return;
      const st = r.pick(stats);
      const seat = `${r.int(1, st.zone.rows)}열 ${r.int(1, st.zone.cols)}번`;
      let m = r.pick(TP.FEED.seat)
        .replace('{zone}', `<b>${st.zone.name}</b>`)
        .replace('{seat}', seat)
        .replace('{grade}', TP.GRADES[st.zone.grade].name)
        .replace('{n}', u.n(st.left));
      ui.feed(sel, m, st.ratio < 0.2);
    }
  },

  /* ══════════════════════════════════════
     1. 오픈 대기
     ══════════════════════════════════════ */
  goStandby() {
    this.phase = 'standby';
    ui.show('standby');
    const c = this.cfg.concert, d = this.cfg.difficulty;
    $('#sb-poster').innerHTML = TP.posterSVG(c.id, 'standby');
    $('#sb-title').textContent = c.name;
    $('#sb-meta').innerHTML =
      `${c.artist} · ${TP.venueOf(this.cfg).name}<br>${c.date}<br>` +
      `<span style="color:#6f7b90">난이도 ${d.name} · 예상 동시접속 ${u.n(d.users)}명 · 총 ${u.n(this.map.total)}석</span>`;

    const btn = $('#btn-book');
    btn.disabled = true;
    $('#sb-early').classList.add('hidden');

    let left = this.cfg.opts.countdown ? 10 : 0.4;
    const endAt = performance.now() + left * 1000;
    let early = 0;

    // disabled 버튼은 click 이벤트를 발생시키지 않으므로 좌표로 판정한다
    this._earlyHandler = (e) => {
      if (this.phase !== 'standby' || !btn.disabled) return;
      const r = btn.getBoundingClientRect();
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
        early++;
        T.count('earlyClick');
        const box = $('#sb-early');
        box.classList.remove('hidden');
        box.textContent = `아직 예매 시작 전입니다. (미리 누른 횟수 ${early}회) — 실제 예매처에서도 오픈 전 클릭은 무효입니다.`;
      }
    };
    window.addEventListener('pointerdown', this._earlyHandler);

    clearInterval(this._cdLoop);
    const paint = () => {
      const rem = Math.max(0, endAt - performance.now());
      const sec = Math.floor(rem / 1000);
      const ms = Math.floor(rem % 1000);
      $('#sb-count').textContent = u.mmss(rem / 1000);
      $('#sb-ms').textContent = '.' + String(ms).padStart(3, '0');
      $('#sb-count').classList.toggle('urgent', rem < 3000 && rem > 0);
      if (rem <= 0) {
        clearInterval(this._cdLoop);
        $('#sb-count').textContent = '00:00';
        $('#sb-ms').textContent = '.000';
        $('#sb-count').classList.remove('urgent');
        $('#sb-hint').textContent = '지금입니다.';
        btn.disabled = false;
        this.openAt = performance.now();
        T.mark('open');
        T.log('티켓 오픈', 'good');
      }
    };
    paint();
    this._cdLoop = setInterval(paint, 33);

    btn.onclick = () => this.onBook();
  },

  async onBook() {
    if (this.openAt == null) return;
    const btn = $('#btn-book');
    btn.disabled = true;
    window.removeEventListener('pointerdown', this._earlyHandler);

    const reaction = performance.now() - this.openAt;
    this.run.reactionMs = reaction;
    T.log(`예매 버튼 클릭 (${u.ms(reaction)})`, reaction < 500 ? 'good' : 'info');

    this.phase = 'connecting';
    await ui.request(this.server, { noFail: true, latencyMul: 1.4 }, '예매 페이지로 이동 중입니다...');
    if (!this.running) return;
    this.enterQueue(reaction);
  },

  /* ══════════════════════════════════════
     2. 대기열
     ══════════════════════════════════════ */
  enterQueue(reaction) {
    const ahead = this.queue.init(reaction);
    this.run.aheadStart = ahead;

    /* 대기번호가 좌석 소진 속도를 직접 끌어올린다.
       내 앞의 사람들이 지금 좌석을 가져가는 중이므로, 좌석 수 대비 앞사람이
       많을수록 내가 들어갔을 때 남아 있을 자리가 급격히 줄어든다.
       (제곱근을 쓰는 이유 — 선형이면 높은 난이도에서 항상 전석 매진이 된다) */
    const perSeat = ahead / Math.max(this.map.total, 1);
    this.queueHeat = 1 + Math.min(1.5, Math.sqrt(perSeat) * 0.8);
    this.run.queueHeat = this.queueHeat;
    this.run.aheadPerSeat = perSeat;

    this.phase = 'queue';
    ui.show('queue');
    T.mark('queueIn');
    T.log(`대기열 진입 — 내 앞 ${u.n(ahead)}명 (좌석 1석당 ${perSeat.toFixed(1)}명 경쟁)`,
      perSeat > 1 ? 'bad' : 'info');

    const press = $('#q-press');
    press.textContent = '1석당 ' + perSeat.toFixed(1) + '명';
    press.style.color = perSeat > 1.5 ? 'var(--accent)' : perSeat > 0.6 ? 'var(--amber)' : 'var(--green)';
    this.paintQueue();

    $('#btn-refresh').onclick = () => this.doRefresh();
    $('#btn-quit').onclick = () => {
      if (confirm('연습을 중단하고 지금까지의 기록을 분석할까요?')) this.finish(false, 'quit');
    };
  },

  tickQueue(dt) {
    this.queue.tick(dt);
    this._qPaint = (this._qPaint || 0) + dt;
    if (this._qPaint > 0.2) { this._qPaint = 0; this.paintQueue(); }
    if (this.queue.done && !this._entering) {
      this._entering = true;
      this.enterBooking();
    }
  },

  paintQueue() {
    const q = this.queue;
    $('#q-ahead').textContent = u.n(q.ahead);
    $('#q-total').textContent = u.n(q.total) + '명';
    $('#q-rate').textContent = u.n(Math.max(0, q.rate)) + '명/초';
    const eta = q.eta();
    $('#q-eta').textContent = eta == null ? '산정 불가' : u.dur(eta);

    const p = q.progress();
    $('#q-fill').style.width = (p * 100).toFixed(1) + '%';
    $('#q-pct').textContent = Math.floor(p * 100) + '%';

    const st = $('#q-status');
    const kind = q.state === 'stall' ? 'stall' : q.state === 'slow' ? 'slow' : 'normal';
    if (this._qState !== kind) {
      this._qState = kind;
      st.textContent = this.rng.pick(TP.QUEUE_MSG[kind]);
      st.className = 'q-status' + (kind === 'stall' ? ' bad' : kind === 'slow' ? ' warn' : '');
      if (kind === 'stall') T.log('대기열 처리 중단', 'bad');
    }
  },

  /** 새로고침 — 실제 예매처와 동일하게 순번이 초기화된다 */
  async doRefresh() {
    if (this.phase !== 'queue') {
      ui.toast('이 화면에서는 새로고침이 필요하지 않습니다.', 'warn');
      T.count('missClick');
      return;
    }
    const nowMs = performance.now();
    if (this.server.isBlocked(nowMs)) {
      ui.toast('접속이 차단된 상태입니다.', 'err');
      return;
    }

    T.count('refresh');
    const chk = this.server.registerRefresh(nowMs);
    const delta = this.queue.refresh();
    this.run.pushedBack = this.queue.pushedBack;
    T.log(`새로고침 — 순번 ${u.n(delta)}명 뒤로 밀림`, 'bad');
    this.paintQueue();

    $('#q-refresh-count').textContent = `새로고침 ${T.get('refresh')}회 · 누적 ${u.n(this.queue.pushedBack)}명 뒤로 밀림`;
    ui.toast(`새로고침으로 대기 순번이 <b>${u.n(delta)}명</b> 뒤로 밀렸습니다.`, 'err', 3600);

    if (chk.blocked) {
      T.count('blocked');
      T.log('과도한 새로고침으로 접속 차단', 'bad');
      await ui.block(chk.sec, '비정상적인 접근이 감지되었습니다',
        '짧은 시간에 반복된 요청이 확인되었습니다. 부정예매 방지 정책에 따라 일시적으로 접속이 제한됩니다.');
    }
  },

  /* ══════════════════════════════════════
     3. 예매 페이지 진입
     ══════════════════════════════════════ */
  async enterBooking() {
    if (!this.running) return;
    this.phase = 'connecting';
    const res = await ui.request(this.server, { riskMul: 1.6 }, '예매 페이지를 불러오는 중입니다...');
    if (!this.running) return;
    if (!res.ok) {
      this.run.errorsHit++;
      T.log(`오류: ${res.error.code}`, 'bad');
      ui.toast(res.error.msg, 'err', 3200);
      // 실패해도 대기열로 되돌아가지는 않는다. 다시 시도하면 된다.
      return this.enterBooking();
    }

    T.mark('booking');
    T.log(`예매 페이지 진입 — 대기열 통과`, 'good');
    this.timerOn = true;      // 여기서부터 예매 제한시간이 흐른다
    // 실제 예매처와 같은 순서 — 대기열을 통과하자마자 보안문자부터 확인한다.
    // 이 화면에 머무는 동안에도 좌석은 계속 팔린다.
    if (this.cfg.opts.captcha) this.goCaptcha();
    else this.goSchedule();
  },

  /* ══════════════════════════════════════
     4. 보안문자
     ══════════════════════════════════════ */
  goCaptcha() {
    this.phase = 'captcha';
    ui.show('captcha');
    T.mark('captchaIn');
    ui.captcha.draw(this.rng);
    const inp = $('#captcha-input');
    inp.value = '';
    inp.classList.remove('err');
    $('#captcha-msg').textContent = '';
    setTimeout(() => inp.focus(), 60);

    $('#btn-captcha-new').onclick = () => {
      ui.captcha.draw(this.rng);
      inp.value = '';
      inp.focus();
    };
    const submit = () => this.submitCaptcha();
    $('#btn-captcha-ok').onclick = submit;
    inp.onkeydown = e => { if (e.key === 'Enter') submit(); };
  },

  async submitCaptcha() {
    const inp = $('#captcha-input');
    if (!ui.captcha.check(inp.value)) {
      T.count('captchaFail');
      T.log('보안문자 오입력', 'bad');
      inp.classList.add('err');
      $('#captcha-msg').textContent = '입력하신 보안문자가 일치하지 않습니다.';
      setTimeout(() => inp.classList.remove('err'), 400);
      ui.captcha.draw(this.rng);
      inp.value = '';
      inp.focus();
      return;
    }
    this.run.captchaMs = T.since('captchaIn');
    const res = await ui.request(this.server, { riskMul: 0.7 }, '확인 중입니다...');
    if (!this.running) return;
    if (!res.ok) {
      this.run.errorsHit++;
      ui.toast(res.error.msg, 'err', 3000);
      return;
    }
    T.log(`보안문자 통과 (${u.ms(this.run.captchaMs)})`, 'good');
    this.goSchedule();
  },

  /** 선택한 회차의 회차명 — 여러 화면에서 같은 표기를 쓴다 */
  roundLabel() {
    const r = this.cfg.round;
    return r ? `${r.date} (${r.dow}) ${r.time}` : this.cfg.concert.date;
  },

  /* ══════════════════════════════════════
     5. 날짜 · 회차 선택
     ══════════════════════════════════════ */
  goSchedule() {
    this.phase = 'schedule';
    ui.show('schedule');
    T.mark('schedIn');

    const c = this.cfg.concert;
    $('#sch-title').textContent = c.name;
    this.cfg.round = null;
    this._selDate = null;

    /* 같은 날짜에 여러 회차가 있을 수 있으므로 날짜별로 묶는다 */
    const groups = [];
    c.schedule.forEach(r => {
      let g = groups.find(x => x.date === r.date);
      if (!g) groups.push(g = { date: r.date, dow: r.dow, rounds: [] });
      g.rounds.push(r);
    });

    const dbox = $('#sch-dates');
    dbox.textContent = '';
    groups.forEach(g => {
      const soldOut = g.rounds.every(r => r.sold);
      const parts = g.date.split('.');
      const btn = u.el('button.sch-date', { type: 'button', 'data-date': g.date });
      btn.disabled = soldOut;
      btn.appendChild(u.el('span.sd-dow' +
        (g.dow === '토' ? '.sat' : g.dow === '일' ? '.sun' : ''), { text: g.dow }));
      btn.appendChild(u.el('span.sd-day', { text: parts[2] }));
      btn.appendChild(u.el('span.sd-sub', {
        text: soldOut ? '매진' : `${Number(parts[1])}월 · ${g.rounds.length}회차`
      }));
      btn.addEventListener('click', () => this.pickDate(g));
      dbox.appendChild(btn);
    });

    $('#sch-rounds').innerHTML = '<p class="sch-empty">먼저 관람일을 선택해 주세요.</p>';

    const qbox = $('#qty-grid');
    qbox.textContent = '';
    for (let n = 1; n <= TP.QTY_MAX; n++) {
      const b = u.el('button.qty-btn', { type: 'button', 'data-qty': n, text: n + '매' });
      b.addEventListener('click', () => { this.cfg.qty = n; this.paintSchedule(); });
      qbox.appendChild(b);
    }

    $('#btn-sch-next').onclick = () => this.confirmSchedule();
    this.paintSchedule();
  },

  /** 이 회차를 골랐다면 지금 남아 있을 좌석 추정치.
      실제로 선택했을 때 적용되는 소진 곡선과 같은 식이라 표시와 결과가 어긋나지 않는다. */
  estLeft(round) {
    const d = this.cfg.difficulty;
    const frac = 1 - Math.exp(-4.2 * this.elapsed * round.heat * this.queueHeat / d.selloutSec);
    // 실제 남은 재고보다 많이 표시하지 않는다 — 경쟁률이 낮은 회차라도
    // 이미 팔려나간 좌석이 되살아나지는 않는다
    return Math.min(this.map.available(), Math.max(0, Math.round(this.map.total * (1 - frac))));
  },

  pickDate(g) {
    this._selDate = g;
    this.cfg.round = null;

    const box = $('#sch-rounds');
    box.textContent = '';
    g.rounds.forEach(r => {
      const btn = u.el('button.sch-round', { type: 'button', 'data-id': r.date + '|' + r.time });
      btn.appendChild(u.el('div.sr-time', { text: r.time }));
      btn.appendChild(u.el('div.sr-mid', {}, [
        u.el('div.sr-name', {}, [
          document.createTextNode(`${r.date} (${r.dow})`),
          r.tag ? u.el('span.sr-tag', { text: r.tag }) : null
        ]),
        u.el('div.sr-comp', {
          text: r.heat >= 1.25 ? '경쟁률 매우 높음'
              : r.heat >= 1.05 ? '경쟁률 높음'
              : r.heat >= 0.90 ? '경쟁률 보통' : '경쟁률 낮음'
        })
      ]));
      btn.appendChild(u.el('div.sr-right', {}, [
        u.el('div.sr-left'), u.el('div.sr-bar', {}, [u.el('i')])
      ]));
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        this.cfg.round = r;
        this.paintSchedule();
      });
      btn._round = r;
      box.appendChild(btn);
    });
    this.paintSchedule();
  },

  /**
   * 화면 상태 동기화.
   * @param {boolean} liveOnly 틱에서 호출될 때는 잔여석만 갱신한다 (선택 상태는 건드리지 않음)
   */
  paintSchedule(liveOnly) {
    const cfg = this.cfg;

    /* 회차별 잔여석 — 이 화면에 머무는 동안 계속 줄어든다 */
    u.$$('.sch-round').forEach(btn => {
      const r = btn._round;
      if (!r) return;
      const left = r.sold ? 0 : this.estLeft(r);
      const ratio = left / this.map.total;
      btn.disabled = r.sold || left === 0;
      const lab = btn.querySelector('.sr-left');
      lab.textContent = btn.disabled ? '매진' : `잔여 ${u.n(left)}석`;
      lab.className = 'sr-left' + (btn.disabled || ratio < 0.12 ? ' low' : ratio < 0.35 ? ' mid' : '');
      btn.querySelector('.sr-bar i').style.width = (ratio * 100).toFixed(1) + '%';
      // 보고 있던 회차가 매진되면 선택이 풀린다
      if (btn.disabled && cfg.round === r) {
        cfg.round = null;
        ui.toast('선택한 회차가 매진되었습니다.<br>다른 회차를 선택해 주세요.', 'err', 3000);
      }
    });

    if (!liveOnly) {
      u.$$('.sch-date').forEach(b =>
        b.classList.toggle('on', !!this._selDate && b.dataset.date === this._selDate.date));
    }
    u.$$('.sch-round').forEach(b =>
      b.classList.toggle('on', !!cfg.round && b.dataset.id === cfg.round.date + '|' + cfg.round.time));
    u.$$('.qty-btn').forEach(b => b.classList.toggle('on', Number(b.dataset.qty) === cfg.qty));

    const box = $('#sch-picked');
    box.textContent = '';
    if (!cfg.round) {
      box.appendChild(u.el('p.empty', { text: '회차를 선택해 주세요.' }));
    } else {
      [['공연', cfg.concert.name],
       ['장소', TP.venueOf(cfg).name],
       ['일시', this.roundLabel()],
       ['매수', cfg.qty + '매'],
       ['잔여', u.n(this.estLeft(cfg.round)) + '석']
      ].forEach(([k, v]) => box.appendChild(u.el('div.sp-row', {}, [
        u.el('span', { text: k }), u.el('b', { text: v })
      ])));
    }
    $('#btn-sch-next').disabled = !cfg.round;
  },

  async confirmSchedule() {
    const r = this.cfg.round;
    if (!r) return;

    // 지연 시간은 사용자 책임이 아니므로 요청 전에 기록한다
    this.run.schedTimeMs = T.since('schedIn');

    const res = await ui.request(this.server, { latencyMul: 0.8 }, '좌석 정보를 불러오는 중입니다...');
    if (!this.running) return;
    if (!res.ok) {
      this.run.errorsHit++;
      T.log(`오류: ${res.error.code}`, 'bad');
      ui.toast(res.error.msg, 'err', 3000);
      return;
    }

    // 이 회차의 경쟁률을 즉시 반영한다 (다음 틱을 기다리지 않는다)
    this.roundHeat = r.heat;
    this.map.advance(this.elapsed * this.roundHeat, 0);

    this.run.soldAtEntry = (this.map.total - this.map.available()) / this.map.total;
    T.log(`회차 선택 — ${this.roundLabel()} · ${this.cfg.qty}매 (${u.ms(this.run.schedTimeMs)})`,
      this.run.schedTimeMs < 5000 ? 'good' : 'info');
    T.log(`좌석 화면 진입 — 잔여 ${u.n(this.map.available())}석 (${Math.round((1 - this.run.soldAtEntry) * 100)}%)`,
      this.run.soldAtEntry > 0.85 ? 'bad' : 'good');

    this.goZone();
  },

  /* ══════════════════════════════════════
     6. 구역 선택
     ══════════════════════════════════════ */
  goZone() {
    this.phase = 'zone';
    ui.show('zone');
    const c = this.cfg.concert;
    $('#zone-title').textContent = c.name;
    $('#zone-sub').textContent =
      `${TP.venueOf(this.cfg).name} · ${this.roundLabel()} · ${this.cfg.qty}매 · 원하는 구역을 선택하세요`;
    ui.renderVenue(this.map, this.cfg, id => this.pickZone(id));
    ui.updateVenue(this.map);
  },

  async pickZone(id) {
    const zone = this.map.zone(id);
    const res = await ui.request(this.server, { latencyMul: 0.7 }, '좌석 정보를 불러오는 중입니다...');
    if (!this.running) return;
    if (!res.ok) {
      this.run.errorsHit++;
      T.log(`오류: ${res.error.code}`, 'bad');
      ui.toast(res.error.msg, 'err', 3000);
      return;
    }
    let left = 0;
    for (const s of zone.seats) if (s.state === 'available') left++;
    if (left === 0) {
      ui.toast('해당 구역은 매진되었습니다.', 'err');
      T.count('deadClick');
      return;
    }
    this.goSeat(zone);
  },

  /* ══════════════════════════════════════
     7. 좌석 선택
     ══════════════════════════════════════ */
  goSeat(zone) {
    this.phase = 'seat';
    this.curZone = zone;
    ui.show('seat');
    $('#seat-title').textContent = `${zone.name} · ${TP.GRADES[zone.grade].name} ${u.won(TP.GRADES[zone.grade].price)}`;
    T.mark('seatScreen');
    ui.renderSeats(zone, id => this.pickSeat(id));
    ui.renderPicked(this.map, this.cfg, seat => this.dropSeat(seat));

    $('#btn-back-zone').onclick = () => this.goZone();
    $('#btn-to-next').onclick = () => this.afterSeats();
  },

  async pickSeat(id) {
    const seat = this.map.byId[id];
    if (!seat) return;

    if (seat.state === 'mine') return this.dropSeat(seat);
    if (seat.state !== 'available') {
      ui.toast('<b>이미 선택된 좌석입니다.</b>', 'warn', 1600);
      return;
    }
    if (this.map.mine.length >= this.cfg.qty) {
      ui.toast(`${this.cfg.qty}매를 모두 선택했습니다.<br>바꾸려면 선택한 좌석을 다시 누르세요.`, 'warn');
      return;
    }
    if (this._picking) return;
    this._picking = true;

    // 인기 좌석은 내가 누르는 순간 경쟁자도 노린다
    const contested = this.map.contest(seat, this.server.load);

    const res = await ui.request(this.server, { latencyMul: 0.55, riskMul: 0.8 }, '좌석을 선점하는 중입니다...');
    this._picking = false;
    if (!this.running) return;

    if (!res.ok) {
      this.run.errorsHit++;
      T.count('seatFail');
      this.run.seatFails++;
      T.log(`좌석 선점 오류: ${res.error.code}`, 'bad');
      ui.toast(res.error.msg, 'err', 2800);
      return;
    }

    // 응답이 오는 사이 다른 사람이 가져갔을 수 있다
    if (contested && seat.state === 'available') this.map.snatch(seat);

    if (seat.state !== 'available') {
      this.run.seatFails++;
      T.count('seatFail');
      T.log(`좌석 선점 실패 — ${seat.zoneName} ${seat.label}`, 'bad');
      ui.toast('<b>이미 선택된 좌석입니다.</b><br>다른 좌석을 선택해 주세요.', 'err', 2600);
      return;
    }

    this.map.claim(seat);
    if (this.run.seatTimeMs == null) {
      this.run.seatTimeMs = T.since('seatScreen');
      T.log(`첫 좌석 확보 — ${seat.zoneName} ${seat.label} (${u.ms(this.run.seatTimeMs)})`, 'good');
    }
    ui.toast(`<b>${seat.zoneName} ${seat.label}</b> 좌석을 선점했습니다.`, 'ok', 1800);
    ui.renderPicked(this.map, this.cfg, s => this.dropSeat(s));
    ui.syncSeats(this.curZone);
  },

  dropSeat(seat) {
    this.map.unclaim(seat);
    T.log(`좌석 선택 해제 — ${seat.label}`, 'info');
    ui.renderPicked(this.map, this.cfg, s => this.dropSeat(s));
    if (this.curZone) ui.syncSeats(this.curZone);
  },

  async afterSeats() {
    if (!this.map.mine.length) return;
    const res = await ui.request(this.server, {}, '좌석을 확정하는 중입니다...');
    if (!this.running) return;
    if (!res.ok) {
      this.run.errorsHit++;
      ui.toast(res.error.msg, 'err', 3000);
      return;
    }
    T.log(`좌석 확정 ${this.map.mine.length}매`, 'good');
    this.goCheckout();
  },

  /* ══════════════════════════════════════
     8. 결제 직전
     ══════════════════════════════════════ */
  goCheckout() {
    this.phase = 'checkout';
    ui.show('checkout');
    T.mark('checkoutIn');
    T.log('결제 화면 진입', 'good');

    const c = this.cfg.concert, mine = this.map.mine;
    const base = mine.reduce((a, s) => a + s.price, 0);
    this.run.seatCount = mine.length;

    $('#co-info').innerHTML = [
      ['공연명', c.name],
      ['일시', this.roundLabel()],
      ['장소', TP.venueOf(this.cfg).name],
      ['좌석', mine.map(s => `${s.zoneName} ${s.label}`).join(', ')],
      ['매수', `${mine.length}매`]
    ].map(([k, v]) => `<div class="co-row"><span>${k}</span><b>${v}</b></div>`).join('');

    const discounts = [
      { id: 'none', label: '할인 없음', rate: 0 },
      { id: 'youth', label: '청소년 할인', rate: .2 },
      { id: 'senior', label: '경로 할인', rate: .3 },
      { id: 'disabled', label: '장애인 동반 1인', rate: .5 }
    ];
    const pays = TP.PAY_METHODS;

    let disc = discounts[0], pay = null, paySub = null, agreed = false;

    const render = () => {
      const off = Math.round(base * disc.rate);
      const total = base - off;
      this.run.price = total;
      this.run.discount = disc.id;
      this.run.payMethod = pay ? pay.id : null;
      this.run.payDetail = paySub;
      $('#co-sum').innerHTML =
        `<div><span>티켓 금액 (${mine.length}매)</span><b>${u.won(base)}</b></div>` +
        (off ? `<div class="disc"><span>${disc.label}</span><b>-${u.won(off)}</b></div>` : '') +
        `<div><span>예매 수수료</span><b>${u.won(0)}</b></div>` +
        (paySub ? `<div><span>${pay.label}</span><b>${paySub}</b></div>` : '');
      $('#co-total').textContent = u.won(total);
      // 카드사·은행까지 골라야 결제가 열린다
      $('#btn-pay').disabled = !(pay && paySub && agreed);
    };

    /** 결제 수단 하위 선택 (카드사 · 간편결제사 · 은행) */
    const buildPaySub = (method) => {
      const box = $('#co-pay-sub');
      box.textContent = '';
      paySub = null;
      if (!method) return;

      box.appendChild(u.el('div.co-sub-h', { text: method.subLabel }));
      const grid = u.el('div.co-sub-grid');
      (TP.PAY_SUBS[method.id] || []).forEach(name => {
        const b = u.el('button.pay-sub', { type: 'button', 'data-name': name, text: name });
        b.addEventListener('click', () => {
          paySub = name;
          u.$$('.pay-sub', grid).forEach(x => x.classList.toggle('on', x.dataset.name === name));
          render();
        });
        grid.appendChild(b);
      });
      box.appendChild(grid);

      if (method.id === 'vbank') {
        box.appendChild(u.el('p.co-sub-note', {
          text: '입금 기한 내에 입금하지 않으면 예매가 자동 취소됩니다.'
        }));
      }
    };

    const buildChoices = (sel, list, cur, onPick, val) => {
      const box = $(sel);
      box.textContent = '';
      list.forEach(item => {
        const el = u.el('button.co-choice', { type: 'button', 'data-id': item.id });
        el.appendChild(u.el('span.cc-radio'));
        el.appendChild(u.el('span.cc-label', { text: item.label }));
        if (val) el.appendChild(u.el('span.cc-val', { text: val(item) }));
        el.addEventListener('click', () => {
          onPick(item);
          u.$$('.co-choice', box).forEach(x => x.classList.toggle('on', x.dataset.id === item.id));
          render();
        });
        box.appendChild(el);
      });
      if (cur) u.$$('.co-choice', box).forEach(x => x.classList.toggle('on', x.dataset.id === cur.id));
    };

    buildChoices('#co-discounts', discounts, disc, d => { disc = d; },
      d => d.rate ? `-${Math.round(d.rate * 100)}%` : '');
    buildChoices('#co-pays', pays, null, p => { pay = p; buildPaySub(p); });
    $('#co-pay-sub').textContent = '';

    const chk = $('#co-agree-chk');
    chk.checked = false;
    chk.onchange = e => { agreed = e.target.checked; render(); };

    $('#btn-pay').onclick = () => this.pay();
    render();
  },

  async pay() {
    const res = await ui.request(this.server, { latencyMul: 1.2, riskMul: 0.6 }, '결제 요청을 처리하는 중입니다...');
    if (!this.running) return;
    if (!res.ok) {
      this.run.errorsHit++;
      ui.toast(res.error.msg, 'err', 3000);
      return;
    }
    T.log('결제 직전 단계 도달', 'good');
    this.finish(true, 'success');
  },

  /* ══════════════════════════════════════
     종료 · 분석
     ══════════════════════════════════════ */
  finish(success, reason) {
    if (this._finished) return;
    this._finished = true;
    this.running = false;
    this.timerOn = false;
    this.stopLoop();
    T.stop();
    window.removeEventListener('pointerdown', this._earlyHandler);
    ui.loading(false);

    const r = this.run;
    r.success = success;
    r.reason = reason;
    r.totalMs = T.now();
    r.avgLatency = this.server.avgLatency();
    r.pushedBack = this.queue.pushedBack;
    r.seatCount = this.map.mine.length;
    // 회차를 고르는 중에 끝난 경우에도 판매율은 남긴다
    if (!r.soldAtEntry) r.soldAtEntry = (this.map.total - this.map.available()) / this.map.total;
    if (!r.price) r.price = this.map.mine.reduce((a, s) => a + s.price, 0);
    T.log(success ? '예매 성공' : '연습 종료', success ? 'good' : 'bad');

    const analysis = TP.analyze(r);

    // 이번 판을 저장하기 전에 읽어야 "지난 기록"과 비교할 수 있다
    const history = TP.store.load();
    const player = TP.rank.player();
    const ranking = TP.rank.evaluate({
      player: player,
      difficulty: this.cfg.difficulty.name,
      reactionMs: r.reactionMs,
      seatTimeMs: r.seatTimeMs,
      score: analysis.overallScore,
      history: history
    });

    TP.store.save({
      at: Date.now(),
      player: player,
      concert: this.cfg.concert.name,
      difficulty: this.cfg.difficulty.name,
      round: this.cfg.round ? this.roundLabel() : null,
      qty: this.cfg.qty,
      success: success,
      reason: reason,
      reaction: r.reactionMs,
      schedTime: r.schedTimeMs,
      seatTime: r.seatTimeMs,
      score: analysis.overallScore,
      grade: analysis.grade
    });

    this.phase = 'result';
    ui.topbar(false);
    this.renderResult(analysis, r, ranking, {
      nick: player,
      difficulty: this.cfg.difficulty.name,
      reactionMs: r.reactionMs,
      seatTimeMs: r.seatTimeMs,
      score: analysis.overallScore,
      success: success
    });
    ui.show('result');
  },

  /* ─────────── 기록 랭킹 ───────────
     비교 대상은 이 브라우저에 실제로 저장된 연습 결과뿐이다.
     가상 경쟁자를 만들어 넣지 않으므로, 기록이 하나면 순위도 1/1 이다. */
  renderRank(wrap, rank, H) {
    const pctBlock = rank.topPct == null ? '' : `
      <div class="rk-pct">상위 <b>${TP.rank.fmtPct(rank.topPct)}%</b></div>
      <div class="rk-gauge"><i style="width:${u.clamp(rank.topPct, 2, 100).toFixed(1)}%"></i></div>
      <div class="rk-scale"><span>1위</span><span>${u.n(rank.total)}위</span></div>`;

    const sec = H(`
      <div class="rs-section">
        <h3>기록 랭킹</h3>
        <div class="rk-hero">
          <div class="rk-main">
            <div class="rk-lab">이번 기록 순위</div>
            <div class="rk-rank"><b>${u.n(rank.rank)}</b><span>/ ${u.n(rank.total)}위</span></div>
            <div class="rk-of">저장된 실제 기록 ${u.n(rank.total)}개 기준</div>
          </div>
          <div class="rk-side">
            ${pctBlock}
            <p class="rk-head">${rank.headline}</p>
            <p class="rk-beat">
              반응속도 <b>${u.ms(rank.value)}</b>
              · 플레이어 ${u.n(rank.playerRank)}/${u.n(rank.playerCount)}위
              (${rank.player})
            </p>
          </div>
        </div>
        <div class="rk-two">
          <div class="rs-card">
            <canvas id="rktrend"></canvas>
            <p class="m-note">
              ${rank.trend.length > 1
                ? `<b>${rank.player}</b>님의 실제 반응속도 기록 ${u.n(rank.trend.length)}판입니다.
                   빨간 점이 이번 판, 초록 점선이 개인 최고 기록입니다.`
                : '아직 기록이 이번 판 하나뿐입니다. 다시 연습하면 여기에 추이가 쌓입니다.'}
            </p>
          </div>
          <div class="rk-boardwrap">
            <div class="rk-boardhead">플레이어별 최고 기록</div>
            <div class="rk-board" id="rk-board"></div>
            <p class="rk-boardnote">
              홈 화면에서 <b>플레이어 이름</b>을 바꿔 저장하면 같은 기기에서 여러 명이 겨룰 수 있습니다.
              인터넷 전체 랭킹은 서버가 필요합니다.
            </p>
          </div>
        </div>
      </div>`);
    wrap.appendChild(sec);

    const bd = $('#rk-board', sec);
    rank.players.forEach(p => {
      bd.appendChild(H(`
        <div class="rk-row${p.me ? ' me' : ''}">
          <span class="rk-r">${u.n(p.rank)}위</span>
          <span class="rk-n">${p.player}${p.isCurrentRun ? '<em class="rk-new">NEW</em>' : ''}</span>
          <span class="rk-sub">${u.n(p.runs)}판</span>
          <span class="rk-t">${u.ms(p.ms)}</span>
        </div>`));
    });

    ui.trendChart($('#rktrend', sec), rank.trend);

    /* 다른 지표를 내 과거 기록과 비교 — 전부 실제 값이다 */
    if (rank.compare.length) {
      const bs = H(`<div class="rk-bars"></div>`);
      rank.compare.forEach(c => {
        const fmt = v => c.lower ? u.ms(v) : Math.round(v) + '점';
        bs.appendChild(H(`
          <div class="rk-bar">
            <div class="rk-bar-top">
              <span>${c.label}</span>
              <b class="${c.improved ? 'up' : ''}">${fmt(c.value)}</b>
            </div>
            <div class="rk-bar-note">
              내 최고 ${fmt(c.best)} · 지난 평균 ${fmt(c.avg)}
              ${c.improved ? '<b class="up">· 최고 기록 경신</b>' : ''}
            </div>
          </div>`));
      });
      sec.appendChild(bs);
    }

    /* 내 지난 기록과의 비교 */
    const s = rank.self;
    if (s && !s.first) {
      const d = s.delta;
      const txt = d == null ? '' :
        d < -5 ? `최근 ${s.recentCount}회 평균보다 <b class="up">${u.ms(-d)} 빨라졌습니다</b>` :
        d > 5  ? `최근 ${s.recentCount}회 평균보다 <b class="down">${u.ms(d)} 느려졌습니다</b>` :
                 '최근 평균과 거의 같습니다';
      sec.appendChild(H(`
        <div class="rk-hist${s.isBest ? ' best' : ''}">
          <b>${s.isBest ? '개인 최고 기록 경신' : '내 기록 추이'}</b>
          <span>${rank.player} · 연습 ${u.n(s.runs)}회 · 이전 최고 ${u.ms(s.prevBest)} —
                ${txt}</span>
        </div>`));
    } else {
      sec.appendChild(H(`
        <div class="rk-hist">
          <b>첫 기록 저장</b>
          <span>${rank.player}님의 첫 연습입니다. 반복해서 연습하면 이 자리에 개인 최고 기록과 추이가 표시됩니다.</span>
        </div>`));
    }
  },

  renderResult(a, run, rank, lbInfo) {
    const wrap = $('#result-wrap');
    wrap.textContent = '';
    const H = (html) => { const d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; };

    /* 헤더 */
    wrap.appendChild(H(`
      <div class="rs-hero">
        <div class="rs-verdict">연습 결과</div>
        <div class="rs-outcome ${a.outcome.success ? 'ok' : 'fail'}">${a.outcome.title}</div>
        <div class="rs-desc">${a.outcome.desc}</div>
        <div class="rs-gradewrap">
          <div class="rs-grade" style="color:${TP.TIER_COLOR[a.gradeIdx]};border-color:${TP.TIER_COLOR[a.gradeIdx]}55">
            ${a.grade}<small>OVERALL</small>
          </div>
          <div class="rs-gradetext">
            <h3>${a.gradeText.title} · ${Math.round(a.overallScore)}점</h3>
            <p>${a.gradeText.body}</p>
          </div>
        </div>
      </div>`));

    /* 요약 */
    const secs = (run.totalMs / 1000);
    wrap.appendChild(H(`
      <div class="rs-section">
        <h3>한눈에 보기</h3>
        <p class="rs-meta">${this.cfg.concert.name} · ${this.roundLabel()} · ${this.cfg.qty}매 희망 · 난이도 ${this.cfg.difficulty.name}</p>
        <div class="rec-grid">
          <div class="rec-item"><div class="rec-val">${u.ms(run.reactionMs)}</div><div class="rec-lab">반응속도</div></div>
          <div class="rec-item"><div class="rec-val">${u.n(run.aheadStart)}</div><div class="rec-lab">대기 순번</div></div>
          <div class="rec-item"><div class="rec-val">${run.aheadPerSeat == null ? '—' : run.aheadPerSeat.toFixed(1)}</div><div class="rec-lab">좌석당 경쟁자</div></div>
          <div class="rec-item"><div class="rec-val">${Math.round(run.soldAtEntry * 100)}%</div><div class="rec-lab">진입 시 판매율</div></div>
          <div class="rec-item"><div class="rec-val">${run.seatCount}매</div><div class="rec-lab">확보 좌석</div></div>
          <div class="rec-item"><div class="rec-val">${u.dur(secs)}</div><div class="rec-lab">총 소요시간</div></div>
        </div>
      </div>`));

    /* 기록 랭킹 — 실제 저장된 기록만 비교한다 (이 브라우저 안에서) */
    if (rank && rank.measured) this.renderRank(wrap, rank, H);

    /* 온라인 랭킹 — Supabase 연결이 있어야 다른 사람과 비교된다.
       연결이 없으면 박스 안에서 연결 안내가 뜬다. */
    if (lbInfo && lbInfo.reactionMs != null && isFinite(lbInfo.reactionMs) && TP.Leaderboard) {
      const lbSec = H(`<div class="rs-section"><h3>온라인 랭킹</h3><div class="lb-box" id="lb-box"></div></div>`);
      wrap.appendChild(lbSec);
      TP.Leaderboard.render($('#lb-box', lbSec), lbInfo);
    }

    /* 레이더 + 지표 */
    const two = H(`
      <div class="rs-section">
        <h3>지표 분석</h3>
        <div class="rs-two">
          <div class="rs-card" style="display:grid;place-items:center"><canvas id="radar"></canvas></div>
          <div class="metric-list" id="metric-list"></div>
        </div>
      </div>`);
    wrap.appendChild(two);

    const ml = $('#metric-list', two);
    a.metrics.forEach(m => {
      const tierName = m.tier == null ? '—' : TP.TIER_NAMES[m.tier];
      const color = m.tier == null ? '#6f7b90' : TP.TIER_COLOR[m.tier];
      ml.appendChild(H(`
        <div class="metric">
          <div class="m-top">
            <span class="m-name">${m.label}</span>
            <span class="m-tier ${m.tier == null ? '' : TP.TIER_CLASS[m.tier]}">${tierName}</span>
            <span class="m-val" style="color:${color}">${m.display}</span>
          </div>
          <div class="m-track"><div class="m-bar" style="width:${m.score == null ? 0 : m.score}%;background:${color}"></div></div>
          <div class="m-note">${m.desc} <span style="color:#8b95a7">목표: ${m.target}</span></div>
        </div>`));
    });
    ui.radar($('#radar', two), a.radar);

    /* 피드백 */
    const fbSec = H(`<div class="rs-section"><h3>개선 피드백</h3><div class="fb-list" id="fb-list"></div></div>`);
    wrap.appendChild(fbSec);
    const fl = $('#fb-list', fbSec);
    a.feedbacks.forEach(f => {
      fl.appendChild(H(`
        <div class="fb ${f.kind}">
          <div class="fb-icon">${f.icon}</div>
          <div class="fb-body">
            <h4>${f.title}</h4>
            <p>${f.body}</p>
            ${f.drill ? `<div class="fb-drill">${f.drill}</div>` : ''}
          </div>
        </div>`));
    });

    /* 마우스 경로 */
    if (a.stats.hasMouse && T.path.length > 5) {
      const mp = H(`
        <div class="rs-section">
          <h3>커서 이동 궤적</h3>
          <div class="rs-card">
            <canvas class="mouse-path" id="mpath"></canvas>
            <p class="m-note" style="margin-top:10px">
              총 이동거리 <b style="color:#e9edf5">${u.n(T.moveDist)}px</b> ·
              클릭 ${a.stats.totalClicks}회
              (<span style="color:#22c98f">●</span> 유효
               <span style="color:#ffb020">●</span> 판매완료 좌석
               <span style="color:#ff4757">●</span> 헛클릭)
              — 선 색이 파랑에서 빨강으로 갈수록 나중에 지나간 경로입니다.
            </p>
          </div>
        </div>`);
      wrap.appendChild(mp);
      ui.mousePath($('#mpath', mp), T.path, T.clicks);
    }

    /* 타임라인 */
    const tlSec = H(`<div class="rs-section"><h3>진행 타임라인</h3><div class="rs-timeline" id="tl"></div></div>`);
    wrap.appendChild(tlSec);
    const tl = $('#tl', tlSec);
    a.timeline.forEach((e, i) => {
      const next = a.timeline[i + 1];
      const dur = next ? next.t - e.t : null;
      tl.appendChild(H(`
        <div class="tl ev-${e.kind}">
          <div class="tl-time">+${(e.t / 1000).toFixed(1)}s</div>
          <div class="tl-dot"></div>
          <div class="tl-name">${e.name}</div>
          <div class="tl-dur">${dur == null ? '' : u.ms(dur)}</div>
        </div>`));
    });

    /* 액션 */
    const act = H(`<div class="rs-actions">
        <button class="btn-primary" id="btn-again">같은 조건으로 다시 연습</button>
        <button class="btn-ghost" id="btn-home">설정 바꾸기</button>
      </div>`);
    wrap.appendChild(act);
    $('#btn-again', act).onclick = () => this.start();
    $('#btn-home', act).onclick = () => this.goHome();
  }
};

const ui = TP.ui;
TP.App = App;
document.addEventListener('DOMContentLoaded', () => App.init());

})(window.TP);
