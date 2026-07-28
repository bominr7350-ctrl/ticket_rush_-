/* ═══════════════════════════════════════════════
   drill.js — 보안문자 집중 연습 (TicketRush 내부 모드)

   전체 연습에서 보안문자는 한 판에 한 번만 나온다. 그래서 이 구간만
   따로 반복하는 모드를 같은 사이트 안에 둔다. 홈 화면 버튼으로 들어간다.

   보안문자 렌더링은 js/captcha.js 를 전체 연습과 공유하므로
   여기서 익힌 감각이 실전 흐름과 어긋나지 않는다.

   화면 전환은 앱의 TP.ui.show() 를 그대로 쓴다 (screen-cd-*).
   요소 id 는 전체 연습의 보안문자 화면(#captcha-*)과 겹치지 않게 cd- 접두사를 쓴다.

   측정
     문제별 소요시간 = 문자가 그려진 순간부터 정답 제출까지.
     오답이 나도 타이머는 계속 간다 (실제로도 다시 입력하는 시간이 손해다).
   ═══════════════════════════════════════════════ */
(function (TP) {

const u = TP.u, $ = u.$;

/* 문제 하나당 소요시간 등급 경계(ms).
   전체 연습의 보안문자 지표(3000/5000/8000/13000)보다 빡빡하다 —
   화면을 읽고 찾는 시간이 빠지고 순수하게 보고 타이핑하는 시간만 재기 때문이다. */
const TIERS = [
  { max: 2000, grade: 'S', name: '눈으로 바로 읽는다',
    body: '보면서 그대로 타이핑하는 감각이 완성됐습니다. 실전에서 이 구간은 더 줄일 여지가 없습니다.' },
  { max: 3000, grade: 'A', name: '실전에서 통하는 속도',
    body: '이 정도면 보안문자에서 좌석을 놓치지 않습니다. 남은 건 반응속도와 좌석 판단입니다.' },
  { max: 4500, grade: 'B', name: '한 박자 읽고 있다',
    body: '문자를 확인한 뒤에 손이 움직이고 있습니다. 확인과 입력을 겹치는 연습이 필요합니다.' },
  { max: 6500, grade: 'C', name: '외운 뒤 입력하는 습관',
    body: '전체를 외우고 나서 타이핑하면 두 배로 느려집니다. 한 글자씩 보고 바로 치세요.' },
  { max: Infinity, grade: 'D', name: '기초부터',
    body: '먼저 쉬움 난이도로 글자 모양에 익숙해지세요. 속도는 그다음입니다.' }
];

const LEVEL_META = [
  { id: 'easy',   name: '쉬움',   desc: '4자 · 왜곡이 약해 글자가 또렷합니다.' },
  { id: 'normal', name: '보통',   desc: '5자 · 실제 예매처와 같은 수준입니다.' },
  { id: 'hard',   name: '어려움', desc: '6자 · 회전과 잡선이 심해 눈이 헤맵니다.' }
];

const COUNTS = [5, 9, 15, 20];
const STORE_KEY = 'ticketrush.captchaDrill.v1';

const Drill = {

  // count 는 반드시 COUNTS 안의 값이어야 한다 (아니면 아무 버튼도 선택돼 보이지 않는다)
  cfg: { level: 'normal', count: 9 },

  /* ─────────── 진입 · 이탈 ─────────── */
  init() {
    // 모드 진입은 상단 메뉴(app.js 의 bindMenu)가 담당한다
    const home = $('#btn-cd-home');
    if (home) home.onclick = () => this.exit();

    $('#btn-cd-start').onclick = () => this.start();
    $('#btn-cd-ok').onclick = () => this.submit();
    $('#btn-cd-skip').onclick = () => this.skip();
    $('#btn-cd-quit').onclick = () => {
      if (!this.results.length) return this.backToSetup();
      if (confirm('연습을 중단하고 여기까지의 기록을 볼까요?')) this.finish(true);
    };
    $('#cd-input').onkeydown = e => { if (e.key === 'Enter') this.submit(); };
  },

  open() {
    TP.ui.topbar(false);          // 전체 연습용 상단 상태바는 이 모드에서 쓰지 않는다
    this.buildSetup();
    this.renderRecords();
    TP.ui.show('cd-setup');
  },

  exit() {
    this.stop();
    if (TP.App && TP.App.goHome) TP.App.goHome();
    else TP.ui.show('home');
  },

  backToSetup() {
    this.stop();
    this.renderRecords();
    TP.ui.show('cd-setup');
  },

  stop() {
    this.running = false;
    clearInterval(this._tick);
  },

  /* ─────────── 설정 화면 ─────────── */
  buildSetup() {
    if (this._built) { this.paint(); return; }
    this._built = true;

    const lg = $('#cd-lv-grid');
    lg.textContent = '';
    LEVEL_META.forEach(L => {
      const spec = TP.Captcha.LEVELS[L.id];
      const el = u.el('button.diff', { type: 'button', 'data-lv': L.id });
      el.appendChild(u.el('div.d-name', { text: L.name }));
      el.appendChild(u.el('div.d-desc', { text: L.desc }));
      el.appendChild(u.el('div.d-spec', {}, [
        u.el('span', { text: `${spec.len}자` }),
        u.el('span', { text: `잡선 ${spec.lines} · 잡점 ${spec.dots}` })
      ]));
      el.addEventListener('click', () => { this.cfg.level = L.id; this.paint(); this.renderRecords(); });
      lg.appendChild(el);
    });

    const cg = $('#cd-cnt-grid');
    cg.textContent = '';
    COUNTS.forEach(n => {
      const b = u.el('button.qty-btn', { type: 'button', 'data-cnt': n, text: n + '문제' });
      b.addEventListener('click', () => { this.cfg.count = n; this.paint(); });
      cg.appendChild(b);
    });

    this.paint();
  },

  paint() {
    u.$$('#cd-lv-grid .diff').forEach(x => x.classList.toggle('on', x.dataset.lv === this.cfg.level));
    u.$$('#cd-cnt-grid .qty-btn').forEach(x => x.classList.toggle('on', Number(x.dataset.cnt) === this.cfg.count));
  },

  /* ─────────── 누적 기록 ─────────── */
  load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || []; }
    catch (e) { return []; }
  },
  save(rec) {
    const all = this.load();
    all.unshift(rec);
    try { localStorage.setItem(STORE_KEY, JSON.stringify(all.slice(0, 50))); } catch (e) {}
  },

  renderRecords() {
    const box = $('#cd-record');
    box.textContent = '';
    const recs = this.load();
    if (!recs.length) return;

    const lvName = LEVEL_META.find(l => l.id === this.cfg.level).name;
    const same = recs.filter(r => r.level === this.cfg.level);
    const best = same.length ? Math.min.apply(null, same.map(r => r.avg)) : null;

    const items = [
      ['연습 횟수', recs.length + '회'],
      ['총 문제', u.n(recs.reduce((a, r) => a + r.count, 0)) + '문제'],
      ['최고 평균', best == null ? '—' : (best / 1000).toFixed(2) + '초'],
      ['최근 정확도', Math.round(recs[0].acc) + '%']
    ];
    const grid = u.el('div.rec-grid');
    items.forEach(([lab, val]) => grid.appendChild(u.el('div.rec-item', {}, [
      u.el('div.rec-val', { text: val }), u.el('div.rec-lab', { text: lab })
    ])));

    const clear = u.el('button.btn-link', { type: 'button', text: '기록 초기화' });
    clear.addEventListener('click', () => {
      try { localStorage.removeItem(STORE_KEY); } catch (e) {}
      this.renderRecords();
      TP.ui.toast('보안문자 연습 기록을 삭제했습니다.', 'ok');
    });

    box.appendChild(u.el('div.rec-box', {}, [
      u.el('div.rec-head', {}, [
        u.el('h3', { text: `내 누적 기록 (최고 평균은 ${lvName} 기준)` }),
        clear
      ]),
      grid
    ]));
  },

  /* ─────────── 연습 진행 ─────────── */
  start() {
    this.rng = TP.Rng((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0);
    this.idx = 0;
    this.results = [];
    this.answer = '';
    this.qStart = 0;
    this.qMiss = 0;
    this.running = true;

    $('#cd-log').textContent = '';
    TP.ui.show('cd-run');
    this.startTicker();
    this.nextQuestion();
  },

  startTicker() {
    clearInterval(this._tick);
    this._tick = setInterval(() => {
      if (!this.running || !this.qStart) return;
      $('#cd-elapsed').textContent = ((performance.now() - this.qStart) / 1000).toFixed(2);
    }, 40);
  },

  nextQuestion() {
    const inp = $('#cd-input');
    this.qMiss = 0;
    this.answer = TP.Captcha.render($('#cd-canvas'), this.rng, this.cfg.level);
    inp.value = '';
    inp.classList.remove('err');
    $('#cd-msg').textContent = '';
    $('#cd-idx').textContent = `${this.idx + 1} / ${this.cfg.count}`;
    $('#cd-fill').style.width = (this.idx / this.cfg.count * 100).toFixed(1) + '%';
    this.paintLive();
    // 문자가 그려진 뒤부터 재기 시작한다
    this.qStart = performance.now();
    setTimeout(() => inp.focus(), 30);
  },

  paintLive() {
    const done = this.results.filter(r => r.ok);
    const avg = done.length ? u.mean(done.map(r => r.ms)) : null;
    $('#cd-avg').textContent = avg == null ? '—' : (avg / 1000).toFixed(2);
    $('#cd-miss').textContent = this.results.reduce((a, r) => a + r.miss, 0);
  },

  submit() {
    if (!this.running) return;
    const inp = $('#cd-input');

    if (!TP.Captcha.matches(inp.value, this.answer)) {
      this.qMiss++;
      inp.classList.add('err');
      $('#cd-msg').textContent = '일치하지 않습니다. 새 문자로 다시 시도하세요.';
      setTimeout(() => inp.classList.remove('err'), 340);
      // 실제 예매처처럼 새 문자를 받는다. 타이머는 계속 간다.
      this.answer = TP.Captcha.render($('#cd-canvas'), this.rng, this.cfg.level);
      inp.value = '';
      inp.focus();
      this.paintLive();
      return;
    }
    this.record(performance.now() - this.qStart, true);
  },

  skip() {
    if (!this.running) return;
    this.record(performance.now() - this.qStart, false);
  },

  record(ms, ok) {
    this.results.push({ ms, ok, miss: this.qMiss + (ok ? 0 : 1) });
    this.logItem(this.results.length, ms, ok, this.qMiss);
    this.idx++;
    if (this.idx >= this.cfg.count) return this.finish(false);
    this.nextQuestion();
  },

  logItem(no, ms, ok, miss) {
    const box = $('#cd-log');
    const el = u.el('div.dr-item' + (ok ? '' : '.bad'), {}, [
      u.el('span.dr-no', { text: no + '번' }),
      u.el('span.dr-t', { text: (ms / 1000).toFixed(2) + '초' }),
      u.el('span.dr-note', { text: ok ? (miss ? `정답 (오답 ${miss}회)` : '정답') : '건너뜀' })
    ]);
    box.insertBefore(el, box.firstChild);
    while (box.children.length > 6) box.removeChild(box.lastChild);
  },

  /* ─────────── 결과 ─────────── */
  finish(quit) {
    this.stop();

    const ok = this.results.filter(r => r.ok);
    const times = ok.map(r => r.ms);
    const avg = times.length ? u.mean(times) : null;
    const totalMiss = this.results.reduce((a, r) => a + r.miss, 0);
    // 정확도 = 첫 시도에 맞힌 문제 비율
    const clean = this.results.filter(r => r.ok && r.miss === 0).length;
    const acc = this.results.length ? clean / this.results.length * 100 : 0;

    const tier = TIERS.find(t => avg != null && avg < t.max) || TIERS[TIERS.length - 1];
    const prev = this.load().filter(r => r.level === this.cfg.level);
    const prevBest = prev.length ? Math.min.apply(null, prev.map(r => r.avg)) : null;
    const isBest = avg != null && (prevBest == null || avg < prevBest);

    if (avg != null) {
      this.save({
        at: Date.now(), level: this.cfg.level, count: this.results.length,
        avg: Math.round(avg), acc: acc, best: Math.round(Math.min.apply(null, times)),
        miss: totalMiss, quit: !!quit
      });
    }

    const lvName = LEVEL_META.find(l => l.id === this.cfg.level).name;
    const s = v => v == null ? '—' : (v / 1000).toFixed(2) + '초';
    const wrap = $('#cd-result');
    wrap.textContent = '';
    const H = html => { const d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; };

    wrap.appendChild(H(`
      <div class="rs-hero">
        <div class="rs-verdict">보안문자 연습 결과</div>
        <div class="rs-outcome ${avg == null ? 'fail' : 'ok'}">
          ${quit ? '중단' : '완료'} · ${lvName} ${this.results.length}문제
        </div>
        <div class="rs-desc">${isBest && avg != null ? '개인 최고 평균 기록입니다.' : '문제당 평균 시간이 실력입니다.'}</div>
        <div class="rs-gradewrap">
          <div class="rs-grade" style="color:#a978ff;border-color:#a978ff55">
            ${avg == null ? '—' : tier.grade}<small>AVERAGE</small>
          </div>
          <div class="rs-gradetext">
            <h3>${tier.name} · 평균 ${s(avg)}</h3>
            <p>${tier.body}</p>
          </div>
        </div>
      </div>`));

    wrap.appendChild(H(`
      <div class="rs-section">
        <h3>기록</h3>
        <div class="rec-grid">
          <div class="rec-item"><div class="rec-val">${s(avg)}</div><div class="rec-lab">평균</div></div>
          <div class="rec-item"><div class="rec-val">${s(times.length ? Math.min.apply(null, times) : null)}</div><div class="rec-lab">가장 빠른 문제</div></div>
          <div class="rec-item"><div class="rec-val">${s(times.length ? Math.max.apply(null, times) : null)}</div><div class="rec-lab">가장 느린 문제</div></div>
          <div class="rec-item"><div class="rec-val">${Math.round(acc)}%</div><div class="rec-lab">첫 시도 정답률</div></div>
          <div class="rec-item"><div class="rec-val">${totalMiss}</div><div class="rec-lab">총 오답</div></div>
          <div class="rec-item"><div class="rec-val">${prevBest == null ? '—' : s(prevBest)}</div><div class="rec-lab">이전 최고 평균</div></div>
        </div>
      </div>`));

    /* 문제별 막대 — 어느 문제에서 시간을 흘렸는지 한눈에 */
    const maxMs = this.results.length ? Math.max.apply(null, this.results.map(r => r.ms)) : 1;
    const bars = this.results.map((r, i) => `
      <div class="dr-bar">
        <span class="dr-bar-no">${i + 1}</span>
        <div class="dr-bar-track">
          <i style="width:${(r.ms / maxMs * 100).toFixed(1)}%;background:${r.ok ? (r.miss ? 'var(--amber)' : 'var(--green)') : 'var(--accent)'}"></i>
        </div>
        <span class="dr-bar-t">${(r.ms / 1000).toFixed(2)}s</span>
        <span class="dr-bar-m">${r.ok ? (r.miss ? '오답 ' + r.miss : '') : '건너뜀'}</span>
      </div>`).join('');
    wrap.appendChild(H(`
      <div class="rs-section">
        <h3>문제별 소요시간</h3>
        <div class="rs-card">${bars || '<p class="m-note">기록이 없습니다.</p>'}</div>
      </div>`));

    wrap.appendChild(H(`
      <div class="rs-section">
        <h3>훈련법</h3>
        <div class="fb-list">
          <div class="fb good">
            <div class="fb-icon">⌨️</div>
            <div class="fb-body">
              <h4>외우지 말고 보면서 치세요</h4>
              <p>전체를 외운 뒤 입력하면 두 배로 느려집니다. 첫 글자를 확인하는 즉시 손을 움직이고,
                 치는 동안 다음 글자를 읽으세요. 눈과 손이 겹쳐야 2초 안에 들어갑니다.</p>
            </div>
          </div>
          <div class="fb warn">
            <div class="fb-icon">🔄</div>
            <div class="fb-body">
              <h4>안 읽히면 붙잡지 말고 새로 받으세요</h4>
              <p>실제 예매처에도 새로고침 버튼이 있습니다. 애매한 글자를 3초 넘게 노려보는 것보다
                 읽기 쉬운 문자를 새로 받는 편이 빠릅니다. 이 연습에서 오답이 나면 자동으로
                 새 문자가 나오는 것도 같은 이유입니다.</p>
            </div>
          </div>
          <div class="fb good">
            <div class="fb-icon">🔠</div>
            <div class="fb-body">
              <h4>헷갈리는 글자는 애초에 안 나옵니다</h4>
              <p>0·O·1·I·l 은 제외되어 있습니다. 실제 예매처도 대부분 뺍니다.
                 그러니 <b>O 인가 0 인가</b> 고민하는 데 시간을 쓰지 마세요. 무조건 O 입니다.</p>
            </div>
          </div>
        </div>
      </div>`));

    const act = H(`<div class="rs-actions">
        <button class="btn-primary" id="btn-cd-again">같은 조건으로 다시</button>
        <button class="btn-ghost" id="btn-cd-reset">설정 바꾸기</button>
        <button class="btn-ghost" id="btn-cd-back">전체 연습으로</button>
      </div>`);
    wrap.appendChild(act);
    $('#btn-cd-again', act).onclick = () => this.start();
    $('#btn-cd-reset', act).onclick = () => this.backToSetup();
    $('#btn-cd-back', act).onclick = () => this.exit();

    TP.ui.show('cd-result');
  }
};

Drill.results = [];
TP.Drill = Drill;
document.addEventListener('DOMContentLoaded', () => Drill.init());

})(window.TP = window.TP || {});
