/* ═══════════════════════════════════════════════
   captcha.js — 보안문자 생성 · 렌더링 (공용)

   전체 연습의 보안문자 화면(app.js)과 보안문자 집중 연습(drill.js)이
   같은 코드를 쓴다. 한쪽만 바뀌어 난이도가 달라지면
   연습한 감각이 실전과 어긋나므로 반드시 공유해야 한다.
   ═══════════════════════════════════════════════ */
(function (TP) {

/* 헷갈리는 0/O/1/I/l 는 제외 — 실제 예매처도 대부분 뺀다 */
const CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** 난이도별 왜곡 강도 */
const LEVELS = {
  easy:   { len: 4, rot: 0.24, skew: 0.10, lines: 4,  dots: 70,  sizeMin: 30, sizeMax: 36, jitter: 3 },
  normal: { len: 5, rot: 0.42, skew: 0.16, lines: 7,  dots: 140, sizeMin: 30, sizeMax: 40, jitter: 5 },
  hard:   { len: 6, rot: 0.58, skew: 0.24, lines: 11, dots: 220, sizeMin: 27, sizeMax: 42, jitter: 7 }
};

TP.Captcha = {

  CHARS: CHARS,
  LEVELS: LEVELS,

  /** 무작위 정답 문자열 */
  makeText(rng, len) {
    let s = '';
    for (let i = 0; i < len; i++) s += CHARS[Math.floor(rng.f() * CHARS.length)];
    return s;
  },

  /**
   * 캔버스에 보안문자를 그린다.
   * @param {HTMLCanvasElement} cv
   * @param {object} rng   TP.Rng 인스턴스
   * @param {string} level 'easy' | 'normal' | 'hard'
   * @returns {string} 정답 문자열
   */
  render(cv, rng, level) {
    const L = LEVELS[level] || LEVELS.normal;
    const ctx = cv.getContext('2d');
    const text = this.makeText(rng, L.len);

    ctx.fillStyle = '#f2f4f8';
    ctx.fillRect(0, 0, cv.width, cv.height);

    // 배경 잡선
    for (let i = 0; i < L.lines; i++) {
      ctx.strokeStyle = `hsl(${rng.int(0, 360)},55%,72%)`;
      ctx.lineWidth = rng.range(0.8, 1.8);
      ctx.beginPath();
      ctx.moveTo(rng.range(0, cv.width), rng.range(0, cv.height));
      ctx.bezierCurveTo(
        rng.range(0, cv.width), rng.range(0, cv.height),
        rng.range(0, cv.width), rng.range(0, cv.height),
        rng.range(0, cv.width), rng.range(0, cv.height));
      ctx.stroke();
    }
    // 잡점
    for (let i = 0; i < L.dots; i++) {
      ctx.fillStyle = `hsla(${rng.int(0, 360)},40%,45%,${rng.range(.15, .5)})`;
      ctx.fillRect(rng.range(0, cv.width), rng.range(0, cv.height), 1.6, 1.6);
    }
    // 문자 — 회전·기울기·크기를 흔들어 눈으로도 조금 어렵게
    const step = cv.width / (L.len + 1);
    for (let i = 0; i < L.len; i++) {
      ctx.save();
      ctx.translate(step * (i + 1) + rng.range(-L.jitter, L.jitter),
                    cv.height / 2 + rng.range(-L.jitter, L.jitter));
      ctx.rotate(rng.range(-L.rot, L.rot));
      ctx.transform(1, rng.range(-L.skew, L.skew), rng.range(-L.skew, L.skew), 1, 0, 0);
      ctx.font = `bold ${rng.int(L.sizeMin, L.sizeMax)}px "Segoe UI",Arial,sans-serif`;
      ctx.fillStyle = `hsl(${rng.int(200, 260)},${rng.int(30, 60)}%,${rng.int(18, 34)}%)`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text[i], 0, 0);
      ctx.restore();
    }
    return text;
  },

  /** 입력이 정답과 같은지 — 대소문자와 앞뒤 공백은 무시한다 */
  matches(input, answer) {
    return String(input || '').trim().toUpperCase() === String(answer || '').toUpperCase();
  }
};

})(window.TP = window.TP || {});
