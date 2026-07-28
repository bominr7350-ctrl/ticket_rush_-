/* ═══════════════════════════════════════════════
   seats.js — 좌석 배치 생성 · 경쟁자(AI) 좌석 소진 엔진

   실제 티켓팅에서 좌석은 무작위로 사라지지 않는다.
   좋은 자리부터, 앞자리부터, 중앙부터 사라진다.
   그래서 좌석마다 "선호도"를 계산해 두고 그 순서대로 소진시킨다.

   ※ 현재 경쟁자는 전부 AI다. 실제 사용자끼리 겨루려면
     advance()가 서버에서 내려온 좌석 상태를 반영하도록 바꾸면 된다.
   ═══════════════════════════════════════════════ */
(function (TP) {

TP.SeatMap = function (cfg, rng) {
  const venue = TP.VENUES[cfg.concert.venue];
  const d = cfg.difficulty;

  /* ─────────── 배치 생성 ─────────── */
  let baseTotal = 0;
  venue.rows.forEach(row => row.forEach(z => { baseTotal += z.r * z.c; }));
  const scale = Math.sqrt(d.seats / baseTotal);

  const zones = [];
  const seats = [];            // 전체 좌석 (평면)
  const byId = Object.create(null);

  venue.rows.forEach((row, ri) => {
    row.forEach(tpl => {
      const rows = Math.max(4, Math.round(tpl.r * scale));
      const cols = Math.max(6, Math.round(tpl.c * scale));
      const zone = {
        id: tpl.id, name: tpl.name, grade: tpl.grade,
        rows, cols, tier: ri, seats: [], total: rows * cols, sold: 0, held: 0
      };
      const cx = (cols - 1) / 2;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          // 선호도: 등급 > 앞줄 > 중앙 순으로 가중.
          // 격차를 크게 벌려야 "좋은 자리부터 순식간에 사라지는" 실제 양상이 재현된다.
          const gradeW = { VIP: 1.0, R: 0.78, S: 0.52, A: 0.30 }[tpl.grade];
          const front = 1 - (r / Math.max(rows - 1, 1)) * 0.60;
          const center = 1 - (Math.abs(c - cx) / Math.max(cx, 1)) * 0.45;
          const tierW = 1 - ri * 0.09;
          const score = gradeW * front * center * tierW;
          const seat = {
            id: `${tpl.id}-${r + 1}-${c + 1}`,
            zone: tpl.id, zoneName: tpl.name, grade: tpl.grade,
            row: r + 1, col: c + 1,
            label: `${r + 1}열 ${c + 1}번`,
            price: TP.GRADES[tpl.grade].price,
            state: 'available',        // available | hold | sold | mine
            score,
            // 순수하게 점수대로만 팔리면 부자연스러우므로 흔들어 주되,
            // 폭이 크면 선호 순서가 뭉개져 좋은 자리가 오래 남는다. 좁게 흔든다.
            order: score * rng.range(0.90, 1.12)
          };
          zone.seats.push(seat);
          seats.push(seat);
          byId[seat.id] = seat;
        }
      }
      zones.push(zone);
    });
  });

  /* 소진 순서: 선호도 높은 좌석부터 */
  const order = seats.slice().sort((a, b) => b.order - a.order);
  let ptr = 0;

  const holdTimers = [];   // {seat, left, forUser}
  const map = {
    zones, seats, byId,
    total: seats.length,
    sold: 0,
    held: 0,
    mine: [],
    /** 내가 좌석을 잡은 시점에 이미 팔려 있던 좌석 수 (순위 추정용) */
    soldWhenIWon: null,

    zone(id) { return zones.find(z => z.id === id); },

    available() { return this.total - this.sold - this.held - this.mine.length; },

    /* ─────────── 시간 경과에 따른 좌석 소진 ───────────
       t = 티켓 오픈 이후 경과 시간(초).
       초반에 가파르고 뒤로 갈수록 완만해지는 곡선을 따른다. */
    advance(t, dt) {
      // 선점 타이머 처리
      for (let i = holdTimers.length - 1; i >= 0; i--) {
        const h = holdTimers[i];
        h.left -= dt;
        if (h.left <= 0) {
          holdTimers.splice(i, 1);
          if (h.seat.state === 'hold') {
            this.held--;
            // 대부분은 그대로 결제로 이어지고, 일부는 놓쳐서 다시 풀린다
            if (rng.chance(0.88)) { h.seat.state = 'sold'; this.sold++; }
            else { h.seat.state = 'available'; TP.bus.emit('seat:release', h.seat); }
          }
        }
      }

      // 지수 상수가 클수록 초반이 가파르다. 실제 티켓팅은 오픈 직후가 압도적으로 가파르다.
      const frac = 1 - Math.exp(-4.2 * t / d.selloutSec);
      const target = Math.min(this.total, Math.round(this.total * frac));
      let need = target - (this.sold + this.held);
      let guard = 4000;
      while (need > 0 && ptr < order.length && guard-- > 0) {
        const seat = order[ptr++];
        if (seat.state !== 'available') continue;
        seat.state = 'hold';
        this.held++;
        holdTimers.push({ seat, left: rng.range(0.4, 2.2) });
        TP.bus.emit('seat:taken', seat);
        need--;
      }
    },

    /** 내가 특정 좌석을 노리는 순간, 경쟁자도 같은 좌석을 노릴 확률.
        좋은 좌석(score 가 높은 좌석)일수록 남에게 빼앗길 확률이 확 올라간다. */
    contest(seat, load) {
      if (seat.state !== 'available') return false;
      const p = TP.u.clamp(seat.score * (0.34 + load * 0.58) * d.heat * 0.85, 0, 0.88);
      return rng.chance(p);
    },

    /** 경쟁자가 즉시 낚아챈다 */
    snatch(seat) {
      if (seat.state !== 'available') return false;
      seat.state = 'hold';
      this.held++;
      holdTimers.push({ seat, left: rng.range(0.6, 2.0) });
      TP.bus.emit('seat:taken', seat);
      return true;
    },

    /** 내가 좌석을 확보 */
    claim(seat) {
      if (seat.state !== 'available') return false;
      seat.state = 'mine';
      this.mine.push(seat);
      if (this.soldWhenIWon == null) this.soldWhenIWon = this.sold + this.held;
      return true;
    },

    /** 내 좌석 해제 — 즉시 경쟁자에게 넘어간다 */
    unclaim(seat) {
      const i = this.mine.indexOf(seat);
      if (i < 0) return;
      this.mine.splice(i, 1);
      seat.state = 'available';
      // 손을 뗀 좋은 자리는 순식간에 사라진다
      if (rng.chance(0.62 + seat.score * 0.36)) this.snatch(seat);
    },

    /** 구역별 잔여 현황 */
    zoneStats() {
      return zones.map(z => {
        let left = 0;
        for (const s of z.seats) if (s.state === 'available') left++;
        return { zone: z, left, ratio: left / z.total };
      });
    },

    /** 등급별 잔여 현황 */
    gradeStats() {
      const acc = {};
      for (const g in TP.GRADES) acc[g] = { total: 0, left: 0 };
      for (const s of seats) {
        acc[s.grade].total++;
        if (s.state === 'available') acc[s.grade].left++;
      }
      return acc;
    },

    /** 목표 좌석 달성 여부 판정 */
    meetsTarget(targetId) {
      const mine = this.mine;
      if (!mine.length) return false;
      switch (targetId) {
        case 'VIP':   return mine.some(s => s.grade === 'VIP');
        case 'R':     return mine.some(s => s.grade === 'VIP' || s.grade === 'R');
        case 'front': return mine.some(s => s.row <= 5);
        case 'multi': {
          if (mine.length < 2) return false;
          return mine.some(a => mine.some(b =>
            a !== b && a.zone === b.zone && a.row === b.row && Math.abs(a.col - b.col) === 1));
        }
        default: return true;
      }
    }
  };

  return map;
};

})(window.TP);
