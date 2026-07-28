/* ═══════════════════════════════════════════════
   data.js — 공연 / 공연장 / 난이도 / 등급 / 벤치마크
   ═══════════════════════════════════════════════ */
(function (TP) {

/* ─────────── 좌석 등급 ─────────── */
TP.GRADES = {
  VIP: { name: 'VIP석', price: 187000, color: '#a978ff' },
  R:   { name: 'R석',   price: 154000, color: '#ff4757' },
  S:   { name: 'S석',   price: 121000, color: '#4a86ff' },
  A:   { name: 'A석',   price:  99000, color: '#22c98f' }
};

/* ─────────── 공연장 레이아웃 ───────────
   rows = 무대에서 먼 순서대로 배치되는 구역 줄. (앞 줄일수록 선호도가 높다)
   r/c 는 기준 규모이며 난이도의 목표 좌석수에 맞춰 비례 축소/확대된다.

   shape — 구역의 모양. 공연장마다 실루엣이 완전히 다르도록 세 가지를 섞는다.
     { t:'rect', x, y, w, h }               사각 블록
     { t:'arc',  ri, ro, a1, a2, sy }       도넛 조각. map.cx/cy 기준.
                                            a = 각도(도). 0=오른쪽, 90=아래, 180=왼쪽.
                                            음수면 무대 옆·뒤까지 올라간다.
                                            sy = 세로 눌림 비율(생략 시 1=정원, 0.8=타원)
     { t:'poly', pts:'x,y x,y ...' }        임의 다각형. 기울어진 스탠드에 쓴다.

   공연장별 실루엣
     hall    부채꼴 — 정면만. 플로어 없음, 뒤 발코니 + 측면 박스
     gym     타원 — 사각 플로어를 납작한 타원 2층이 감쌈
     inspire 말발굽 — 잘게 쪼갠 블록이 간격을 두고 늘어선 신축 아레나
     arena   원형 — 무대 옆·뒤까지 300도 감기는 체조경기장
     dome    야구장 — 파울라인 따라 기울어진 내야 + 깊고 완만한 외야 곡선
     stadium 사각 — 감싸지 않고 마주보는 야외 스탠드

   ※ 실제 공연장의 구조를 참고해 비율을 맞춘 재구성이다.
     공식 좌석배치도가 아니므로 구역 번호와 좌석 수는 실제와 다르다. */
TP.VENUES = {

  /* ── 부채꼴 홀 ── 플로어가 없고 정면으로만 객석이 퍼진다 */
  hall: {
    name: '예술의전당 콘서트홀',
    label: '콘서트홀',
    desc: '정면 부채꼴 객석에 뒤쪽 발코니와 측면 박스석. 좌석이 적어 경쟁이 가장 치열합니다.',
    map: { viewBox: '0 0 600 400', cx: 300, cy: 58, stage: { x: 235, y: 14, w: 130, h: 30 } },
    rows: [
      [
        { id: 'P1', name: '1층 좌측', grade: 'R',   r: 14, c: 10, shape: { t: 'arc', ri: 62, ro: 190, a1: 104, a2: 128 } },
        { id: 'P2', name: '1층 중앙', grade: 'VIP', r: 14, c: 16, shape: { t: 'arc', ri: 62, ro: 190, a1: 78,  a2: 102 } },
        { id: 'P3', name: '1층 우측', grade: 'R',   r: 14, c: 10, shape: { t: 'arc', ri: 62, ro: 190, a1: 52,  a2: 76 } }
      ],
      [
        { id: 'X1', name: '좌측 박스', grade: 'S', r: 6, c: 8, shape: { t: 'arc', ri: 85, ro: 195, a1: 131, a2: 152 } },
        { id: 'X2', name: '우측 박스', grade: 'S', r: 6, c: 8, shape: { t: 'arc', ri: 85, ro: 195, a1: 28,  a2: 49 } }
      ],
      [
        { id: 'B1', name: '2층 좌측', grade: 'S', r: 8, c: 10, shape: { t: 'arc', ri: 200, ro: 250, a1: 104, a2: 128 } },
        { id: 'B2', name: '2층 중앙', grade: 'R', r: 8, c: 16, shape: { t: 'arc', ri: 200, ro: 250, a1: 78,  a2: 102 } },
        { id: 'B3', name: '2층 우측', grade: 'S', r: 8, c: 10, shape: { t: 'arc', ri: 200, ro: 250, a1: 52,  a2: 76 } }
      ],
      [
        { id: 'C1', name: '3층 중앙', grade: 'A', r: 10, c: 20, shape: { t: 'arc', ri: 258, ro: 300, a1: 66, a2: 114 } }
      ]
    ]
  },

  /* ── 타원 체육관 ── 납작하게 눌린 2층 링. 층이 적고 무대와 가깝다 */
  gym: {
    name: '잠실실내체육관',
    label: '실내체육관',
    desc: '사각 플로어를 납작한 타원형 2개 층이 감싸는 중형 경기장. 층이 낮아 무대와 가깝습니다.',
    map: { viewBox: '0 0 600 420', cx: 300, cy: 175, stage: { x: 235, y: 20, w: 130, h: 28 } },
    rows: [
      [
        { id: 'GA', name: '플로어 A', grade: 'VIP', r: 10, c: 14, shape: { t: 'rect', x: 206, y: 62, w: 90, h: 150 } },
        { id: 'GB', name: '플로어 B', grade: 'VIP', r: 10, c: 14, shape: { t: 'rect', x: 304, y: 62, w: 90, h: 150 } }
      ],
      [
        { id: 'G1', name: '1층 A구역', grade: 'R', r: 12, c: 16, shape: { t: 'arc', ri: 150, ro: 205, a1: 145, a2: 198, sy: 0.8 } },
        { id: 'G2', name: '1층 B구역', grade: 'R', r: 12, c: 16, shape: { t: 'arc', ri: 150, ro: 205, a1: 93,  a2: 143, sy: 0.8 } },
        { id: 'G3', name: '1층 C구역', grade: 'R', r: 12, c: 16, shape: { t: 'arc', ri: 150, ro: 205, a1: 39,  a2: 89,  sy: 0.8 } },
        { id: 'G4', name: '1층 D구역', grade: 'R', r: 12, c: 16, shape: { t: 'arc', ri: 150, ro: 205, a1: -16, a2: 37,  sy: 0.8 } }
      ],
      [
        { id: 'G5', name: '2층 A구역', grade: 'S', r: 13, c: 18, shape: { t: 'arc', ri: 213, ro: 265, a1: 145, a2: 198, sy: 0.8 } },
        { id: 'G6', name: '2층 B구역', grade: 'S', r: 13, c: 18, shape: { t: 'arc', ri: 213, ro: 265, a1: 93,  a2: 143, sy: 0.8 } },
        { id: 'G7', name: '2층 C구역', grade: 'S', r: 13, c: 18, shape: { t: 'arc', ri: 213, ro: 265, a1: 39,  a2: 89,  sy: 0.8 } },
        { id: 'G8', name: '2층 D구역', grade: 'S', r: 13, c: 18, shape: { t: 'arc', ri: 213, ro: 265, a1: -16, a2: 37,  sy: 0.8 } }
      ]
    ]
  },

  /* ── 말발굽 아레나 ── 잘게 쪼갠 블록이 통로 간격을 두고 늘어선다 */
  inspire: {
    name: '인스파이어 아레나 (영종도)',
    label: '아레나',
    desc: '공연 전용 신축 아레나. 100번대가 여덟 블록으로 잘게 나뉘어 말발굽을 이룹니다.',
    map: { viewBox: '0 0 600 450', cx: 300, cy: 140, stage: { x: 215, y: 24, w: 170, h: 34 } },
    rows: [
      [
        { id: 'IA', name: '플로어 A', grade: 'VIP', r: 10, c: 15, shape: { t: 'rect', x: 180, y: 78, w: 78, h: 117 } },
        { id: 'IB', name: '플로어 B', grade: 'VIP', r: 10, c: 15, shape: { t: 'rect', x: 261, y: 78, w: 78, h: 117 } },
        { id: 'IC', name: '플로어 C', grade: 'VIP', r: 10, c: 15, shape: { t: 'rect', x: 342, y: 78, w: 78, h: 117 } }
      ],
      [
        { id: 'I1', name: '101', grade: 'R', r: 11, c: 9, shape: { t: 'arc', ri: 165, ro: 205, a1: 170, a2: 193 } },
        { id: 'I2', name: '102', grade: 'R', r: 11, c: 9, shape: { t: 'arc', ri: 165, ro: 205, a1: 144, a2: 167 } },
        { id: 'I3', name: '103', grade: 'R', r: 11, c: 9, shape: { t: 'arc', ri: 165, ro: 205, a1: 118, a2: 141 } },
        { id: 'I4', name: '104', grade: 'R', r: 11, c: 9, shape: { t: 'arc', ri: 165, ro: 205, a1: 92,  a2: 115 } },
        { id: 'I5', name: '105', grade: 'R', r: 11, c: 9, shape: { t: 'arc', ri: 165, ro: 205, a1: 66,  a2: 89 } },
        { id: 'I6', name: '106', grade: 'R', r: 11, c: 9, shape: { t: 'arc', ri: 165, ro: 205, a1: 40,  a2: 63 } },
        { id: 'I7', name: '107', grade: 'R', r: 11, c: 9, shape: { t: 'arc', ri: 165, ro: 205, a1: 14,  a2: 37 } },
        { id: 'I8', name: '108', grade: 'R', r: 11, c: 9, shape: { t: 'arc', ri: 165, ro: 205, a1: -12, a2: 11 } }
      ],
      [
        { id: 'J1', name: '201', grade: 'S', r: 13, c: 13, shape: { t: 'arc', ri: 213, ro: 250, a1: 158, a2: 188 } },
        { id: 'J2', name: '202', grade: 'S', r: 13, c: 13, shape: { t: 'arc', ri: 213, ro: 250, a1: 124, a2: 154 } },
        { id: 'J3', name: '203', grade: 'S', r: 13, c: 13, shape: { t: 'arc', ri: 213, ro: 250, a1: 90,  a2: 120 } },
        { id: 'J4', name: '204', grade: 'S', r: 13, c: 13, shape: { t: 'arc', ri: 213, ro: 250, a1: 56,  a2: 86 } },
        { id: 'J5', name: '205', grade: 'S', r: 13, c: 13, shape: { t: 'arc', ri: 213, ro: 250, a1: 22,  a2: 52 } },
        { id: 'J6', name: '206', grade: 'S', r: 13, c: 13, shape: { t: 'arc', ri: 213, ro: 250, a1: -12, a2: 18 } }
      ],
      [
        { id: 'K1', name: '301', grade: 'A', r: 12, c: 18, shape: { t: 'arc', ri: 258, ro: 292, a1: 116, a2: 160 } },
        { id: 'K2', name: '302', grade: 'A', r: 12, c: 18, shape: { t: 'arc', ri: 258, ro: 292, a1: 68,  a2: 112 } },
        { id: 'K3', name: '303', grade: 'A', r: 12, c: 18, shape: { t: 'arc', ri: 258, ro: 292, a1: 20,  a2: 64 } }
      ]
    ]
  },

  /* ── 원형 체조경기장 ── 객석이 무대 옆을 지나 뒤까지 300도 감긴다 */
  arena: {
    name: 'KSPO DOME (체조경기장)',
    label: '체조경기장',
    desc: '국내 콘서트의 기준. 객석이 무대 옆을 지나 뒤까지 원형으로 감아 돕니다.',
    map: { viewBox: '0 0 600 480', cx: 300, cy: 200, stage: { x: 225, y: 58, w: 150, h: 30 } },
    rows: [
      [
        { id: 'FA', name: '플로어 A', grade: 'VIP', r: 10, c: 13, shape: { t: 'rect', x: 216, y: 100, w: 54, h: 120 } },
        { id: 'FB', name: '플로어 B', grade: 'VIP', r: 10, c: 13, shape: { t: 'rect', x: 274, y: 100, w: 54, h: 120 } },
        { id: 'FC', name: '플로어 C', grade: 'VIP', r: 10, c: 13, shape: { t: 'rect', x: 332, y: 100, w: 54, h: 120 } }
      ],
      [
        { id: 'Z1', name: '1층 1구역', grade: 'R', r: 12, c: 14, shape: { t: 'arc', ri: 135, ro: 175, a1: 185, a2: 229 } },
        { id: 'Z2', name: '1층 2구역', grade: 'R', r: 12, c: 14, shape: { t: 'arc', ri: 135, ro: 175, a1: 137, a2: 181 } },
        { id: 'Z3', name: '1층 3구역', grade: 'R', r: 12, c: 14, shape: { t: 'arc', ri: 135, ro: 175, a1: 89,  a2: 133 } },
        { id: 'Z4', name: '1층 4구역', grade: 'R', r: 12, c: 14, shape: { t: 'arc', ri: 135, ro: 175, a1: 41,  a2: 85 } },
        { id: 'Z5', name: '1층 5구역', grade: 'R', r: 12, c: 14, shape: { t: 'arc', ri: 135, ro: 175, a1: -7,  a2: 37 } },
        { id: 'Z6', name: '1층 6구역', grade: 'R', r: 12, c: 14, shape: { t: 'arc', ri: 135, ro: 175, a1: -55, a2: -11 } }
      ],
      [
        { id: 'Y1', name: '2층 1구역', grade: 'S', r: 13, c: 15, shape: { t: 'arc', ri: 183, ro: 222, a1: 185, a2: 229 } },
        { id: 'Y2', name: '2층 2구역', grade: 'S', r: 13, c: 15, shape: { t: 'arc', ri: 183, ro: 222, a1: 137, a2: 181 } },
        { id: 'Y3', name: '2층 3구역', grade: 'S', r: 13, c: 15, shape: { t: 'arc', ri: 183, ro: 222, a1: 89,  a2: 133 } },
        { id: 'Y4', name: '2층 4구역', grade: 'S', r: 13, c: 15, shape: { t: 'arc', ri: 183, ro: 222, a1: 41,  a2: 85 } },
        { id: 'Y5', name: '2층 5구역', grade: 'S', r: 13, c: 15, shape: { t: 'arc', ri: 183, ro: 222, a1: -7,  a2: 37 } },
        { id: 'Y6', name: '2층 6구역', grade: 'S', r: 13, c: 15, shape: { t: 'arc', ri: 183, ro: 222, a1: -55, a2: -11 } }
      ],
      [
        { id: 'W1', name: '3층 1구역', grade: 'A', r: 12, c: 17, shape: { t: 'arc', ri: 230, ro: 265, a1: 162, a2: 206 } },
        { id: 'W2', name: '3층 2구역', grade: 'A', r: 12, c: 17, shape: { t: 'arc', ri: 230, ro: 265, a1: 114, a2: 158 } },
        { id: 'W3', name: '3층 3구역', grade: 'A', r: 12, c: 17, shape: { t: 'arc', ri: 230, ro: 265, a1: 66,  a2: 110 } },
        { id: 'W4', name: '3층 4구역', grade: 'A', r: 12, c: 17, shape: { t: 'arc', ri: 230, ro: 265, a1: 18,  a2: 62 } },
        { id: 'W5', name: '3층 5구역', grade: 'A', r: 12, c: 17, shape: { t: 'arc', ri: 230, ro: 265, a1: -30, a2: 14 } }
      ]
    ]
  },

  /* ── 야구 돔 ── 파울라인 따라 기울어진 내야 + 깊고 완만한 외야 곡선 */
  dome: {
    name: '고척스카이돔',
    label: '돔구장',
    desc: '무대를 외야에 세운 야구 돔. 파울라인을 따라 기울어진 내야석과 깊은 외야석.',
    map: { viewBox: '0 0 600 480', cx: 300, cy: 120, stage: { x: 225, y: 22, w: 150, h: 30 } },
    rows: [
      [
        { id: 'D1', name: '그라운드 A', grade: 'VIP', r: 11, c: 15, shape: { t: 'rect', x: 186, y: 70, w: 72, h: 130 } },
        { id: 'D2', name: '그라운드 B', grade: 'VIP', r: 11, c: 15, shape: { t: 'rect', x: 264, y: 70, w: 72, h: 130 } },
        { id: 'D3', name: '그라운드 C', grade: 'VIP', r: 11, c: 15, shape: { t: 'rect', x: 342, y: 70, w: 72, h: 130 } }
      ],
      [
        { id: 'E1', name: '내야 3루', grade: 'R', r: 14, c: 16, shape: { t: 'poly', pts: '172,118 108,206 152,330 222,252' } },
        { id: 'E2', name: '내야 중앙', grade: 'R', r: 12, c: 22, shape: { t: 'poly', pts: '232,262 368,262 384,338 216,338' } },
        { id: 'E3', name: '내야 1루', grade: 'R', r: 14, c: 16, shape: { t: 'poly', pts: '428,118 492,206 448,330 378,252' } }
      ],
      [
        { id: 'F1', name: '외야 좌측', grade: 'S', r: 15, c: 20, shape: { t: 'arc', ri: 248, ro: 298, a1: 108, a2: 146 } },
        { id: 'F2', name: '외야 중앙', grade: 'S', r: 15, c: 22, shape: { t: 'arc', ri: 248, ro: 298, a1: 72,  a2: 106 } },
        { id: 'F3', name: '외야 우측', grade: 'S', r: 15, c: 20, shape: { t: 'arc', ri: 248, ro: 298, a1: 34,  a2: 70 } }
      ],
      [
        { id: 'H1', name: '상단 좌측', grade: 'A', r: 13, c: 22, shape: { t: 'arc', ri: 306, ro: 344, a1: 92, a2: 140 } },
        { id: 'H2', name: '상단 우측', grade: 'A', r: 13, c: 22, shape: { t: 'arc', ri: 306, ro: 344, a1: 40, a2: 88 } }
      ]
    ]
  },

  /* ── 야외 주경기장 ── 감싸지 않는다. 사각 스탠드가 마주본다 */
  stadium: {
    name: '서울월드컵경기장',
    label: '주경기장',
    desc: '최대 규모 야외 경기장. 사각 그라운드를 스탠드가 마주보며 둘러쌉니다.',
    map: { viewBox: '0 0 600 480', cx: 300, cy: 250, stage: { x: 205, y: 24, w: 190, h: 38 } },
    rows: [
      [
        { id: 'SA', name: '스탠딩 A', grade: 'VIP', r: 12, c: 18, shape: { t: 'rect', x: 168, y: 82, w: 125, h: 150 } },
        { id: 'SB', name: '스탠딩 B', grade: 'VIP', r: 12, c: 18, shape: { t: 'rect', x: 300, y: 82, w: 125, h: 150 } }
      ],
      [
        { id: 'N1', name: '1층 좌측', grade: 'R', r: 16, c: 14, shape: { t: 'rect', x: 58,  y: 82,  w: 96,  h: 210 } },
        { id: 'N2', name: '1층 중앙', grade: 'R', r: 12, c: 24, shape: { t: 'rect', x: 168, y: 242, w: 257, h: 70 } },
        { id: 'N3', name: '1층 우측', grade: 'R', r: 16, c: 14, shape: { t: 'rect', x: 439, y: 82,  w: 96,  h: 210 } }
      ],
      [
        { id: 'M1', name: '2층 좌측', grade: 'S', r: 14, c: 20, shape: { t: 'rect', x: 58,  y: 322, w: 150, h: 70 } },
        { id: 'M2', name: '2층 중앙', grade: 'S', r: 14, c: 22, shape: { t: 'rect', x: 216, y: 322, w: 168, h: 70 } },
        { id: 'M3', name: '2층 우측', grade: 'S', r: 14, c: 20, shape: { t: 'rect', x: 392, y: 322, w: 150, h: 70 } }
      ],
      [
        { id: 'L1', name: '3층 좌측', grade: 'A', r: 14, c: 24, shape: { t: 'rect', x: 110, y: 402, w: 180, h: 58 } },
        { id: 'L2', name: '3층 우측', grade: 'A', r: 14, c: 24, shape: { t: 'rect', x: 310, y: 402, w: 180, h: 58 } }
      ]
    ]
  }
};

/** 홈 화면 공연장 선택 순서 (작은 곳 → 큰 곳) */
TP.VENUE_LIST = ['hall', 'gym', 'inspire', 'arena', 'dome', 'stadium'];

/** 현재 설정의 공연장. 직접 고른 값이 없으면 공연의 기본 공연장을 쓴다. */
TP.venueOf = function (cfg) {
  return TP.VENUES[cfg.venue] || TP.VENUES[cfg.concert.venue];
};

/* ─────────── 공연 포스터 ───────────
   외부 이미지 없이 SVG 로 직접 그린다. (파일 하나로 실행되어야 하므로)
   실제 공연 포스터처럼 큰 제목 타이포가 주인공이고 배경은 색면만 둔다.

   레이아웃 — viewBox 는 3:4 세로(300x400).
     오픈 대기 화면은 3:4 그대로 전체가 보인다.
     홈 카드는 높이가 104px 로 고정이고 너비는 210~320px 사이라, slice 로
     세로 중앙만 잘려 보인다. 카드가 넓어질수록 보이는 띠가 좁아지는데
     가장 좁은 경우가 약 98단위(y 151~249)다.
     그래서 제목 두 줄을 baseline y=190 / y=234 에 고정해 어떤 카드 너비에서도
     제목이 잘리지 않게 한다. 날짜·아티스트·공연장은 그 위아래에 둬서
     카드에서는 잘려 나가고 대기 화면에서만 보인다.
     장식 도형도 y<150 또는 y>350 에만 둬서 제목과 겹치지 않게 한다.

   같은 포스터가 홈 카드와 대기 화면에 동시에 존재하므로 gradient id 가
   문서 안에서 중복된다. 중복되면 url(#..) 이 앞쪽(숨겨진 홈 카드) 것을 가리켜
   채색이 깨지므로, id 에 __U__ 자리표시자를 두고 TP.posterSVG() 가
   그릴 때마다 서로 다른 접미사로 치환한다. */
TP.POSTERS = {

  /* AURORA — 보라빛 헤일로 */
  idol: `<svg viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice" font-family="'Pretendard','Malgun Gothic','Segoe UI',sans-serif">
    <defs>
      <linearGradient id="pa-bg__U__" x1="0" y1="0" x2=".7" y2="1">
        <stop offset="0" stop-color="#26104a"/><stop offset=".55" stop-color="#4e1342"/><stop offset="1" stop-color="#7a123c"/>
      </linearGradient>
    </defs>
    <rect width="300" height="400" fill="url(#pa-bg__U__)"/>
    <g fill="none" stroke="#ff8fb0" opacity=".26">
      <circle cx="242" cy="88" r="60" stroke-width="1"/>
      <circle cx="242" cy="88" r="90" stroke-width="1" opacity=".6"/>
      <circle cx="242" cy="88" r="34" stroke-width="1.4"/>
    </g>
    <text x="30" y="56" fill="#ffb3c8" font-size="12" font-weight="700" letter-spacing="3">2026.09.11 – 09.13</text>
    <text x="30" y="92" fill="#ffffff" font-size="13" font-weight="700" letter-spacing="6" opacity=".62">2026 WORLD TOUR</text>
    <text x="30" y="190" fill="#ffffff" font-size="34" font-weight="800" letter-spacing="-.5">WORLD TOUR</text>
    <text x="30" y="234" fill="#ff8fb0" font-size="42" font-weight="800" letter-spacing="1">ENCORE</text>
    <rect x="30" y="256" width="48" height="3" fill="#ff5f7e"/>
    <text x="30" y="292" fill="#ffffff" font-size="26" font-weight="800" letter-spacing="3">AURORA</text>
    <text x="30" y="320" fill="#ffffff" font-size="11" opacity=".52" letter-spacing="1">KSPO DOME · SEOUL</text>
    <text x="30" y="356" fill="#ff8fb0" font-size="12" font-weight="700" letter-spacing="1">전석 매진 예상</text>
  </svg>`,

  /* 녹턴 — 여름의 마지막, 수평선 */
  band: `<svg viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice" font-family="'Pretendard','Malgun Gothic','Segoe UI',sans-serif">
    <defs>
      <linearGradient id="pb-bg__U__" x1="0" y1="0" x2=".4" y2="1">
        <stop offset="0" stop-color="#0d1a4d"/><stop offset=".6" stop-color="#263d8c"/><stop offset="1" stop-color="#6f4aa2"/>
      </linearGradient>
    </defs>
    <rect width="300" height="400" fill="url(#pb-bg__U__)"/>
    <g stroke="#9fd0ff" stroke-linecap="round" opacity=".3">
      <path d="M172 74h108" stroke-width="2"/><path d="M198 92h82" stroke-width="1.6"/>
      <path d="M216 110h64" stroke-width="1.3"/><path d="M240 128h40" stroke-width="1"/>
    </g>
    <text x="30" y="56" fill="#9fd0ff" font-size="12" font-weight="700" letter-spacing="3">2026.08.22 – 08.23</text>
    <text x="30" y="92" fill="#ffffff" font-size="13" font-weight="700" letter-spacing="6" opacity=".62">SINGLE CONCERT</text>
    <text x="30" y="190" fill="#ffffff" font-size="36" font-weight="800" letter-spacing="-.5">THE LAST</text>
    <text x="30" y="234" fill="#8fe8ff" font-size="34" font-weight="800" letter-spacing="-.5">SUMMER LIVE</text>
    <rect x="30" y="256" width="48" height="3" fill="#8fe8ff"/>
    <text x="30" y="294" fill="#ffffff" font-size="30" font-weight="800" letter-spacing="4">녹턴</text>
    <text x="30" y="322" fill="#ffffff" font-size="11" opacity=".52" letter-spacing="1">예술의전당 콘서트홀</text>
    <text x="30" y="358" fill="#9fd0ff" font-size="12" font-weight="700" letter-spacing="1">단독 공연</text>
  </svg>`,

  /* SEOUL SOUND — 페스티벌 블록 타이포 */
  fest: `<svg viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice" font-family="'Pretendard','Malgun Gothic','Segoe UI',sans-serif">
    <defs>
      <linearGradient id="pf-bg__U__" x1="0" y1="0" x2=".6" y2="1">
        <stop offset="0" stop-color="#04241f"/><stop offset=".5" stop-color="#073c3c"/><stop offset="1" stop-color="#0b2c62"/>
      </linearGradient>
    </defs>
    <rect width="300" height="400" fill="url(#pf-bg__U__)"/>
    <g opacity=".92">
      <rect x="196" y="86"  width="11" height="46" rx="2.5" fill="#22c98f"/>
      <rect x="213" y="66"  width="11" height="66" rx="2.5" fill="#4a86ff"/>
      <rect x="230" y="98"  width="11" height="34" rx="2.5" fill="#ffb020"/>
      <rect x="247" y="54"  width="11" height="78" rx="2.5" fill="#22c98f"/>
      <rect x="264" y="80"  width="11" height="52" rx="2.5" fill="#4a86ff"/>
    </g>
    <text x="30" y="56" fill="#7ff0c4" font-size="12" font-weight="700" letter-spacing="3">2026.10.03 – 10.04</text>
    <text x="30" y="92" fill="#ffffff" font-size="13" font-weight="700" letter-spacing="6" opacity=".62">2 DAY PASS</text>
    <text x="30" y="190" fill="#ffffff" font-size="34" font-weight="800" letter-spacing="-1">SEOUL SOUND</text>
    <text x="30" y="234" fill="#22c98f" font-size="40" font-weight="800" letter-spacing="-1">FESTIVAL</text>
    <rect x="30" y="256" width="48" height="3" fill="#ffb020"/>
    <text x="30" y="296" fill="#ffffff" font-size="32" font-weight="800" letter-spacing="1">2026</text>
    <text x="30" y="324" fill="#ffffff" font-size="11" opacity=".52" letter-spacing="1">서울월드컵경기장</text>
    <text x="30" y="358" fill="#ffb020" font-size="12" font-weight="700" letter-spacing="1">LINE-UP 40 ARTISTS</text>
  </svg>`,

  /* 그날의 파도 — 한글 제목이 주인공 */
  musical: `<svg viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice" font-family="'Pretendard','Malgun Gothic','Segoe UI',sans-serif">
    <defs>
      <linearGradient id="pm-bg__U__" x1="0" y1="0" x2=".5" y2="1">
        <stop offset="0" stop-color="#2c1506"/><stop offset=".55" stop-color="#712316"/><stop offset="1" stop-color="#400b19"/>
      </linearGradient>
    </defs>
    <rect width="300" height="400" fill="url(#pm-bg__U__)"/>
    <circle cx="238" cy="84" r="32" fill="#ffd98a" opacity=".92"/>
    <circle cx="238" cy="84" r="54" fill="none" stroke="#ffd98a" stroke-width="1" opacity=".26"/>
    <text x="30" y="56" fill="#ffc46b" font-size="12" font-weight="700" letter-spacing="3">2026.11.05 – 11.09</text>
    <text x="30" y="92" fill="#ffffff" font-size="13" font-weight="700" letter-spacing="6" opacity=".62">MUSICAL</text>
    <text x="30" y="192" fill="#ffffff" font-size="46" font-weight="800" letter-spacing="-1">그날의</text>
    <text x="30" y="240" fill="#ffb887" font-size="46" font-weight="800" letter-spacing="-1">파도</text>
    <rect x="30" y="262" width="48" height="3" fill="#ff5f4d"/>
    <g fill="none" stroke="#ffc46b" opacity=".34">
      <path d="M-6 300c40-14 74 9 114-4s70-14 104 0 62 10 94 0" stroke-width="1.5"/>
      <path d="M-6 314c44-12 70 10 116-2s68-12 102 0 60 9 94 0" stroke-width="1"/>
    </g>
    <text x="30" y="352" fill="#ffffff" font-size="18" font-weight="800" letter-spacing="2">캐스팅 A팀</text>
    <text x="30" y="376" fill="#ffffff" font-size="11" opacity=".52" letter-spacing="1">예술의전당 콘서트홀 · 막공</text>
  </svg>`
};

/**
 * 포스터 SVG 를 꺼낸다.
 * @param {string} concertId 공연 id
 * @param {string} uid       인스턴스 구분자. 같은 포스터를 여러 곳에 그릴 때
 *                           반드시 서로 다른 값을 줘야 gradient id 가 겹치지 않는다.
 */
TP.posterSVG = function (concertId, uid) {
  const svg = TP.POSTERS[concertId];
  return svg ? svg.replace(/__U__/g, '-' + (uid || 'x')) : '';
};

/* ─────────── 공연 목록 ───────────
   schedule = 예매 가능한 회차.
     heat : 이 회차의 경쟁률 배수. 좌석 소진 속도에 곱해진다.
            주말·막공처럼 인기 회차는 1보다 크고, 평일 낮 회차는 1보다 작다.
     sold : 이미 매진된 회차 (선택 불가)
     tag  : 회차 배지 문구 */
TP.CONCERTS = [
  {
    id: 'idol', emoji: '🎤', name: '2026 WORLD TOUR : ENCORE',
    artist: 'AURORA', venue: 'arena', date: '2026.09.11 ~ 09.13',
    art: 'linear-gradient(135deg,#ff4757,#ff9068)', tags: ['HOT', '전석매진예상'],
    /** 인기도 — 좌석 소진 속도와 대기열 규모에 곱해진다 */
    heat: 1.35,
    schedule: [
      { date: '2026.09.11', dow: '금', time: '19:30', heat: 0.88 },
      { date: '2026.09.12', dow: '토', time: '18:00', heat: 1.15, tag: '주말' },
      { date: '2026.09.13', dow: '일', time: '17:00', heat: 1.34, tag: '막공' }
    ]
  },
  {
    id: 'band', emoji: '🎸', name: 'THE LAST SUMMER LIVE',
    artist: '녹턴', venue: 'hall', date: '2026.08.22 ~ 08.23',
    art: 'linear-gradient(135deg,#4a86ff,#a978ff)', tags: ['단독공연'],
    heat: 1.0,
    schedule: [
      { date: '2026.08.22', dow: '토', time: '18:00', heat: 1.10, tag: '주말' },
      { date: '2026.08.23', dow: '일', time: '19:00', heat: 1.00, tag: '막공' }
    ]
  },
  {
    id: 'fest', emoji: '🎆', name: 'SEOUL SOUND FESTIVAL 2026',
    artist: '라인업 40팀', venue: 'stadium', date: '2026.10.03 ~ 10.04',
    art: 'linear-gradient(135deg,#22c98f,#4a86ff)', tags: ['2일권', '역대급규모'],
    heat: 1.15,
    schedule: [
      { date: '2026.10.03', dow: '토', time: '14:00', heat: 1.05, tag: '1일차' },
      { date: '2026.10.04', dow: '일', time: '14:00', heat: 1.18, tag: '2일차' }
    ]
  },
  {
    id: 'musical', emoji: '🎭', name: '뮤지컬 〈그날의 파도〉',
    artist: '캐스팅 A팀', venue: 'hall', date: '2026.11.05 ~ 11.09',
    art: 'linear-gradient(135deg,#ffb020,#ff4757)', tags: ['막공', '캐스팅전쟁'],
    heat: 1.45,
    schedule: [
      { date: '2026.11.05', dow: '목', time: '19:30', heat: 0.82 },
      { date: '2026.11.06', dow: '금', time: '19:30', heat: 0.95 },
      { date: '2026.11.07', dow: '토', time: '14:00', heat: 1.12, tag: '주말' },
      { date: '2026.11.07', dow: '토', time: '19:00', heat: 1.20, tag: '주말' },
      { date: '2026.11.08', dow: '일', time: '14:00', heat: 1.25, sold: true },
      { date: '2026.11.09', dow: '월', time: '19:30', heat: 1.40, tag: '막공' }
    ]
  }
];

/** 1회 예매 최대 매수 */
TP.QTY_MAX = 4;

/* ─────────── 결제 수단 ───────────
   실제 예매처처럼 수단을 고른 뒤 카드사·은행까지 한 번 더 골라야 한다.
   결제 직전에 선택이 하나 더 끼는 것만으로도 체감 난이도가 올라간다. */
TP.PAY_METHODS = [
  { id: 'card',  label: '신용카드',              subLabel: '카드사 선택' },
  { id: 'easy',  label: '간편결제',              subLabel: '간편결제 선택' },
  { id: 'bank',  label: '실시간 계좌이체',        subLabel: '은행 선택' },
  { id: 'vbank', label: '무통장입금 (가상계좌)',  subLabel: '입금 은행 선택' }
];

TP.PAY_SUBS = {
  card: ['신한카드', '삼성카드', '현대카드', 'KB국민카드', '롯데카드',
         '하나카드', 'BC카드', 'NH농협카드', '우리카드'],
  easy: ['카카오페이', '네이버페이', '토스페이', '페이코', '삼성페이', 'SSG페이'],
  bank: ['KB국민은행', '신한은행', '우리은행', '하나은행', 'NH농협은행',
         'IBK기업은행', '카카오뱅크', '토스뱅크', 'SC제일은행'],
  vbank: ['KB국민은행', '신한은행', '우리은행', '하나은행', 'NH농협은행',
          'IBK기업은행', '카카오뱅크', '케이뱅크']
};

/* ─────────── 난이도 ───────────
   users        : 동시 접속자 규모
   seats        : 목표 총 좌석수
   selloutSec   : 전 좌석이 소진되기까지 걸리는 목표 시간(초)
   drain        : 대기열이 초당 빠지는 인원
   errorRate    : 요청당 기본 오류 확률 (서버 부하로 증폭됨)
   latMu/latSig : 응답 지연 로그정규 분포 파라미터 (ms 기준 로그값)
   holdSec      : 좌석 선점 유지 시간
   limitSec     : 예매 제한 시간
   maxWaitSec   : 대기열에서 기다리는 시간의 상한.
                  연습 도구이므로 대기 자체는 짧게 자르고, 늦게 클릭한 불이익은
                  "들어갔을 때 이미 팔려 있는 좌석"으로 돌려준다. */
TP.DIFFS = [
  {
    id: 'practice', name: '연습', level: 1,
    desc: '흐름을 익히는 단계. 지연과 오류가 적고 좌석도 여유롭습니다.',
    users: 24000, seats: 3600, selloutSec: 560, drain: 60, maxWaitSec: 18,
    errorRate: 0.015, latMu: 4.6, latSig: 0.42, holdSec: 420, limitSec: 600, heat: 0.7
  },
  {
    id: 'real', name: '실전', level: 2,
    desc: '일반적인 인기 공연 수준. 대기열과 좌석 경쟁이 본격적으로 시작됩니다.',
    users: 95000, seats: 2600, selloutSec: 185, drain: 200, maxWaitSec: 24,
    errorRate: 0.05, latMu: 5.2, latSig: 0.55, holdSec: 300, limitSec: 480, heat: 1.0
  },
  {
    id: 'hard', name: '피켓팅', level: 3,
    desc: '좌석보다 사람이 훨씬 많은 상황. 1초 판단이 결과를 가릅니다.',
    users: 320000, seats: 1700, selloutSec: 78, drain: 350, maxWaitSec: 28,
    errorRate: 0.11, latMu: 5.7, latSig: 0.7, holdSec: 240, limitSec: 420, heat: 1.35
  },
  {
    id: 'hell', name: '지옥', level: 4,
    desc: '실제 최상위 티켓팅. 대부분 좌석 화면조차 보지 못하고 끝납니다.',
    users: 850000, seats: 850, selloutSec: 34, drain: 600, maxWaitSec: 32,
    errorRate: 0.19, latMu: 6.1, latSig: 0.85, holdSec: 180, limitSec: 360, heat: 1.7
  }
];

/* ─────────── 목표 좌석 (선택사항) ─────────── */
/* 목표를 정하면 그 조건에 맞는 좌석이 더 빨리 사라지고 선점 경쟁도 심해진다.
   남들도 같은 자리를 노리기 때문이다 → 목표를 좁힐수록 난이도가 올라간다. */
TP.TARGETS = [
  { id: 'any',  label: '아무 자리나',   desc: '일단 성공이 목표 · 추가 난이도 없음' },
  { id: 'VIP',  label: 'VIP석',        desc: '최상위 등급 · VIP석이 훨씬 빨리 소진' },
  { id: 'R',    label: 'R석 이상',      desc: 'R 또는 VIP · 상위 등급 전체가 빨리 소진' },
  { id: 'front',label: '앞줄 (1~5열)',  desc: '등급 무관 앞자리 · 앞줄이 순식간에 사라짐' },
  { id: 'multi',label: '연석 2매',      desc: '붙어있는 두 자리 · 좌석이 흩어져 사라짐' }
];

/* ─────────── 분석 벤치마크 ───────────
   각 지표별 [S, A, B, C] 경계값. lower=true 면 작을수록 좋다. */
TP.BENCH = {
  reaction:   { label: '예매 버튼 반응속도', unit: 'ms', lower: true,  tiers: [220, 350, 550, 850],
                desc: '오픈 시각에 예매 버튼을 누르기까지 걸린 시간. 대기 순번을 결정하는 가장 중요한 지표입니다.' },
  schedTime:  { label: '회차 선택 소요시간', unit: 'ms', lower: true,  tiers: [2200, 4500, 8000, 14000],
                desc: '날짜·회차 화면에 머문 시간. 어느 회차를 잡을지 미리 정해두지 않으면 이 구간에서 좋은 좌석이 사라집니다.' },
  seatTime:   { label: '좌석 선택 소요시간', unit: 'ms', lower: true,  tiers: [2500, 5000, 9000, 15000],
                desc: '좌석 화면 진입부터 첫 좌석을 확보하기까지 걸린 시간.' },
  clickAcc:   { label: '클릭 정확도',        unit: '%',  lower: false, tiers: [92, 80, 65, 45],
                desc: '전체 클릭 중 실제로 유효한 대상을 누른 비율. 헛클릭이 많을수록 낮아집니다.' },
  mouseEff:   { label: '마우스 경로 효율',   unit: '%',  lower: false, tiers: [72, 55, 38, 22],
                desc: '클릭 지점 사이의 최단거리 대비 실제 이동거리. 낮으면 커서가 헤맸다는 뜻입니다.' },
  clickRate:  { label: '연속 클릭 속도',     unit: '회/초', lower: false, tiers: [6.5, 4.5, 3.0, 1.8],
                desc: '가장 빠르게 클릭한 1초 구간의 클릭 수. 좌석 경쟁 구간의 손 속도입니다.' },
  captcha:    { label: '보안문자 입력속도',  unit: 'ms', lower: true,  tiers: [3000, 5000, 8000, 13000],
                desc: '보안문자 화면 진입부터 정답 제출까지 걸린 시간.' },
  composure:  { label: '침착도',             unit: '점', lower: false, tiers: [90, 75, 55, 35],
                desc: '불필요한 새로고침·연타·이미 팔린 좌석 클릭 등 당황 신호가 적을수록 높습니다.' }
};

TP.TIER_NAMES = ['S', 'A', 'B', 'C', 'D'];
TP.TIER_CLASS = ['t-s', 't-a', 't-b', 't-c', 't-d'];
TP.TIER_COLOR = ['#a978ff', '#22c98f', '#4a86ff', '#ffb020', '#ff4757'];

TP.GRADE_TEXT = {
  S: { title: '프로 티켓팅', body: '실제 인기 공연에서도 상위권 진입이 가능한 수준입니다. 이제부터는 회선 속도와 운의 영역입니다.' },
  A: { title: '상위권', body: '기본기는 완성됐습니다. 한두 지표만 다듬으면 피켓팅에서도 좌석을 잡을 수 있습니다.' },
  B: { title: '평균 이상', body: '흐름은 익숙해졌습니다. 판단이 멈추는 구간을 줄이는 것이 다음 과제입니다.' },
  C: { title: '연습 필요', body: '아직 화면을 읽는 데 시간을 쓰고 있습니다. 같은 공연장을 반복해 좌석 배치를 외우세요.' },
  D: { title: '기초부터', body: '먼저 낮은 난이도로 전체 흐름을 몸에 익히는 것이 우선입니다. 속도는 그다음입니다.' }
};

/* ─────────── 실시간 피드 문구 ─────────── */
TP.FEED = {
  seat: [
    '{zone} {seat} 판매완료',
    '{zone} 구역 잔여 {n}석',
    '{zone} {seat} 선점됨',
    '{zone} 연석 2매 소진',
    '{grade} 잔여 {n}석'
  ],
  sys: [
    '서버 응답 지연 발생 (평균 {ms}ms)',
    '동시 접속자 {n}명 돌파',
    '대기열 처리 재개',
    '일부 구역 매진 처리 중',
    '결제 서버 응답 지연'
  ]
};

/* 보안문자 — 헷갈리는 0/O/1/I/l 는 제외 */
TP.CAPTCHA_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/* ─────────── 대기열 상태 문구 ─────────── */
TP.QUEUE_MSG = {
  normal: [
    '대기열이 정상적으로 처리되고 있습니다.',
    '순서대로 입장 처리 중입니다.',
    '잠시만 기다려 주세요.'
  ],
  slow: [
    '접속량이 많아 처리가 지연되고 있습니다.',
    '서버 부하가 높습니다. 대기 시간이 늘어날 수 있습니다.',
    '일시적으로 처리 속도가 느려졌습니다.'
  ],
  stall: [
    '대기열 처리가 일시 중단되었습니다.',
    '서버 응답을 기다리는 중입니다...',
    '트래픽 급증으로 처리가 멈췄습니다.'
  ]
};

})(window.TP);
