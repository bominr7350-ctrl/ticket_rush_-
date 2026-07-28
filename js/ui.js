/* ═══════════════════════════════════════════════
   ui.js — 화면 전환 · 렌더링 · 오버레이 · 캔버스
   ═══════════════════════════════════════════════ */
(function (TP) {

const u = TP.u, $ = u.$;

const ui = TP.ui = {

  /* ─────────── 화면 전환 ─────────── */
  show(id) {
    u.$$('.screen').forEach(s => s.classList.toggle('active', s.id === 'screen-' + id));
    window.scrollTo(0, 0);
    TP.telemetry.setPhase(id);
  },

  topbar(on) { $('#topbar').classList.toggle('hidden', !on); },

  /* ─────────── 토스트 ─────────── */
  toast(msg, kind, ms) {
    const el = u.el('div.toast' + (kind ? '.' + kind : ''), { html: msg });
    $('#toast-layer').appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 250);
    }, ms || 2600);
  },

  /* ─────────── 로딩 오버레이 ─────────── */
  loading(on, text, sub) {
    const o = $('#loading-overlay');
    o.classList.toggle('hidden', !on);
    if (text) $('#lo-text').textContent = text;
    $('#lo-sub').textContent = sub || '';
  },

  /** 지연이 길어지면 "응답이 느립니다" 문구를 덧붙여 실제 체감을 재현 */
  async request(server, opt, label) {
    opt = opt || {};
    this.loading(true, label || '처리 중입니다...', '');
    const slowTimer = setTimeout(() => {
      $('#lo-sub').textContent = '서버 응답이 지연되고 있습니다. 창을 닫지 마세요.';
    }, 1400);
    const res = await server.request(opt);
    clearTimeout(slowTimer);
    this.loading(false);
    return res;
  },

  /* ─────────── 접속 차단 ─────────── */
  block(sec, title, desc) {
    return new Promise(resolve => {
      const o = $('#block-overlay');
      $('#blk-title').textContent = title || '비정상적인 접근이 감지되었습니다';
      $('#blk-desc').textContent = desc || '짧은 시간에 많은 요청이 발생했습니다. 잠시 후 다시 시도해 주세요.';
      o.classList.remove('hidden');
      let left = sec;
      $('#blk-count').textContent = left;
      const iv = setInterval(() => {
        left--;
        $('#blk-count').textContent = Math.max(0, left);
        if (left <= 0) {
          clearInterval(iv);
          o.classList.add('hidden');
          resolve();
        }
      }, 1000);
    });
  },

  /* ─────────── 실시간 피드 ─────────── */
  feed(sel, text, hot) {
    const box = $(sel);
    if (!box) return;
    const el = u.el('div.lf-item' + (hot ? '.hot' : ''), { html: text });
    box.appendChild(el);
    while (box.children.length > 9) box.removeChild(box.firstChild);
  },

  /* ═══════════ 구역 선택 화면 ═══════════
     실제 예매처의 좌석배치도처럼, 무대를 중심으로 부채꼴로 펼친 구역을
     SVG 로 그린다. 구역을 누르면 그 구역의 포도알(좌석)이 열린다. */

  /** 극좌표 → 화면좌표 (도 단위, 0=오른쪽 / 90=아래).
      sy 는 세로 눌림 비율 — 1이면 정원, 0.8이면 납작한 타원 */
  _polar(cx, cy, r, deg, sy) {
    const a = deg * Math.PI / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a) * (sy || 1)];
  },

  /** 구역 모양 → SVG path. 공연장마다 구조가 달라 세 가지를 섞어 쓴다. */
  _shapePath(g, s) {
    if (s.t === 'rect') return `M${s.x} ${s.y} h${s.w} v${s.h} h${-s.w} Z`;
    if (s.t === 'poly') return 'M' + s.pts.trim().split(/\s+/).join(' L') + ' Z';
    return ui._sector(g.cx, g.cy, s.ri, s.ro, s.a1, s.a2, s.sy);
  },

  /** 라벨을 놓을 구역 중심 */
  _shapeCenter(g, s) {
    if (s.t === 'rect') return [s.x + s.w / 2, s.y + s.h / 2];
    if (s.t === 'poly') {
      const pts = s.pts.trim().split(/\s+/).map(q => q.split(',').map(Number));
      return [pts.reduce((a, p) => a + p[0], 0) / pts.length,
              pts.reduce((a, p) => a + p[1], 0) / pts.length];
    }
    return ui._polar(g.cx, g.cy, (s.ri + s.ro) / 2, (s.a1 + s.a2) / 2, s.sy);
  },

  /** 도넛 조각(구역) 경로 */
  _sector(cx, cy, ri, ro, a1, a2, sy) {
    sy = sy || 1;
    const p = (r, d) => ui._polar(cx, cy, r, d, sy);
    const [x1, y1] = p(ro, a1);
    const [x2, y2] = p(ro, a2);
    const [x3, y3] = p(ri, a2);
    const [x4, y4] = p(ri, a1);
    const big = (a2 - a1) > 180 ? 1 : 0;
    const f = n => n.toFixed(1);
    return `M${f(x1)} ${f(y1)} A${ro} ${f(ro * sy)} 0 ${big} 1 ${f(x2)} ${f(y2)}`
         + ` L${f(x3)} ${f(y3)} A${ri} ${f(ri * sy)} 0 ${big} 0 ${f(x4)} ${f(y4)} Z`;
  },

  renderVenue(map, cfg, onPick) {
    const NS = 'http://www.w3.org/2000/svg';
    const svgEl = (tag, attrs) => {
      const n = document.createElementNS(NS, tag);
      for (const k in attrs) n.setAttribute(k, attrs[k]);
      return n;
    };

    const wrap = $('#venue');
    wrap.textContent = '';

    // 공연장이 바뀌면 등급 목록도 다시 만들어야 한다
    const gl = $('#grade-list');
    gl.textContent = '';
    delete gl.dataset.built;

    const venue = TP.venueOf(cfg);
    const g = venue.map;
    const svg = svgEl('svg', { viewBox: g.viewBox, class: 'venue-svg' });

    /* 무대 */
    const st = g.stage;
    svg.appendChild(svgEl('rect', {
      x: st.x, y: st.y, width: st.w, height: st.h, rx: 6, class: 'vm-stage'
    }));
    const stText = svgEl('text', {
      x: st.x + st.w / 2, y: st.y + st.h / 2, class: 'vm-stage-t',
      'text-anchor': 'middle', 'dominant-baseline': 'central'
    });
    stText.textContent = 'STAGE';
    svg.appendChild(stText);

    /* 구역 */
    ui._zoneEls = {};
    venue.rows.forEach(row => {
      row.forEach(tpl => {
        const z = map.zone(tpl.id);
        const color = TP.GRADES[z.grade].color;

        const node = svgEl('g', {
          class: 'vm-zone', 'data-zone': z.id, tabindex: '0', role: 'button'
        });
        const path = svgEl('path', {
          d: ui._shapePath(g, tpl.shape),
          class: 'vm-shape', fill: color, stroke: color, 'fill-opacity': '0.4'
        });
        node.appendChild(path);

        // 라벨은 구역 중앙에 수평으로 놓아야 읽힌다
        const [lx, ly] = ui._shapeCenter(g, tpl.shape);
        const name = svgEl('text', {
          x: lx.toFixed(1), y: (ly - 6).toFixed(1), class: 'vm-name',
          'text-anchor': 'middle', 'dominant-baseline': 'central'
        });
        name.textContent = z.name;
        node.appendChild(name);

        const left = svgEl('text', {
          x: lx.toFixed(1), y: (ly + 9).toFixed(1), class: 'vm-left',
          'text-anchor': 'middle', 'dominant-baseline': 'central'
        });
        left.textContent = '—';
        node.appendChild(left);

        const title = svgEl('title');
        title.textContent = z.name + ' · ' + TP.GRADES[z.grade].name + ' ' + u.won(TP.GRADES[z.grade].price);
        node.appendChild(title);

        const pick = () => { if (!node.classList.contains('off')) onPick(z.id); };
        node.addEventListener('click', pick);
        node.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); }
        });

        svg.appendChild(node);
        ui._zoneEls[z.id] = { node, path, left };
      });
    });

    wrap.appendChild(svg);
    wrap.appendChild(u.el('p.vm-hint', {
      html: '구역을 누르면 <b>포도알(좌석)</b>이 열립니다. 색이 옅어진 구역은 그만큼 팔린 구역입니다.'
    }));
  },

  updateVenue(map) {
    if (!ui._zoneEls) return;
    map.zoneStats().forEach(st => {
      const el = ui._zoneEls[st.zone.id];
      if (!el) return;
      const sold = st.left === 0;
      el.left.textContent = sold ? '매진' : u.n(st.left) + '석';
      // 남은 좌석이 많을수록 진하게 — 배치도만 봐도 어디가 남았는지 보이게
      el.path.setAttribute('fill-opacity', sold ? 0.05 : (0.14 + st.ratio * 0.52).toFixed(3));
      el.node.classList.toggle('off', sold);
      el.node.classList.toggle('low', !sold && st.ratio < 0.12);
      el.node.classList.toggle('mid', !sold && st.ratio >= 0.12 && st.ratio < 0.35);
    });

    // 등급별 잔여 — 공연장마다 등급 구성이 다르므로 실제로 있는 등급만 띄운다
    const gl = $('#grade-list');
    const gs = map.gradeStats();
    if (!gl.dataset.built) {
      gl.textContent = '';
      for (const key in TP.GRADES) {
        if (!gs[key] || gs[key].total === 0) continue;
        const g = TP.GRADES[key];
        const item = u.el('div.grade-item', { 'data-g': key }, [
          u.el('i.gi-dot', { style: `background:${g.color}` }),
          u.el('div', {}, [
            u.el('div.gi-name', { text: g.name }),
            u.el('div.gi-price', { text: u.won(g.price) })
          ]),
          u.el('div.gi-left', { text: '—' })
        ]);
        gl.appendChild(item);
      }
      gl.dataset.built = '1';
    }
    u.$$('.grade-item', gl).forEach(item => {
      const k = item.dataset.g, s = gs[k];
      item.querySelector('.gi-left').textContent = s.left > 0 ? u.n(s.left) : '매진';
      item.querySelector('.gi-left').style.color = s.left === 0 ? '#ff4757' : '';
    });
  },

  /* ═══════════ 좌석 선택 화면 ═══════════ */
  renderSeats(zone, onSeat) {
    const grid = $('#seat-grid');
    grid.textContent = '';
    ui._seatEls = {};
    for (let r = 0; r < zone.rows; r++) {
      const rowEl = u.el('div.seat-row');
      rowEl.appendChild(u.el('div.seat-rowlabel', { text: (r + 1) + '열' }));
      for (let c = 0; c < zone.cols; c++) {
        // 6칸마다 통로를 두어 실제 좌석표처럼 보이게
        if (c > 0 && c % 6 === 0) rowEl.appendChild(u.el('div.seat-aisle'));
        const seat = zone.seats[r * zone.cols + c];
        const el = u.el('button.seat', {
          type: 'button',
          title: `${zone.name} ${seat.label}`,
          'data-id': seat.id
        });
        rowEl.appendChild(el);
        ui._seatEls[seat.id] = el;
      }
      grid.appendChild(rowEl);
    }
    grid.onclick = (e) => {
      const el = e.target.closest('.seat');
      if (!el) return;
      onSeat(el.dataset.id);
    };
    ui.syncSeats(zone);
  },

  /** 상태가 바뀐 좌석만 클래스를 갱신 */
  syncSeats(zone) {
    if (!ui._seatEls) return;
    for (const seat of zone.seats) {
      const el = ui._seatEls[seat.id];
      if (!el) continue;
      const cls = seat.state === 'available' ? 'av'
                : seat.state === 'hold' ? 'hold'
                : seat.state === 'mine' ? 'mine' : 'sold';
      if (el.dataset.st !== cls) {
        el.dataset.st = cls;
        el.className = 'seat ' + cls;
      }
    }
  },

  renderPicked(map, cfg, onRemove) {
    const box = $('#picked-list');
    const qty = cfg.qty || map.mine.length || 1;
    box.textContent = '';
    if (!map.mine.length) {
      box.appendChild(u.el('p.empty', { text: `좌석 ${qty}매를 선택해 주세요.` }));
    } else {
      map.mine.forEach(seat => {
        const g = TP.GRADES[seat.grade];
        box.appendChild(u.el('div.pick-item', {}, [
          u.el('span.pi-grade', { text: g.name, style: `background:${g.color}22;color:${g.color}` }),
          u.el('div', {}, [
            u.el('div.pi-name', { text: seat.zoneName }),
            u.el('div.pi-price', { text: seat.label })
          ]),
          u.el('span.pi-price', { text: u.won(seat.price) }),
          u.el('button.pi-del', { type: 'button', text: '×', title: '선택 해제', onclick: () => onRemove(seat) })
        ]));
      });
    }
    const total = map.mine.reduce((a, s) => a + s.price, 0);
    $('#pick-count').textContent = `${map.mine.length} / ${qty}매`;
    $('#pick-price').textContent = u.won(total);
    const btn = $('#btn-to-next');
    btn.disabled = map.mine.length === 0;
    // 원하는 매수를 다 못 잡아도 진행은 막지 않는다 (실전에서도 매수를 줄여 예매한다)
    btn.textContent = map.mine.length && map.mine.length < qty
      ? `${map.mine.length}매로 진행하기` : '다음 단계';
  },

  /* ═══════════ 보안문자 ═══════════
     생성·렌더링은 js/captcha.js 에 있다 (단독 연습 페이지와 공유). */
  captcha: {
    answer: '',
    draw(rng) {
      this.answer = TP.Captcha.render($('#captcha-canvas'), rng, 'normal');
      return this.answer;
    },
    check(input) {
      return TP.Captcha.matches(input, this.answer);
    }
  },

  /* ═══════════ 레이더 차트 ═══════════ */
  radar(canvas, axes) {
    const dpr = window.devicePixelRatio || 1;
    const size = 300;
    canvas.width = size * dpr; canvas.height = size * dpr;
    canvas.style.width = '100%'; canvas.style.maxWidth = size + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const cx = size / 2, cy = size / 2 + 6, R = size * 0.33;
    const n = axes.length;
    const pt = (i, r) => {
      const a = -Math.PI / 2 + i * 2 * Math.PI / n;
      return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
    };

    ctx.clearRect(0, 0, size, size);

    // 격자
    for (let g = 1; g <= 4; g++) {
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const [x, y] = pt(i, R * g / 4);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = g === 4 ? '#39424f' : '#252b38';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    for (let i = 0; i < n; i++) {
      const [x, y] = pt(i, R);
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(x, y);
      ctx.strokeStyle = '#252b38'; ctx.stroke();
    }

    // 값
    ctx.beginPath();
    axes.forEach((a, i) => {
      const [x, y] = pt(i, R * Math.max(a.score, 3) / 100);
      i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
    });
    ctx.closePath();
    ctx.fillStyle = 'rgba(255,71,87,.22)';
    ctx.fill();
    ctx.strokeStyle = '#ff4757';
    ctx.lineWidth = 2;
    ctx.stroke();

    axes.forEach((a, i) => {
      const [x, y] = pt(i, R * Math.max(a.score, 3) / 100);
      ctx.beginPath(); ctx.arc(x, y, 3.4, 0, 7);
      ctx.fillStyle = a.measured ? '#ff4757' : '#6f7b90';
      ctx.fill();
    });

    // 라벨
    ctx.font = '600 11.5px -apple-system,"Malgun Gothic",sans-serif';
    ctx.fillStyle = '#a9b4c6';
    axes.forEach((a, i) => {
      const [x, y] = pt(i, R + 24);
      ctx.textAlign = Math.abs(x - cx) < 6 ? 'center' : x > cx ? 'left' : 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(a.label, x - (ctx.textAlign === 'left' ? 6 : ctx.textAlign === 'right' ? -6 : 0), y);
      if (a.measured) {
        ctx.fillStyle = '#6f7b90';
        ctx.font = '600 10px ui-monospace,monospace';
        ctx.fillText(Math.round(a.score), x - (ctx.textAlign === 'left' ? 6 : ctx.textAlign === 'right' ? -6 : 0), y + 13);
        ctx.font = '600 11.5px -apple-system,"Malgun Gothic",sans-serif';
        ctx.fillStyle = '#a9b4c6';
      }
    });
  },

  /* ═══════════ 내 반응속도 추이 ═══════════
     실제로 저장된 내 지난 기록만 그린다. 가상 데이터는 쓰지 않는다. */
  trendChart(canvas, trend) {
    const W = canvas.clientWidth || 520, H = 200;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.width = '100%'; canvas.style.height = H + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const padL = 46, padR = 14, padT = 16, padB = 26;
    const n = trend.length;
    const vals = trend.map(t => t.ms);
    let lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    // 기록이 하나거나 차이가 거의 없으면 축이 찌그러지지 않게 폭을 준다
    if (hi - lo < 60) { const m = (hi + lo) / 2; lo = m - 40; hi = m + 40; }
    const pad = (hi - lo) * 0.18;
    lo = Math.max(0, lo - pad); hi = hi + pad;

    const X = i => n === 1 ? (padL + W - padR) / 2
                           : padL + i / (n - 1) * (W - padL - padR);
    const Y = v => padT + (1 - (v - lo) / (hi - lo)) * (H - padT - padB);

    /* 가로 기준선 */
    ctx.font = '500 10px ui-monospace,monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let g = 0; g <= 3; g++) {
      const v = lo + (hi - lo) * g / 3;
      const y = Y(v);
      ctx.beginPath();
      ctx.moveTo(padL, y); ctx.lineTo(W - padR, y);
      ctx.strokeStyle = '#252b38'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#6f7b90';
      ctx.fillText(TP.u.ms(v), padL - 7, y);
    }

    /* 개인 최고 기록선 */
    const bestV = Math.min.apply(null, vals);
    const by = Y(bestV);
    ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(padL, by); ctx.lineTo(W - padR, by);
    ctx.strokeStyle = '#22c98f'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.setLineDash([]);

    /* 추이선 */
    if (n > 1) {
      ctx.beginPath();
      trend.forEach((t, i) => {
        const x = X(i), y = Y(t.ms);
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      });
      ctx.strokeStyle = '#4a86ff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    /* 각 판 */
    trend.forEach((t, i) => {
      const x = X(i), y = Y(t.ms);
      if (t.current) {
        ctx.beginPath(); ctx.arc(x, y, 8, 0, 7);
        ctx.strokeStyle = 'rgba(255,71,87,.45)'; ctx.lineWidth = 3; ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(x, y, t.current ? 5 : 3.2, 0, 7);
      ctx.fillStyle = t.current ? '#ff4757' : '#4a86ff';
      ctx.fill();
    });

    /* 축 라벨 */
    ctx.font = '600 10px -apple-system,"Malgun Gothic",sans-serif';
    ctx.textBaseline = 'top';
    if (n > 1) {
      ctx.textAlign = 'left';
      ctx.fillStyle = '#6f7b90';
      ctx.fillText('지난 연습', padL, H - padB + 8);
    }
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ff6b7a';
    ctx.fillText('이번 기록', W - padR, H - padB + 8);
  },

  /* ═══════════ 마우스 경로 ═══════════ */
  mousePath(canvas, path, clicks) {
    if (!path.length) return;
    const W = canvas.clientWidth || 600, H = Math.round(W * 0.42);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr; canvas.height = H * dpr;
    canvas.style.height = H + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const vw = window.innerWidth, vh = window.innerHeight;
    const s = Math.min(W / vw, H / vh) * 0.94;
    const ox = (W - vw * s) / 2, oy = (H - vh * s) / 2;
    const X = x => ox + x * s, Y = y => oy + y * s;

    ctx.strokeStyle = '#2a3140';
    ctx.strokeRect(X(0), Y(0), vw * s, vh * s);

    // 시간이 흐를수록 색이 변해 어느 순간에 헤맸는지 보이게 한다
    for (let i = 1; i < path.length; i++) {
      const t = i / path.length;
      ctx.beginPath();
      ctx.moveTo(X(path[i - 1][0]), Y(path[i - 1][1]));
      ctx.lineTo(X(path[i][0]), Y(path[i][1]));
      ctx.strokeStyle = `hsla(${210 - t * 200},80%,62%,.5)`;
      ctx.lineWidth = 1.1;
      ctx.stroke();
    }
    clicks.forEach(c => {
      ctx.beginPath();
      ctx.arc(X(c.x), Y(c.y), c.kind === 'hit' ? 3.2 : 2.6, 0, 7);
      ctx.fillStyle = c.kind === 'hit' ? 'rgba(34,201,143,.85)' : c.kind === 'dead' ? 'rgba(255,176,32,.85)' : 'rgba(255,71,87,.85)';
      ctx.fill();
    });
  }
};

})(window.TP);
