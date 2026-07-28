/* ═══════════════════════════════════════════════
   telemetry.js — 입력 계측
   클릭 · 마우스 이동 · 구간별 소요시간 · 이벤트 로그를 수집한다.
   마우스 관련 지표는 정밀 포인터(데스크톱 마우스)에서만 유효하며,
   터치 환경에서는 수집하지 않고 분석에서도 제외한다.
   ═══════════════════════════════════════════════ */
(function (TP) {

const T = TP.telemetry = {
  active: false,
  hasMouse: false,     // 정밀 포인터 여부 — 모바일/태블릿이면 false
  t0: 0,
  phase: 'idle',

  clicks: [],          // {t,x,y,phase,hit,kind}
  moveDist: 0,         // 실제 커서 이동거리 (px)
  path: [],            // 결과 화면 시각화를 위한 다운샘플 경로
  marks: {},           // 구간 진입 시각
  events: [],          // 타임라인용 {t,name,kind}
  counters: {},        // 각종 횟수 집계

  _last: null,
  _lastPathT: 0,

  /** 정밀 포인터 판정 — 마우스가 있는 데스크톱 환경인지 */
  detectPointer() {
    const fine = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
    const hover = window.matchMedia && window.matchMedia('(hover: hover)').matches;
    const noTouch = !('ontouchstart' in window) || navigator.maxTouchPoints === 0;
    this.hasMouse = !!(fine && hover) || noTouch;
    return this.hasMouse;
  },

  start() {
    this.active = true;
    this.t0 = performance.now();
    this.clicks = []; this.path = []; this.events = [];
    this.marks = {}; this.counters = {};
    this.moveDist = 0; this._last = null; this._lastPathT = 0;
    this.phase = 'standby';
    this.detectPointer();

    this._onMove = (e) => {
      if (!this.active || !this.hasMouse) return;
      const x = e.clientX, y = e.clientY;
      if (this._last) {
        const d = TP.u.dist(this._last.x, this._last.y, x, y);
        // 창 밖에서 돌아오며 생기는 순간이동은 이동거리로 세지 않는다
        if (d < 400) this.moveDist += d;
      }
      this._last = { x, y };
      const now = performance.now();
      if (now - this._lastPathT > 40 && this.path.length < 5000) {
        this._lastPathT = now;
        this.path.push([Math.round(x), Math.round(y), Math.round(now - this.t0)]);
      }
    };

    this._onDown = (e) => {
      if (!this.active) return;
      const target = e.target;
      // 유효 클릭 = 실제로 동작하는 대상을 눌렀는가
      const interactive = target.closest(
        'button, input, label, a, .seat.av, .seat.mine, .vm-zone:not(.off), .co-choice, .concert, .diff, .target'
      );
      const dead = target.closest('.seat.sold, .seat.hold, .vm-zone.off, button:disabled');
      this.clicks.push({
        t: performance.now() - this.t0,
        x: e.clientX, y: e.clientY,
        phase: this.phase,
        hit: !!interactive && !dead,
        kind: dead ? 'dead' : interactive ? 'hit' : 'miss'
      });
      if (dead) this.count('deadClick');
      else if (!interactive) this.count('missClick');
    };

    window.addEventListener('pointermove', this._onMove, { passive: true });
    window.addEventListener('pointerdown', this._onDown, { passive: true, capture: true });
  },

  stop() {
    this.active = false;
    window.removeEventListener('pointermove', this._onMove);
    window.removeEventListener('pointerdown', this._onDown, { capture: true });
  },

  now() { return performance.now() - this.t0; },

  /** 구간 진입 기록 */
  mark(name) { if (this.marks[name] == null) this.marks[name] = this.now(); },
  /** 구간 진입 시각 강제 갱신 (재진입 시) */
  remark(name) { this.marks[name] = this.now(); },
  since(name) { return this.marks[name] == null ? null : this.now() - this.marks[name]; },

  setPhase(p) { this.phase = p; },

  count(key, by) { this.counters[key] = (this.counters[key] || 0) + (by || 1); },
  get(key) { return this.counters[key] || 0; },

  /** 타임라인 이벤트. kind: 'info' | 'bad' | 'good' */
  log(name, kind) { this.events.push({ t: this.now(), name, kind: kind || 'info' }); },

  /* ─────────── 파생 지표 계산 ─────────── */

  /** 특정 구간의 클릭만 */
  clicksIn(phase) { return this.clicks.filter(c => c.phase === phase); },

  /** 클릭 정확도(%) — 홈 화면 설정 클릭은 제외하고 실전 구간만 본다 */
  clickAccuracy() {
    const cs = this.clicks.filter(c => c.phase !== 'home' && c.phase !== 'result');
    if (cs.length < 3) return null;
    return cs.filter(c => c.kind === 'hit').length / cs.length * 100;
  },

  /** 1초 슬라이딩 윈도우 최대 클릭 수 = 순간 최고 연타 속도 */
  peakClickRate() {
    const ts = this.clicks.filter(c => c.phase !== 'home').map(c => c.t).sort((a, b) => a - b);
    if (ts.length < 2) return null;
    let best = 1, j = 0;
    for (let i = 0; i < ts.length; i++) {
      while (ts[i] - ts[j] > 1000) j++;
      best = Math.max(best, i - j + 1);
    }
    return best;
  },

  /** 마우스 경로 효율(%) = 클릭 간 최단거리 합 / 실제 이동거리 합 */
  mouseEfficiency() {
    if (!this.hasMouse || this.moveDist < 200) return null;
    const cs = this.clicks.filter(c => c.phase !== 'home' && c.phase !== 'result');
    if (cs.length < 3) return null;
    let ideal = 0;
    for (let i = 1; i < cs.length; i++) ideal += TP.u.dist(cs[i - 1].x, cs[i - 1].y, cs[i].x, cs[i].y);
    if (ideal < 50) return null;
    return TP.u.clamp(ideal / this.moveDist * 100, 0, 100);
  },

  /** 클릭 간격의 중앙값 — 망설임의 크기 */
  medianClickGap(phase) {
    const cs = (phase ? this.clicksIn(phase) : this.clicks).map(c => c.t);
    if (cs.length < 3) return null;
    const gaps = [];
    for (let i = 1; i < cs.length; i++) gaps.push(cs[i] - cs[i - 1]);
    return TP.u.median(gaps);
  },

  /** 침착도 100점 만점 — 당황 신호마다 감점 */
  composure() {
    let s = 100;
    s -= this.get('refresh') * 9;        // 불필요한 새로고침
    s -= this.get('deadClick') * 4;      // 이미 팔린 좌석 반복 클릭
    s -= this.get('missClick') * 2;      // 허공 클릭
    s -= this.get('captchaFail') * 7;    // 보안문자 오입력
    s -= this.get('blocked') * 15;       // 접속 차단 유발
    s -= this.get('seatFail') * 3;       // 선점 실패 (일부는 운이므로 감점 폭이 작다)
    return TP.u.clamp(s, 0, 100);
  }
};

})(window.TP);
