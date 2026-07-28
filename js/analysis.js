/* ═══════════════════════════════════════════════
   analysis.js — 연습 결과 분석 · 피드백 생성
   계측된 원자료를 지표로 환산하고, 벤치마크와 비교해
   무엇이 부족했는지와 어떻게 고칠지를 문장으로 만든다.
   ═══════════════════════════════════════════════ */
(function (TP) {

/* 값 → 0~100 점수. 벤치마크 경계를 앵커로 두고 구간 선형 보간한다. */
function scoreOf(v, b) {
  const t = b.tiers;
  const anchors = b.lower
    ? [[0, 100], [t[0], 88], [t[1], 70], [t[2], 50], [t[3], 28], [t[3] * 2.2, 3]]
    : [[t[0] * 1.3, 100], [t[0], 88], [t[1], 70], [t[2], 50], [t[3], 28], [0, 0]];
  // 항상 x 오름차순으로 정렬해 보간
  const pts = anchors.slice().sort((a, c) => a[0] - c[0]);
  if (v <= pts[0][0]) return pts[0][1];
  if (v >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
  for (let i = 1; i < pts.length; i++) {
    if (v <= pts[i][0]) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      return TP.u.clamp(y0 + (y1 - y0) * (v - x0) / Math.max(x1 - x0, 1e-9), 0, 100);
    }
  }
  return 50;
}

function tierOf(v, b) {
  const t = b.tiers;
  if (b.lower) {
    for (let i = 0; i < t.length; i++) if (v <= t[i]) return i;
  } else {
    for (let i = 0; i < t.length; i++) if (v >= t[i]) return i;
  }
  return 4;
}

function fmt(v, b) {
  if (v == null) return '측정 안 됨';
  if (b.unit === 'ms') return TP.u.ms(v);
  if (b.unit === '%') return v.toFixed(0) + '%';
  if (b.unit === '회/초') return v.toFixed(1) + '회/초';
  return Math.round(v) + b.unit;
}

/**
 * @param {object} run  { success, reason, cfg, map, queue, server, seatCount, price }
 */
TP.analyze = function (run) {
  const T = TP.telemetry;
  const cfg = run.cfg;

  /* ─────────── 원자료 → 지표 ─────────── */
  const raw = {
    reaction:  run.reactionMs,
    schedTime: run.schedTimeMs,
    seatTime:  run.seatTimeMs,
    clickAcc:  T.clickAccuracy(),
    mouseEff:  T.mouseEfficiency(),
    clickRate: T.peakClickRate(),
    captcha:   run.captchaMs,
    composure: T.composure()
  };

  const metrics = [];
  const order = ['reaction', 'schedTime', 'seatTime', 'clickRate', 'clickAcc', 'mouseEff', 'captcha', 'composure'];
  for (const key of order) {
    const b = TP.BENCH[key];
    const v = raw[key];
    const available = v != null && isFinite(v);
    metrics.push({
      key, label: b.label, desc: b.desc, unit: b.unit,
      value: available ? v : null,
      display: fmt(available ? v : null, b),
      score: available ? scoreOf(v, b) : null,
      tier: available ? tierOf(v, b) : null,
      target: b.lower ? `${fmt(b.tiers[1], b)} 이내` : `${fmt(b.tiers[1], b)} 이상`
    });
  }

  /* ─────────── 종합 점수 ─────────── */
  const weights = { reaction: 2.4, schedTime: 1.3, seatTime: 1.9, clickRate: 1.0, clickAcc: 1.2, mouseEff: 0.9, captcha: 0.8, composure: 1.4 };
  let sum = 0, wsum = 0;
  metrics.forEach(m => {
    if (m.score == null) return;
    sum += m.score * weights[m.key];
    wsum += weights[m.key];
  });
  const overallScore = wsum ? sum / wsum : 0;
  const gradeIdx = overallScore >= 85 ? 0 : overallScore >= 70 ? 1 : overallScore >= 55 ? 2 : overallScore >= 38 ? 3 : 4;
  const grade = TP.TIER_NAMES[gradeIdx];

  /* ─────────── 결과 판정 ─────────── */
  const outcome = { success: run.success };
  if (run.success) {
    const hitTarget = cfg.target === 'any' || run.map.meetsTarget(cfg.target);
    outcome.title = '예매 성공';
    const tgt = TP.TARGETS.find(t => t.id === cfg.target);
    outcome.desc = `${run.seatCount}매 · ${TP.u.won(run.price)} · 결제 직전 단계까지 도달했습니다.` +
      (cfg.target !== 'any' ? (hitTarget ? ` 목표(${tgt.label})도 달성했습니다.` : ` 다만 목표했던 ${tgt.label}는 잡지 못했습니다.`) : '');
    outcome.hitTarget = hitTarget;
  } else {
    outcome.title = run.reason === 'soldout' ? '전석 매진' :
                    run.reason === 'timeout' ? '시간 초과' :
                    run.reason === 'quit'    ? '연습 중단' : '예매 실패';
    outcome.desc = {
      soldout: '좌석을 확보하기 전에 모든 좌석이 판매되었습니다. 대기열 진입 순번이 결정적이었습니다.',
      timeout: '제한 시간 안에 결제 단계까지 도달하지 못했습니다.',
      quit:    '연습을 중단했습니다. 여기까지의 기록만 분석합니다.',
      fail:    '예매를 완료하지 못했습니다.'
    }[run.reason] || '예매를 완료하지 못했습니다.';
  }

  /* ─────────── 피드백 규칙 ───────────
     심각한 것부터 위로 올라오도록 priority 로 정렬한다. */
  const fb = [];
  const M = k => metrics.find(m => m.key === k);
  const add = (kind, icon, title, body, drill, priority) =>
    fb.push({ kind, icon, title, body, drill, priority });

  const rx = M('reaction');
  if (rx.value != null) {
    if (rx.tier >= 3) {
      add('crit', '🐢', '오픈 순간의 반응이 결정적으로 늦었습니다',
        `예매 버튼을 누르기까지 ${TP.u.ms(rx.value)}가 걸렸습니다. 이 지연이 대기 순번 ${TP.u.n(run.aheadStart)}번으로 이어졌고, 이후에 무엇을 하든 만회하기 어려운 위치였습니다. 티켓팅에서 이 지표 하나가 결과의 절반 이상을 결정합니다.`,
        '<b>훈련법</b> — 오픈 10초 전부터 커서를 예매 버튼 위에 올려두고, 시계만 보면서 손가락에 힘을 준 채 대기하세요. 화면 변화를 "확인하고" 누르면 이미 늦습니다. 카운트다운 숫자에 맞춰 반사적으로 누르는 연습을 낮은 난이도에서 20회 반복하세요.', 100);
    } else if (rx.tier === 2) {
      add('warn', '⏱️', '반응속도를 조금만 더 줄이면 순번이 크게 바뀝니다',
        `${TP.u.ms(rx.value)}로 평균 수준입니다. 이 구간에서는 0.2초를 줄일 때마다 대기 순번이 수천 명 단위로 앞당겨집니다. 가장 투자 대비 효율이 좋은 지점입니다.`,
        '<b>훈련법</b> — 클릭 대상이 어디에 나타날지 미리 외워두면 "찾는 시간"이 사라집니다. 같은 공연으로 5회 연속 연습해 버튼 위치를 손에 익히세요.', 70);
    } else {
      add('good', '⚡', '반응속도는 상위권입니다',
        `${TP.u.ms(rx.value)}는 실제 티켓팅에서도 충분히 통하는 속도입니다. 이 강점은 유지하고 다른 지표를 끌어올리세요.`, null, 10);
    }
  }

  const sc = M('schedTime');
  if (sc.value != null) {
    if (sc.tier >= 3) {
      add('crit', '📅', '어느 회차를 잡을지 정하지 않은 채 들어갔습니다',
        `날짜·회차 화면에서 ${TP.u.ms(sc.value)}를 썼습니다. 대기열을 뚫고 들어온 직후는 좌석이 가장 빠르게 사라지는 구간인데, 그 시간을 회차 비교에 쓴 셈입니다. 좌석 화면에 도달했을 때 이미 ${Math.round(run.soldAtEntry * 100)}%가 팔려 있었습니다.`,
        '<b>훈련법</b> — 예매 전에 <b>1지망·2지망 회차를 종이에 적어두세요.</b> 화면이 뜨면 비교하지 말고 1지망을 즉시 누릅니다. 매진이면 2지망으로 갑니다. 이 화면에서의 고민은 전부 손해입니다.', 88);
    } else if (sc.tier === 2) {
      add('warn', '📅', '회차 선택에서 잠깐 망설였습니다',
        `${TP.u.ms(sc.value)}가 걸렸습니다. 잔여석 숫자를 하나하나 확인하고 있었다면, 그 사이에 그 숫자도 계속 줄고 있었습니다.`,
        '<b>훈련법</b> — 인기 회차(주말·막공)는 경쟁률이 높은 대신 좌석 수는 같습니다. 좋은 자리를 원하면 평일 회차가, 특정 날짜가 목표라면 고민 없이 그 회차를 바로 누르는 편이 낫습니다.', 56);
    }
  }

  if (T.get('refresh') > 0) {
    add('crit', '🔄', `대기열에서 새로고침을 ${T.get('refresh')}회 눌렀습니다`,
      `새로고침으로 순번이 총 ${TP.u.n(run.pushedBack)}명 뒤로 밀렸습니다. 이 연습에서는 페널티를 짧게 줄여뒀지만, <b>실제 예매처에서는 사실상 꼴찌로 밀려 그 판은 끝납니다.</b> 화면이 멈춘 것처럼 보여도 그것은 서버가 처리 중이라는 뜻이지 접속이 끊긴 것이 아닙니다.`,
      '<b>원칙</b> — 대기열에서는 <b>어떤 경우에도 새로고침·뒤로가기·창 닫기를 하지 않습니다.</b> 숫자가 1~2분 멈춰 있어도 그대로 두세요. 손이 근질거린다면 마우스에서 손을 떼는 것이 가장 확실한 방법입니다.', 98);
  }

  if (T.get('blocked') > 0) {
    add('crit', '⛔', '과도한 새로고침으로 접속이 차단되었습니다',
      `연습 중 ${T.get('blocked')}회 차단당했습니다. 실제 예매처에서는 부정예매 방지 정책에 따라 더 긴 시간 차단되거나 계정 제재로 이어질 수 있습니다.`,
      '<b>원칙</b> — 반복 클릭·연타 새로고침은 속도를 올려주지 않고 오히려 차단 위험만 키웁니다. 한 번 요청했으면 응답이 올 때까지 기다리세요.', 97);
  }

  const st = M('seatTime');
  if (st.value != null) {
    if (st.tier >= 3) {
      add('crit', '🪑', '좌석을 고르는 데 너무 오래 걸렸습니다',
        `좌석 화면 진입부터 첫 좌석 확보까지 ${TP.u.ms(st.value)}가 걸렸습니다. 이 시간 동안 경쟁자들이 좋은 자리를 모두 가져갑니다. 화면에 들어간 뒤에 고민을 시작하면 늦습니다.`,
        '<b>훈련법</b> — 들어가기 전에 <b>1지망·2지망·3지망 구역을 미리 정해두세요.</b> 화면이 뜨면 판단하지 말고 정해둔 구역을 바로 클릭합니다. 같은 공연장을 반복 연습해 좌석 배치도를 외우는 것이 가장 효과적입니다.', 90);
    } else if (st.tier === 2) {
      add('warn', '🪑', '좌석 선택에서 한 박자 망설였습니다',
        `${TP.u.ms(st.value)}가 걸렸습니다. 나쁘지 않지만, 인기 공연에서는 이 몇 초 사이에 원하는 등급이 사라집니다.`,
        '<b>훈련법</b> — "일단 아무 자리나 잡고, 시간 안에 더 좋은 자리로 바꾼다"가 정석입니다. 좌석은 잡아둔 상태에서 여유가 생기니 완벽한 자리를 처음부터 찾지 마세요.', 62);
    } else {
      add('good', '🎯', '좌석 선택 판단이 빠릅니다',
        `${TP.u.ms(st.value)} 만에 좌석을 확보했습니다. 화면을 읽는 속도가 이미 몸에 배어 있습니다.`, null, 12);
    }
  }

  const acc = M('clickAcc');
  if (acc.value != null && acc.tier >= 2) {
    add('warn', '🎯', '헛클릭이 많습니다',
      `유효 클릭 비율이 ${acc.display}입니다. 빈 공간이나 이미 판매된 좌석을 ${T.get('deadClick') + T.get('missClick')}회 눌렀습니다. 조급할수록 클릭이 흩어지고, 흩어진 클릭은 시간만 잡아먹습니다.`,
      '<b>훈련법</b> — 클릭 전에 대상을 한 번 "본" 다음 누르는 습관을 들이세요. 특히 회색(판매완료) 좌석을 반복해서 누르는 것은 아무 효과가 없습니다. 색으로 상태를 먼저 구분하는 연습을 하세요.', 66);
  }

  const me = M('mouseEff');
  if (!T.hasMouse) {
    add('warn', '📱', '마우스 지표는 측정되지 않았습니다',
      '터치 환경(휴대폰·태블릿)으로 감지되어 마우스 이동거리와 경로 효율은 분석에서 제외했습니다. 실제 티켓팅은 화면이 크고 클릭이 정확한 PC + 유선 마우스 환경이 확실히 유리합니다.',
      '<b>권장</b> — 실전은 PC로 준비하세요. 노트북 터치패드보다 유선 마우스가, 무선 마우스보다 유선이 반응이 안정적입니다.', 55);
  } else if (me.value != null) {
    if (me.tier >= 3) {
      add('crit', '🖱️', '커서가 화면에서 헤맸습니다',
        `경로 효율이 ${me.display}에 그쳤습니다. 총 ${TP.u.n(T.moveDist)}px를 움직였는데, 클릭 지점만 직선으로 이었다면 그 ${me.display}면 충분했습니다. 목표를 정하지 않은 채 커서를 먼저 움직이고 있다는 신호입니다.`,
        '<b>훈련법</b> — <b>커서를 움직이기 전에 눈으로 먼저 목표를 찍으세요.</b> 눈 → 결정 → 커서 순서입니다. 커서로 화면을 훑으면서 찾으면 항상 늦습니다. 마우스 감도(DPI)가 너무 낮아 여러 번 나눠 움직이고 있지는 않은지도 확인하세요.', 85);
    } else if (me.tier === 2) {
      add('warn', '🖱️', '커서 동선에 낭비가 있습니다',
        `경로 효율 ${me.display}. 이동거리 ${TP.u.n(T.moveDist)}px 중 상당 부분이 목표 없는 움직임이었습니다.`,
        '<b>훈련법</b> — 다음 클릭 위치를 미리 예측해 그 근처에 커서를 대기시켜 두세요. 좌석 확정 버튼처럼 위치가 고정된 요소는 특히 효과가 큽니다.', 58);
    } else {
      add('good', '🖱️', '커서 움직임이 군더더기 없습니다',
        `경로 효율 ${me.display}. 목표를 정하고 움직이는 습관이 잡혀 있습니다.`, null, 14);
    }
  }

  const cr = M('clickRate');
  if (cr.value != null && cr.tier >= 3) {
    add('warn', '👆', '순간 클릭 속도가 느립니다',
      `가장 빨랐던 1초에 ${cr.display}였습니다. 좌석 선점 경쟁은 실패해도 곧바로 다음 좌석을 눌러야 하는 구간이라 연속 클릭 속도가 성공률에 직접 영향을 줍니다.`,
      '<b>훈련법</b> — 검지 하나로만 누르지 말고 손목을 고정한 채 손가락 끝만 튕기듯 누르세요. 다만 <b>같은 자리를 연타하는 것은 무의미</b>합니다. 실패하면 옆 좌석으로 옮겨서 누르는 것이 핵심입니다.', 50);
  }

  const cp = M('captcha');
  if (cp.value != null && cp.tier >= 2) {
    add('warn', '🔤', '보안문자 구간에서 시간을 잃었습니다',
      `${TP.u.ms(cp.value)}가 걸렸고 ${T.get('captchaFail')}회 틀렸습니다. 이 화면은 <b>좌석을 보기도 전</b>에 나오기 때문에, 여기서 흘린 시간만큼 좌석이 팔린 상태로 들어가게 됩니다.`,
      '<b>훈련법</b> — 보안문자는 <b>보면서 바로 타이핑</b>합니다. 전체를 외운 뒤 입력하려 하면 두 배로 느려집니다. 헷갈리면 외우려 애쓰지 말고 새로고침해서 읽기 쉬운 것을 받는 편이 빠릅니다.', 46);
  }

  const co = M('composure');
  if (co.value != null && co.tier >= 2) {
    add('warn', '😰', '당황 신호가 감지되었습니다',
      `침착도 ${co.display}. 새로고침 ${T.get('refresh')}회, 판매완료 좌석 클릭 ${T.get('deadClick')}회, 허공 클릭 ${T.get('missClick')}회가 기록됐습니다. 티켓팅에서 실패의 절반은 속도가 아니라 조급함에서 나옵니다.`,
      '<b>훈련법</b> — 실패 상황을 미리 정해두세요. "좌석 선점 실패 → 바로 옆 좌석", "대기열 멈춤 → 손 떼고 대기", "오류 팝업 → 확인만 누르고 그대로 진행". 미리 정해두면 당황할 일이 없습니다.', 72);
  } else if (co.value != null && co.tier <= 1) {
    add('good', '🧊', '끝까지 침착했습니다',
      `침착도 ${co.display}. 불필요한 새로고침과 연타 없이 흐름을 유지했습니다. 실전에서 가장 크게 작용하는 강점입니다.`, null, 16);
  }

  if (run.seatFails > 0) {
    add('warn', '⚔️', `좌석 선점 경쟁에서 ${run.seatFails}회 밀렸습니다`,
      `클릭은 했지만 서버 응답이 도착했을 때 이미 다른 사람이 가져간 좌석이었습니다. 이 중 상당수는 당신의 실수가 아니라 응답 지연(평균 ${Math.round(run.avgLatency)}ms) 때문입니다. 다만 인기 좌석일수록 경쟁률이 높다는 점은 전략으로 피할 수 있습니다.`,
      '<b>전략</b> — 모두가 노리는 중앙 앞줄 대신 <b>한 칸 옆·한 줄 뒤</b>를 노리세요. 체감 차이는 작고 성공률은 크게 오릅니다. 구역 경계 좌석도 경쟁이 덜합니다.', 60);
  }

  if (run.errorsHit > 0) {
    add('warn', '⚠️', `서버 오류를 ${run.errorsHit}회 만났습니다`,
      `이번 연습의 평균 응답 지연은 ${Math.round(run.avgLatency)}ms, 최고 서버 부하는 ${Math.round(run.peakLoad * 100)}%였습니다. 오류 자체는 막을 수 없지만, 오류가 떴을 때 <b>얼마나 빨리 원래 흐름으로 복귀하는가</b>는 실력입니다.`,
      '<b>훈련법</b> — 오류 팝업이 뜨면 내용을 읽지 말고 확인 버튼 위치만 보고 즉시 닫으세요. 팝업 문구는 대부분 동일합니다.', 44);
  }

  if (!run.success && run.reason === 'soldout') {
    add('crit', '🎫', '좌석 화면에 도달했을 때 이미 늦었습니다',
      `대기열을 통과했을 때 전체 좌석의 ${Math.round(run.soldAtEntry * 100)}%가 팔린 상태였습니다. 좌석 선택 실력과 무관하게, 대기열 진입 순번 자체가 승부였습니다.`,
      '<b>핵심</b> — 이 상황을 바꾸는 방법은 단 하나, <b>오픈 순간의 클릭을 더 빠르게</b> 하는 것입니다. 좌석 연습보다 반응속도 연습에 시간을 쓰세요.', 95);
  }

  fb.sort((a, b) => b.priority - a.priority);

  /* ─────────── 레이더 축 ─────────── */
  const radar = [
    { label: '반응속도', score: M('reaction').score },
    { label: '회차선택', score: M('schedTime').score },
    { label: '좌석선택', score: M('seatTime').score },
    { label: '클릭속도', score: M('clickRate').score },
    { label: '정확도',   score: M('clickAcc').score },
    { label: '커서효율', score: M('mouseEff').score },
    { label: '침착도',   score: M('composure').score }
  ].map(a => ({ label: a.label, score: a.score == null ? 0 : a.score, measured: a.score != null }));

  return {
    outcome, metrics, radar,
    grade, gradeIdx, overallScore,
    gradeText: TP.GRADE_TEXT[grade],
    feedbacks: fb.slice(0, 7),
    timeline: TP.telemetry.events.slice(),
    stats: {
      moveDist: T.moveDist,
      hasMouse: T.hasMouse,
      totalClicks: T.clicks.length,
      refresh: T.get('refresh'),
      deadClick: T.get('deadClick'),
      duration: run.totalMs
    }
  };
};

})(window.TP);
