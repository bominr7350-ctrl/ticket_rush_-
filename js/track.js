/* ═══════════════════════════════════════════════
   track.js — 방문 계측

   관리자 페이지(admin.html)에 보여줄 "누가 들어와서 어디까지 하고 나갔는지"를
   기록한다. 남기는 값은 화면 이름 · 기기 종류 · 유입 경로처럼 개인을 식별하지
   않는 것뿐이다. 이름·연락처·IP·정밀 위치는 수집하지 않는다.

   기록 시점
     visit  입장 (한 탭에 한 번)
     stage  화면이 바뀔 때마다
     ping   화면을 보고 있는 동안 45초마다 — "지금 접속 중" 집계에 쓴다
     end    탭을 닫거나 떠날 때, 체류시간과 함께

   설계상 지켜야 할 것
     · 전송은 전부 fire-and-forget 이다. 실패해도 연습 진행을 절대 막지 않는다.
     · 랭킹 접속 정보(localStorage)를 따르지 않고 항상 공용 서버로 보낸다.
       이용자가 자기 Supabase 를 연결해도 방문 통계는 사이트 운영자 쪽에 남아야 한다.
     · localhost · file:// 에서는 보내지 않는다. 개발하면서 만든 접속으로
       실제 통계가 오염되면 숫자를 믿을 수 없게 된다.
   ═══════════════════════════════════════════════ */
