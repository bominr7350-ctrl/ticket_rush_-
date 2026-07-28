/* ═══════════════════════════════════════════════
   core.js — 네임스페이스 · 난수 · 유틸 · 이벤트버스
   ═══════════════════════════════════════════════ */
window.TP = window.TP || {};

/* ─────────── 시드 난수 (mulberry32) ───────────
   같은 시드 → 같은 연습 상황을 재현할 수 있게 한다. */
TP.Rng = function (seed) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    seed: s,
    f: next,
    /** [a,b) 실수 */
    range: (a, b) => a + next() * (b - a),
    /** [a,b] 정수 */
    int: (a, b) => Math.floor(a + next() * (b - a + 1)),
    /** p 확률로 true */
    chance: (p) => next() < p,
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    /** 가중치 선택. items=[{w:number,...}] */
    weighted(items, key) {
      key = key || 'w';
      let total = 0;
      for (const it of items) total += it[key];
      let r = next() * total;
      for (const it of items) { r -= it[key]; if (r <= 0) return it; }
      return items[items.length - 1];
    },
    /** 표준정규 (Box-Muller) */
    gauss(mean, sd) {
      const u = Math.max(next(), 1e-9), v = next();
      return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
    /** 로그정규 — 네트워크 지연처럼 꼬리가 긴 분포에 사용 */
    logNormal(mu, sigma) {
      const u = Math.max(next(), 1e-9), v = next();
      const z = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
      return Math.exp(mu + sigma * z);
    },
    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }
  };
};

/* ─────────── 유틸 ─────────── */
TP.u = {
  clamp: (v, a, b) => v < a ? a : v > b ? b : v,
  lerp: (a, b, t) => a + (b - a) * t,
  /** 1234567 → "1,234,567" */
  n: (v) => Math.round(v).toLocaleString('ko-KR'),
  won: (v) => Math.round(v).toLocaleString('ko-KR') + '원',
  /** 초 → "3분 20초" / "12초" */
  dur(sec) {
    sec = Math.max(0, Math.round(sec));
    if (sec < 60) return sec + '초';
    const m = Math.floor(sec / 60), s = sec % 60;
    return s ? `${m}분 ${s}초` : `${m}분`;
  },
  /** 초 → "09:59" */
  mmss(sec) {
    sec = Math.max(0, Math.ceil(sec));
    const m = Math.floor(sec / 60), s = sec % 60;
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
  },
  /** ms → "0.42초" 또는 "820ms" */
  ms(v) {
    if (v == null || !isFinite(v)) return '—';
    return v >= 1000 ? (v / 1000).toFixed(2) + '초' : Math.round(v) + 'ms';
  },
  hhmmss(d) {
    return [d.getHours(), d.getMinutes(), d.getSeconds()]
      .map(x => String(x).padStart(2, '0')).join(':');
  },
  $: (sel, root) => (root || document).querySelector(sel),
  $$: (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel)),
  /** el('div.cls#id', {attr}, [children|string]) */
  el(spec, attrs, kids) {
    const m = /^([a-z0-9]+)?((?:[.#][\w-]+)*)$/i.exec(spec) || [];
    const node = document.createElement(m[1] || 'div');
    if (m[2]) m[2].match(/[.#][\w-]+/g).forEach(t => {
      if (t[0] === '.') node.classList.add(t.slice(1)); else node.id = t.slice(1);
    });
    if (attrs) for (const k in attrs) {
      if (k === 'text') node.textContent = attrs[k];
      else if (k === 'html') node.innerHTML = attrs[k];
      else if (k === 'style') node.style.cssText = attrs[k];
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null && attrs[k] !== false) node.setAttribute(k, attrs[k]);
    }
    if (kids) (Array.isArray(kids) ? kids : [kids]).forEach(c => {
      if (c == null) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  },
  /** 평균 */
  mean(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null; },
  /** 중앙값 — 이상치에 흔들리지 않아 반응속도 지표에 적합 */
  median(arr) {
    if (!arr.length) return null;
    const s = arr.slice().sort((a, b) => a - b), i = s.length >> 1;
    return s.length % 2 ? s[i] : (s[i - 1] + s[i]) / 2;
  },
  dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); },
  sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
};

/* ─────────── 이벤트 버스 ─────────── */
TP.bus = (function () {
  const map = {};
  return {
    on(ev, fn) { (map[ev] = map[ev] || []).push(fn); return () => this.off(ev, fn); },
    off(ev, fn) { if (map[ev]) map[ev] = map[ev].filter(f => f !== fn); },
    emit(ev, payload) { (map[ev] || []).forEach(f => { try { f(payload); } catch (e) { console.error(e); } }); },
    clear() { for (const k in map) delete map[k]; }
  };
})();

/* ─────────── 로컬 저장 (누적 전적) ─────────── */
TP.store = {
  KEY: 'ticketrush.records.v1',
  load() {
    try { return JSON.parse(localStorage.getItem(this.KEY)) || []; }
    catch (e) { return []; }
  },
  save(rec) {
    const all = this.load();
    all.unshift(rec);
    try { localStorage.setItem(this.KEY, JSON.stringify(all.slice(0, 50))); }
    catch (e) { /* 저장 공간이 없어도 연습 자체는 계속 가능해야 한다 */ }
  },
  clear() { try { localStorage.removeItem(this.KEY); } catch (e) {} }
};
