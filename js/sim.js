/* ═══════════════════════════════════════════════
   sim.js — 서버 시뮬레이터 · 대기열 엔진
   실제 예매 서버에서 관측되는 성질을 흉내낸다.
     · 오픈 직후 부하 폭증 → 완만한 감소 + 주기적 스파이크
     · 부하에 비례해 늘어나는 응답 지연 (꼬리가 긴 로그정규 분포)
     · 부하에 제곱으로 늘어나는 오류율
     · 불규칙하게 멈췄다 재개되는 대기열
   ═══════════════════════════════════════════════ */
(function (TP) {

/* ─────────── 오류 종류 ─────────── */
const ERRORS = {
  TIMEOUT:    { w: 3, code: 'TIMEOUT',    msg: '요청 시간이 초과되었습니다. 다시 시도해 주세요.' },
  BUSY:       { w: 4, code: 'BUSY',       msg: '일시적으로 접속이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.' },
  GATEWAY:    { w: 2, code: 'GATEWAY',    msg: '서버가 응답하지 않습니다. (오류코드 502)' },
  SESSION:    { w: 1, code: 'SESSION',    msg: '세션이 만료되었습니다.' }
};

TP.Server = function (cfg, rng) {
  const s = {
    cfg, rng,
    t: 0,                 // 오픈 이후 경과 시간(초)
    load: 0.99,           // 0~1
    users: cfg.users,
    refreshLog: [],
    blockedUntil: 0,
    pending: 0,
    latencySamples: [],

    /** 매 틱(dt초)마다 부하와 접속자 수를 갱신 */
    tick(dt) {
      this.t += dt;
      const d = cfg.difficulty;
      const base = 0.28 + d.level * 0.09;              // 난이도가 높을수록 평상시 부하도 높다
      const decay = Math.exp(-this.t / (55 + d.level * 40));
      // 주기가 다른 파동을 겹쳐 규칙적이지 않게 보이도록
      const wave = Math.sin(this.t / 7.3) * 0.045 + Math.sin(this.t / 2.9 + 1.4) * 0.03;
      const spike = this.rng.chance(0.02 * dt * 10) ? this.rng.range(0.08, 0.22) : 0;
      this._spike = Math.max(0, (this._spike || 0) * Math.pow(0.35, dt) + spike);
      this.load = TP.u.clamp(base + (0.99 - base) * decay + wave + this._spike, 0.08, 1);

      // 접속자는 시간이 지나며 이탈한다
      const stay = 0.30 + 0.70 * Math.exp(-this.t / (90 + d.level * 60));
      this.users = Math.round(cfg.users * stay * (1 + Math.sin(this.t / 4.1) * 0.02));
    },

    /** 현재 부하 기준 응답 지연(ms) 표본 */
    sampleLatency() {
      const d = cfg.difficulty;
      const raw = this.rng.logNormal(d.latMu, d.latSig);
      const lat = TP.u.clamp(raw * (0.45 + this.load * 1.45), 35, 9500);
      this.latencySamples.push(lat);
      if (this.latencySamples.length > 40) this.latencySamples.shift();
      return lat;
    },

    avgLatency() { return TP.u.mean(this.latencySamples) || 0; },

    /** 현재 오류 확률 */
    errorProb() {
      if (!cfg.opts.errors) return 0;
      return TP.u.clamp(cfg.difficulty.errorRate * (0.3 + this.load * this.load * 2.6), 0, 0.55);
    },

    /**
     * 서버 요청. 지연이 흐른 뒤 성공/실패로 resolve 한다.
     * 지연 도중 세상은 계속 변하므로(= 좌석이 팔린다) 호출자는
     * resolve 시점에 반드시 상태를 다시 확인해야 한다.
     * @returns Promise<{ok:boolean, latency:number, error?:object}>
     */
    request(opt) {
      opt = opt || {};
      const self = this;
      let lat = this.sampleLatency();
      if (opt.latencyMul) lat *= opt.latencyMul;
      const failP = opt.noFail ? 0 : this.errorProb() * (opt.riskMul || 1);
      const fails = this.rng.chance(failP);
      // 타임아웃은 오래 기다린 끝에 실패하는 것이라 체감이 가장 나쁘다
      const err = fails ? this.rng.weighted(Object.values(ERRORS)) : null;
      if (err && err.code === 'TIMEOUT') lat = Math.max(lat, this.rng.range(2600, 5200));

      this.pending++;
      return new Promise(resolve => {
        setTimeout(() => {
          self.pending--;
          resolve(fails ? { ok: false, latency: lat, error: err } : { ok: true, latency: lat });
        }, lat);
      });
    },

    /* ─────────── 새로고침 제한 ───────────
       짧은 시간에 반복 새로고침하면 부정 접근으로 간주해 차단한다. */
    registerRefresh(nowMs) {
      if (!cfg.opts.refreshLimit) return { blocked: false };
      this.refreshLog = this.refreshLog.filter(t => nowMs - t < 12000);
      this.refreshLog.push(nowMs);
      if (this.refreshLog.length >= 4) {
        this.refreshLog = [];
        // 연습용이라 차단은 "경고" 정도로만 짧게 (실제 예매처는 훨씬 길다)
        const sec = 3 + Math.floor(cfg.difficulty.level / 2);
        this.blockedUntil = nowMs + sec * 1000;
        return { blocked: true, sec };
      }
      return { blocked: false, count: this.refreshLog.length };
    },

    isBlocked(nowMs) { return nowMs < this.blockedUntil; }
  };
  return s;
};

/* ═══════════════════════════════════════════════
   대기열 엔진
   ═══════════════════════════════════════════════ */
TP.Queue = function (cfg, server, rng) {
  const d = cfg.difficulty;

  /* 반응속도 → 대기 순번 백분위.
     100ms 단위로 지수적으로 뒤로 밀린다. 0.2초와 1.5초의 차이가 순번에서는 수만 명이 된다. */
  function percentile(reactionMs) {
    const r = Math.max(reactionMs, 90) / 100;
    return TP.u.clamp(0.0008 * Math.pow(r, 1.75), 0.0004, 0.94);
  }

  const q = {
    total: 0,          // 전체 대기 인원
    ahead: 0,          // 내 앞의 인원
    start: 0,          // 최초 내 앞 인원 (진행률 표시용)
    rate: 0,           // 초당 처리 인원 (표시용, 평활화)
    state: 'normal',   // normal | slow | stall
    stallLeft: 0,
    elapsed: 0,
    done: false,
    pushedBack: 0,     // 새로고침으로 밀려난 총 인원
    cutIns: 0,         // 앞에 끼어들어 순번이 늘어난 횟수

    init(reactionMs) {
      const contenders = Math.round(cfg.users * 0.62 * d.heat);
      this.total = contenders;
      const raw = Math.max(0, Math.round(contenders * percentile(reactionMs) * rng.range(0.82, 1.2)));

      /* 연습 도구이므로 대기 자체가 길어지면 반복 연습이 불가능해진다.
         순번을 상한으로 자르되, 좌석 경쟁의 실제 불이익(진입 시 판매율)은
         좌석 소진 속도가 그대로 담당한다. */
      const effDrain = d.drain * 0.55;                  // 부하를 감안한 실효 처리량
      const maxAhead = Math.round(effDrain * d.maxWaitSec);
      this.ahead = Math.min(raw, maxAhead);
      this.capped = raw > maxAhead;

      this.start = this.ahead;
      this.rate = d.drain;
      return this.ahead;
    },

    tick(dt) {
      if (this.done) return;
      this.elapsed += dt;

      // 상태 전이 — 가끔 멈추고, 자주 느려진다
      if (this.stallLeft > 0) {
        this.stallLeft -= dt;
        if (this.stallLeft <= 0) { this.state = 'normal'; TP.bus.emit('queue:resume'); }
      } else if (rng.chance(0.012 * dt * 10 * (0.4 + server.load))) {
        this.state = 'stall';
        this.stallLeft = rng.range(1.5, 2.0 + d.level * 1.6);
        TP.bus.emit('queue:stall');
      } else {
        this.state = server.load > 0.82 ? 'slow' : 'normal';
      }

      let processed = 0;
      if (this.state !== 'stall') {
        // 부하가 높을수록 처리량이 떨어진다
        const eff = TP.u.clamp(1.35 - server.load * 0.85, 0.25, 1.2);
        processed = d.drain * eff * rng.range(0.75, 1.3) * dt;

        // 재접속·다중접속으로 앞에 끼어드는 인원 — 순번이 늘어나기도 하는 이유.
        // 실제로는 계속 일어나지만, 숫자가 자꾸 뒤로 가면 연습이 답답해지므로 판당 2번까지만.
        if (this.cutIns < 2 && rng.chance(0.02 * dt * 10)) {
          this.cutIns++;
          processed -= rng.range(20, 90 + d.level * 60);
        }

        this.ahead = Math.max(0, this.ahead - processed);
        this.total = Math.max(this.ahead, this.total - processed * rng.range(0.9, 1.1));
      }

      // 표시용 처리속도는 급변하지 않게 평활화
      const inst = processed / Math.max(dt, 1e-6);
      this.rate = this.rate * 0.85 + inst * 0.15;

      if (this.ahead <= 0 && !this.done) {
        this.done = true;
        TP.bus.emit('queue:done');
      }
    },

    /** 예상 대기시간(초). 실제 예매처처럼 자주 틀린다. */
    eta() {
      if (this.state === 'stall') return null;
      const r = Math.max(this.rate, 1);
      return this.ahead / r;
    },

    /** 새로고침 → 순번이 뒤로 밀린다.
        실제 예매처는 사실상 꼴찌로 보내지만, 이건 연습 도구다.
        한 번 실수했다고 몇 분씩 멍하니 기다리면 연습을 반복할 수 없으므로
        "밀려나는 인원" 대신 "추가로 늘어나는 대기시간"을 기준으로 계산한다.
        난이도가 올라가도(= 대기 인원이 수십만이 되어도) 체감 대기는 이 범위를 넘지 않는다. */
    refresh() {
      const before = this.ahead;
      const penaltySec = rng.range(6, 9);               // 추가 대기 약 6~9초
      // 화면에 표시되는 처리 속도를 기준으로 삼아야 실제 늘어나는 대기가 이 초 수에 맞는다.
      // (부하가 높으면 실제 처리량이 d.drain 보다 훨씬 낮아지므로 그것만 쓰면 두 배로 밀린다)
      const rate = Math.max(this.rate, d.drain * 0.35);
      const add = Math.max(1, Math.round(rate * penaltySec));
      this.ahead = Math.min(this.total, this.ahead + add);
      this.start = Math.max(this.start, this.ahead);
      this.pushedBack += Math.max(0, this.ahead - before);
      return this.ahead - before;
    },

    progress() {
      if (this.ahead <= 0) return 1;
      return this.start ? TP.u.clamp(1 - this.ahead / this.start, 0, 1) : 0;
    }
  };
  return q;
};

})(window.TP);
