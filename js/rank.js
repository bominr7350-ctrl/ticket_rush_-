/* ═══════════════════════════════════════════════
   rank.js — 실제 기록 기반 랭킹

   여기에는 가상 경쟁자를 만들지 않는다.
   이 브라우저에 실제로 저장된 연습 결과만 비교 대상이다.
     · 기록이 하나뿐이면 비교 대상도 없다고 솔직하게 말한다
     · 홈 화면에서 이름을 바꿔가며 여러 사람이 같은 기기로 겨룰 수 있다
     · 인터넷 전체 랭킹은 서버가 필요하다 (TP.store 를 서버 호출로 바꾸면 된다)
   ═══════════════════════════════════════════════ */
(function (TP) {

const u = TP.u;

TP.rank = {

  PLAYER_KEY: 'ticketrush.player',

  player() {
    try { return localStorage.getItem(this.PLAYER_KEY) || ''; }
    catch (e) { return ''; }
  },

  setPlayer(name) {
    try { localStorage.setItem(this.PLAYER_KEY, name || ''); }
    catch (e) { /* 저장이 막혀 있어도 연습은 계속 가능해야 한다 */ }
  },

  /**
   * 이번 기록을 실제 저장된 기록들과 비교한다.
   * @param {object} o { reactionMs, seatTimeMs, score, difficulty, player, history }
   *   history 는 이번 판을 저장하기 전에 읽은 TP.store.load() 결과여야 한다.
   */
  evaluate(o) {
    const name = (o.player || '').trim() || '이름 없음';

    const cur = {
      player: name, ms: o.reactionMs, score: o.score, seatTime: o.seatTimeMs,
      difficulty: o.difficulty, at: Date.now(), current: true
    };

    /* 반응속도가 실제로 측정된 판만 비교에 쓴다 */
    const past = (o.history || [])
      .filter(r => r.reaction != null && isFinite(r.reaction))
      .map(r => ({
        player: (r.player || '').trim() || '이름 없음',
        ms: r.reaction, score: r.score, seatTime: r.seatTime,
        difficulty: r.difficulty, at: r.at || 0, current: false
      }));

    const out = { player: name, pastRuns: past.length, measured: false };
    if (cur.ms == null || !isFinite(cur.ms)) return out;
    out.measured = true;

    /* ── 전체 기록 중 이번 판의 순위 ── */
    const all = past.concat([cur]).sort((a, b) => a.ms - b.ms);
    all.forEach(r => { r.me = r.player === name; });
    out.total = all.length;
    out.rank = all.indexOf(cur) + 1;
    out.hasRivals = past.length > 0;
    if (out.total > 1) out.topPct = out.rank / out.total * 100;
    out.value = cur.ms;

    /* ── 사람별 최고 기록 = 실제 랭킹 보드 ── */
    const best = {}, runs = {};
    all.forEach(r => {
      runs[r.player] = (runs[r.player] || 0) + 1;
      if (!best[r.player] || r.ms < best[r.player].ms) best[r.player] = r;
    });
    out.players = Object.keys(best)
      .map(k => ({
        player: k, ms: best[k].ms, at: best[k].at,
        difficulty: best[k].difficulty,
        isCurrentRun: best[k].current,
        me: k === name,
        runs: runs[k]
      }))
      .sort((a, b) => a.ms - b.ms);
    out.players.forEach((p, i) => { p.rank = i + 1; });
    out.playerCount = out.players.length;
    out.playerRank = out.players.findIndex(p => p.me) + 1;

    /* ── 내 지난 기록 ── */
    const minePast = past.filter(r => r.player === name);
    if (minePast.length) {
      const prevBest = Math.min.apply(null, minePast.map(r => r.ms));
      const recent = minePast.slice().sort((a, b) => b.at - a.at).slice(0, 5);
      const recentAvg = u.mean(recent.map(r => r.ms));
      out.self = {
        runs: minePast.length + 1,
        prevBest: prevBest,
        isBest: cur.ms < prevBest,
        recentAvg: recentAvg,
        recentCount: recent.length,
        delta: cur.ms - recentAvg
      };
    } else {
      out.self = { runs: 1, first: true };
    }

    /* ── 내 반응속도 추이 (오래된 순) ── */
    out.trend = all.filter(r => r.player === name)
                   .slice()
                   .sort((a, b) => a.at - b.at)
                   .map(r => ({ ms: r.ms, current: !!r.current }));

    /* ── 다른 지표를 내 과거 기록과 비교 ── */
    const cmp = (label, value, key, lower) => {
      const vals = minePast.map(r => r[key]).filter(v => v != null && isFinite(v));
      if (value == null || !isFinite(value) || !vals.length) return null;
      const b = lower ? Math.min.apply(null, vals) : Math.max.apply(null, vals);
      return {
        label, value, best: b, avg: u.mean(vals), lower,
        improved: lower ? value < b : value > b
      };
    };
    out.compare = [
      cmp('좌석 선택 속도', o.seatTimeMs, 'seatTime', true),
      cmp('종합 점수', o.score, 'score', false)
    ].filter(Boolean);

    /* ── 한 줄 요약 ── */
    out.headline =
      !out.hasRivals
        ? '첫 기록입니다. 한 번 더 연습하면 이 기록과 비교됩니다.'
        : out.rank === 1
          ? `저장된 ${out.total}개 기록 중 가장 빠릅니다.`
          : `저장된 ${out.total}개 기록 중 ${out.rank}위입니다.`;

    return out;
  },

  fmtPct(p) {
    if (p == null) return '—';
    if (p < 10) return p.toFixed(1);
    return String(Math.round(p));
  }
};

})(window.TP);