(function (TP) {

const SID_KEY  = 'ticketrush.sid';    // sessionStorage — 탭 단위
const SEEN_KEY = 'ticketrush.seen';   // localStorage  — 재방문 판별
const PING_MS  = 45000;

/* 개발 중 접속은 통계에서 뺀다 */
const host = location.hostname;
const DISABLED =
  location.protocol === 'file:' ||
  host === 'localhost' || host === '127.0.0.1' || host === '::1' ||
  /^192\.168\./.test(host) || /^10\./.test(host);

const Track = {
  sid: null,
  t0: 0,
  base: null,
  started: false,
  _timer: null,
  _ended: false,

  /* ─────────── 환경 판별 ─────────── */

  newSid() {
    try {
      if (crypto && crypto.randomUUID) return crypto.randomUUID().slice(0, 8);
    } catch (e) {}
    return Math.random().toString(36).slice(2, 10);
  },

  device() {
    const ua = navigator.userAgent;
    if (/ipad|tablet|playbook|silk/i.test(ua)) return 'tablet';
    // 아이패드 최신 iPadOS 는 데스크톱 UA 를 쓴다 — 터치 지원 여부로 걸러낸다
    if (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1) return 'tablet';
    if (/mobi|android|iphone|ipod/i.test(ua)) return 'mobile';
    return 'desktop';
  },

  browser() {
    const ua = navigator.userAgent;
    // 순서가 중요하다 — 엣지·삼성인터넷·웨일도 UA 에 Chrome 을 달고 다닌다
    if (/KAKAOTALK/i.test(ua))            return '카카오톡';
    if (/NAVER\(inapp/i.test(ua))         return '네이버앱';
    if (/Whale/i.test(ua))                return 'Whale';
    if (/SamsungBrowser/i.test(ua))       return '삼성인터넷';
    if (/Edg\//i.test(ua))                return 'Edge';
    if (/OPR\/|Opera/i.test(ua))          return 'Opera';
    if (/Firefox\//i.test(ua))            return 'Firefox';
    if (/CriOS|Chrome\//i.test(ua))       return 'Chrome';
    if (/Safari\//i.test(ua))             return 'Safari';
    return '기타';
  },

  os() {
    const ua = navigator.userAgent;
    if (/windows/i.test(ua))              return 'Windows';
    if (/android/i.test(ua))              return 'Android';
    if (/iphone|ipad|ipod/i.test(ua))     return 'iOS';
    if (/macintosh|mac os x/i.test(ua))   return navigator.maxTouchPoints > 1 ? 'iPadOS' : 'macOS';
    if (/linux/i.test(ua))                return 'Linux';
    return '기타';
  },

  /** 유입 경로 — 호스트만 남긴다. 전체 URL 은 검색어 등이 섞일 수 있어 쓰지 않는다 */
  referrer() {
    const r = document.referrer;
    if (!r) return 'direct';
    try {
      const h = new URL(r).hostname.replace(/^www\./, '');
      return h === location.hostname.replace(/^www\./, '') ? 'internal' : h.slice(0, 60);
    } catch (e) {
      return 'unknown';
    }
  },

  isPWA() {
    try {
      return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    } catch (e) { return false; }
  },

  /* ─────────── 전송 ─────────── */

  /**
   * 한 줄 남긴다. 응답을 기다리지 않는다.
   * @param {string} kind visit | stage | ping | end
   * @param {object} extra 덧붙일 컬럼
   */
  send(kind, extra) {
    if (DISABLED || !this.started || !TP.SB) return;

    const row = Object.assign({ sid: this.sid, kind }, this.base, extra || {});

    // 진행 중 설정을 함께 남긴다. cfg.venue 는 객체가 아니라 TP.VENUES 의 키다
    const cfg = TP.App && TP.App.cfg;
    if (cfg) {
      if (cfg.difficulty) row.difficulty = cfg.difficulty.name || null;
      if (cfg.concert)    row.concert    = cfg.concert.name    || null;
      if (cfg.venue) {
        const v = TP.VENUES && TP.VENUES[cfg.venue];
        row.venue = (v && v.name) || String(cfg.venue);
      }
    }
    if (TP.rank && TP.rank.player) {
      const nick = TP.rank.player();
      if (nick) row.nick = String(nick).slice(0, 12);
    }

    try {
      fetch(`${TP.SB.URL}/rest/v1/visits`, {
        method: 'POST',
        headers: Object.assign({}, TP.SB.headers(), { 'Prefer': 'return=minimal' }),
        body: JSON.stringify(row),
        // 탭이 닫히는 중에도 마지막 한 건이 나갈 수 있게 한다
        keepalive: true
      }).catch(() => {});
    } catch (e) { /* 계측 실패가 연습을 방해해서는 안 된다 */ }
  },

  /* ─────────── 시작 ─────────── */

  init() {
    if (DISABLED) return;

    let sid = null, isReturn = false;
    try {
      sid = sessionStorage.getItem(SID_KEY);
      isReturn = !!localStorage.getItem(SEEN_KEY);
      localStorage.setItem(SEEN_KEY, '1');
    } catch (e) { /* 저장소가 막힌 브라우저 — 그래도 이번 방문은 센다 */ }

    const fresh = !sid;
    if (!sid) {
      sid = this.newSid();
      try { sessionStorage.setItem(SID_KEY, sid); } catch (e) {}
    }

    this.sid = sid;
    this.t0 = Date.now();
    this.started = true;
    this.base = {
      device:  this.device(),
      browser: this.browser(),
      os:      this.os(),
      ref:     this.referrer(),
      lang:    (navigator.language || '').slice(0, 12),
      tz:      (Intl.DateTimeFormat().resolvedOptions().timeZone || '').slice(0, 40),
      pwa:     this.isPWA(),
      is_return: isReturn
    };

    // 같은 탭에서 새로고침한 경우는 새 입장으로 세지 않는다
    if (fresh) this.send('visit', { stage: 'home' });

    this.hookStages();
    this.hookHeartbeat();
    this.hookExit();
  },

  /** 화면 전환을 가로채 단계 이동을 남긴다 (ui.show 는 모든 화면 전환이 지나가는 길목이다) */
  hookStages() {
    if (!TP.ui || typeof TP.ui.show !== 'function') return;
    const origin = TP.ui.show.bind(TP.ui);
    let last = null;
    TP.ui.show = (id) => {
      const r = origin(id);
      if (id !== last) { last = id; this.send('stage', { stage: id }); }
      return r;
    };
  },

  /** 보고 있는 동안만 신호를 보낸다 — 배경 탭까지 세면 '접속 중'이 부풀려진다 */
  hookHeartbeat() {
    const beat = () => {
      if (document.visibilityState === 'visible') {
        this.send('ping', { stage: TP.telemetry ? TP.telemetry.phase : null });
      }
    };
    this._timer = setInterval(beat, PING_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') beat();
    });
  },

  /** 떠날 때 체류시간을 남긴다. pagehide 는 모바일에서 unload 보다 훨씬 잘 뜬다 */
  hookExit() {
    const bye = () => {
      if (this._ended) return;
      this._ended = true;
      this.send('end', {
        stage: TP.telemetry ? TP.telemetry.phase : null,
        dur_ms: Date.now() - this.t0
      });
    };
    window.addEventListener('pagehide', bye);
    // iOS 는 pagehide 를 건너뛰는 경우가 있어 숨김 전환도 같이 본다.
    // 다른 앱에 갔다가 돌아오면 아직 떠난 게 아니므로 다시 셀 수 있게 풀어준다
    // (같은 세션에 end 가 여러 줄 남을 수 있어, 통계는 sid 별 최댓값으로 본다).
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') bye();
      else this._ended = false;
    });
  }
};

TP.track = Track;
document.addEventListener('DOMContentLoaded', () => Track.init());

})(window.TP = window.TP || {});
