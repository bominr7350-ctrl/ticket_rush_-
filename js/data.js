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

   shape — 구역의 모양. 공연장마다 실제 구조가 다르므로 세 가지를 섞어 쓴다.
     { t:'rect', x, y, w, h }              사각 블록. 아레나의 플로어, 경기장의 스탠드.
     { t:'arc',  ri, ro, a1, a2 }          도넛 조각. 무대를 감싸는 층.
                                           ri/ro = 안쪽·바깥쪽 반지름 (map.cx/cy 기준)
                                           a1/a2 = 각도(도). 0=오른쪽, 90=아래, 180=왼쪽
                                           → 각도가 클수록 화면 왼쪽. 음수면 무대 옆까지 올라간다.
     { t:'poly', pts:'x,y x,y ...' }       임의 다각형.

   ※ 실제 공연장의 구조(플로어 배치, 층 수, 감싸는 각도, 스탠드 형태)를 참고해
     비율을 맞춘 재구성이다. 공식 좌석배치도를 그대로 옮긴 것이 아니므로
     구역 번호와 좌석 수는 실제와 다르다. */
TP.VENUES = {

  /* 부채꼴 홀 — 무대 정면으로만 객석이 펼쳐지고 2·3층은 뒤쪽 발코니 */
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

  /* 원형 실내체육관 — 사각 플로어를 객석이 거의 한 바퀴 감싼다 */
  gym: {
    name: '잠실실내체육관',
    label: '실내체육관',
    desc: '사각 플로어를 1·2층이 둥글게 감싸는 중형 경기장. 무대와 가까워 시야가 고른 편입니다.',
    map: { viewBox: '0 0 600 440', cx: 300, cy: 140, stage: { x: 230, y: 20, w: 140, h: 30 } },
    rows: [
      [
        { id: 'GA', name: '플로어 A', grade: 'VIP', r: 9, c: 13, shape: { t: 'rect', x: 195, y: 70, w: 66, h: 115 } },
        { id: 'GB', name: '플로어 B', grade: 'VIP', r: 9, c: 13, shape: { t: 'rect', x: 267, y: 70, w: 66, h: 115 } },
        { id: 'GC', name: '플로어 C', grade: 'VIP', r: 9, c: 13, shape: { t: 'rect', x: 339, y: 70, w: 66, h: 115 } }
      ],
      [
        { id: 'G1', name: '1층 A구역', grade: 'R', r: 11, c: 15, shape: { t: 'arc', ri: 155, ro: 200, a1: 143, a2: 192 } },
        { id: 'G2', name: '1층 B구역', grade: 'R', r: 11, c: 15, shape: { t: 'arc', ri: 155, ro: 200, a1: 92,  a2: 141 } },
        { id: 'G3', name: '1층 C구역', grade: 'R', r: 11, c: 15, shape: { t: 'arc', ri: 155, ro: 200, a1: 39,  a2: 88 } },
        { id: 'G4', name: '1층 D구역', grade: 'R', r: 11, c: 15, shape: { t: 'arc', ri: 155, ro: 200, a1: -12, a2: 37 } }
      ],
      [
        { id: 'G5', name: '2층 A구역', grade: 'S', r: 12, c: 16, shape: { t: 'arc', ri: 208, ro: 245, a1: 143, a2: 192 } },
        { id: 'G6', name: '2층 B구역', grade: 'S', r: 12, c: 16, shape: { t: 'arc', ri: 208, ro: 245, a1: 92,  a2: 141 } },
        { id: 'G7', name: '2층 C구역', grade: 'S', r: 12, c: 16, shape: { t: 'arc', ri: 208, ro: 245, a1: 39,  a2: 88 } },
        { id: 'G8', name: '2층 D구역', grade: 'S', r: 12, c: 16, shape: { t: 'arc', ri: 208, ro: 245, a1: -12, a2: 37 } }
      ],
      [
        { id: 'G9', name: '3층 좌측', grade: 'A', r: 10, c: 18, shape: { t: 'arc', ri: 253, ro: 285, a1: 92, a2: 160 } },
        { id: 'GX', name: '3층 우측', grade: 'A', r: 10, c: 18, shape: { t: 'arc', ri: 253, ro: 285, a1: 20, a2: 88 } }
      ]
    ]
  },

  /* 신축 대형 아레나 — 플로어 + 100/200/300번대 말발굽형 */
  inspire: {
    name: '인스파이어 아레나 (영종도)',
    label: '아레나',
    desc: '국내 최초 대형 공연 전용 아레나. 플로어를 100·200·300번대가 말발굽으로 감쌉니다.',
    map: { viewBox: '0 0 600 450', cx: 300, cy: 140, stage: { x: 215, y: 24, w: 170, h: 34 } },
    rows: [
      [
        { id: 'IA', name: '플로어 A', grade: 'VIP', r: 10, c: 15, shape: { t: 'rect', x: 180, y: 78, w: 78, h: 117 } },
        { id: 'IB', name: '플로어 B', grade: 'VIP', r: 10, c: 15, shape: { t: 'rect', x: 261, y: 78, w: 78, h: 117 } },
        { id: 'IC', name: '플로어 C', grade: 'VIP', r: 10, c: 15, shape: { t: 'rect', x: 342, y: 78, w: 78, h: 117 } }
      ],
      [
        { id: 'I1', name: '101구역', grade: 'R', r: 12, c: 16, shape: { t: 'arc', ri: 170, ro: 215, a1: 144, a2: 194 } },
        { id: 'I2', name: '102구역', grade: 'R', r: 12, c: 16, shape: { t: 'arc', ri: 170, ro: 215, a1: 92,  a2: 142 } },
        { id: 'I3', name: '103구역', grade: 'R', r: 12, c: 16, shape: { t: 'arc', ri: 170, ro: 215, a1: 38,  a2: 88 } },
        { id: 'I4', name: '104구역', grade: 'R', r: 12, c: 16, shape: { t: 'arc', ri: 170, ro: 215, a1: -14, a2: 36 } }
      ],
      [
        { id: 'I5', name: '201구역', grade: 'S', r: 13, c: 18, shape: { t: 'arc', ri: 223, ro: 262, a1: 144, a2: 194 } },
        { id: 'I6', name: '202구역', grade: 'S', r: 13, c: 18, shape: { t: 'arc', ri: 223, ro: 262, a1: 92,  a2: 142 } },
        { id: 'I7', name: '203구역', grade: 'S', r: 13, c: 18, shape: { t: 'arc', ri: 223, ro: 262, a1: 38,  a2: 88 } },
        { id: 'I8', name: '204구역', grade: 'S', r: 13, c: 18, shape: { t: 'arc', ri: 223, ro: 262, a1: -14, a2: 36 } }
      ],
      [
        { id: 'I9', name: '301구역', grade: 'A', r: 11, c: 20, shape: { t: 'arc', ri: 270, ro: 300, a1: 92, a2: 160 } },
        { id: 'IX', name: '302구역', grade: 'A', r: 11, c: 20, shape: { t: 'arc', ri: 270, ro: 300, a1: 20, a2: 88 } }
      ]
    ]
  },

  /* 체조경기장 — 원형에 가까워 객석이 무대 옆까지 크게 감싼다 */
  arena: {
    name: 'KSPO DOME (체조경기장)',
    label: '체조경기장',
    desc: '국내 콘서트의 기준이 되는 공연장. 플로어와 3개 층이 원형으로 둘러쌉니다.',
    map: { viewBox: '0 0 600 460', cx: 300, cy: 148, stage: { x: 220, y: 22, w: 160, h: 32 } },
    rows: [
      [
        { id: 'FA', name: '플로어 A', grade: 'VIP', r: 10, c: 14, shape: { t: 'rect', x: 185, y: 74, w: 74, h: 131 } },
        { id: 'FB', name: '플로어 B', grade: 'VIP', r: 10, c: 14, shape: { t: 'rect', x: 263, y: 74, w: 74, h: 131 } },
        { id: 'FC', name: '플로어 C', grade: 'VIP', r: 10, c: 14, shape: { t: 'rect', x: 341, y: 74, w: 74, h: 131 } }
      ],
      [
        { id: 'Z1', name: '1층 1구역', grade: 'R', r: 12, c: 16, shape: { t: 'arc', ri: 165, ro: 210, a1: 144, a2: 196 } },
        { id: 'Z2', name: '1층 2구역', grade: 'R', r: 12, c: 16, shape: { t: 'arc', ri: 165, ro: 210, a1: 90,  a2: 142 } },
        { id: 'Z3', name: '1층 3구역', grade: 'R', r: 12, c: 16, shape: { t: 'arc', ri: 165, ro: 210, a1: 36,  a2: 88 } },
        { id: 'Z4', name: '1층 4구역', grade: 'R', r: 12, c: 16, shape: { t: 'arc', ri: 165, ro: 210, a1: -18, a2: 34 } }
      ],
      [
        { id: 'Z5', name: '2층 5구역', grade: 'S', r: 14, c: 17, shape: { t: 'arc', ri: 218, ro: 262, a1: 144, a2: 196 } },
        { id: 'Z6', name: '2층 6구역', grade: 'S', r: 14, c: 17, shape: { t: 'arc', ri: 218, ro: 262, a1: 90,  a2: 142 } },
        { id: 'Z7', name: '2층 7구역', grade: 'S', r: 14, c: 17, shape: { t: 'arc', ri: 218, ro: 262, a1: 36,  a2: 88 } },
        { id: 'Z8', name: '2층 8구역', grade: 'S', r: 14, c: 17, shape: { t: 'arc', ri: 218, ro: 262, a1: -18, a2: 34 } }
      ],
      [
        { id: 'Z9', name: '3층 좌측', grade: 'A', r: 12, c: 18, shape: { t: 'arc', ri: 270, ro: 310, a1: 112, a2: 160 } },
        { id: 'ZA', name: '3층 중앙', grade: 'A', r: 12, c: 18, shape: { t: 'arc', ri: 270, ro: 310, a1: 66,  a2: 110 } },
        { id: 'ZB', name: '3층 우측', grade: 'A', r: 12, c: 18, shape: { t: 'arc', ri: 270, ro: 310, a1: 20,  a2: 64 } }
      ]
    ]
  },

  /* 야구 돔 — 무대를 홈플레이트 쪽에 두고 내야·외야·상단이 부채꼴로 퍼진다 */
  dome: {
    name: '고척스카이돔',
    label: '돔구장',
    desc: '국내 최대 실내 돔. 그라운드 뒤로 내야·외야·상단석이 넓게 퍼집니다.',
    map: { viewBox: '0 0 600 470', cx: 300, cy: 152, stage: { x: 225, y: 20, w: 150, h: 32 } },
    rows: [
      [
        { id: 'D1', name: '그라운드 A', grade: 'VIP', r: 11, c: 16, shape: { t: 'rect', x: 180, y: 72, w: 78, h: 138 } },
        { id: 'D2', name: '그라운드 B', grade: 'VIP', r: 11, c: 16, shape: { t: 'rect', x: 261, y: 72, w: 78, h: 138 } },
        { id: 'D3', name: '그라운드 C', grade: 'VIP', r: 11, c: 16, shape: { t: 'rect', x: 342, y: 72, w: 78, h: 138 } }
      ],
      [
        { id: 'D4', name: '내야 3루', grade: 'R', r: 13, c: 19, shape: { t: 'arc', ri: 170, ro: 218, a1: 122, a2: 180 } },
        { id: 'D5', name: '내야 중앙', grade: 'R', r: 13, c: 19, shape: { t: 'arc', ri: 170, ro: 218, a1: 61,  a2: 119 } },
        { id: 'D6', name: '내야 1루', grade: 'R', r: 13, c: 19, shape: { t: 'arc', ri: 170, ro: 218, a1: 0,   a2: 58 } }
      ],
      [
        { id: 'D7', name: '외야 좌측', grade: 'S', r: 15, c: 21, shape: { t: 'arc', ri: 226, ro: 268, a1: 122, a2: 180 } },
        { id: 'D8', name: '외야 중앙', grade: 'S', r: 15, c: 21, shape: { t: 'arc', ri: 226, ro: 268, a1: 61,  a2: 119 } },
        { id: 'D9', name: '외야 우측', grade: 'S', r: 15, c: 21, shape: { t: 'arc', ri: 226, ro: 268, a1: 0,   a2: 58 } }
      ],
      [
        { id: 'DA', name: '상단 좌측', grade: 'A', r: 13, c: 22, shape: { t: 'arc', ri: 276, ro: 310, a1: 91, a2: 162 } },
        { id: 'DB', name: '상단 우측', grade: 'A', r: 13, c: 22, shape: { t: 'arc', ri: 276, ro: 310, a1: 18, a2: 89 } }
      ]
    ]
  },

  /* 야외 주경기장 — 둥글게 감싸지 않는다. 사각 그라운드에 스탠드가 마주보는 구조 */
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
        { id: 'E1', name: '2층 좌측', grade: 'S', r: 14, c: 20, shape: { t: 'rect', x: 58,  y: 322, w: 150, h: 70 } },
        { id: 'E2', name: '2층 중앙', grade: 'S', r: 14, c: 22, shape: { t: 'rect', x: 216, y: 322, w: 168, h: 70 } },
        { id: 'E3', name: '2층 우측', grade: 'S', r: 14, c: 20, shape: { t: 'rect', x: 392, y: 322, w: 150, h: 70 } }
      ],
      [
        { id: 'W1', name: '3층 좌측', grade: 'A', r: 14, c: 24, shape: { t: 'rect', x: 110, y: 402, w: 180, h: 58 } },
        { id: 'W2', name: '3층 우측', grade: 'A', r: 14, c: 24, shape: { t: 'rect', x: 310, y: 402, w: 180, h: 58 } }
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
    users: 24000, seats: 3600, selloutSec: 700, drain: 60, maxWaitSec: 18,
    errorRate: 0.015, latMu: 4.6, latSig: 0.42, holdSec: 420, limitSec: 600, heat: 0.7
  },
  {
    id: 'real', name: '실전', level: 2,
    desc: '일반적인 인기 공연 수준. 대기열과 좌석 경쟁이 본격적으로 시작됩니다.',
    users: 95000, seats: 2600, selloutSec: 240, drain: 200, maxWaitSec: 24,
    errorRate: 0.05, latMu: 5.2, latSig: 0.55, holdSec: 300, limitSec: 480, heat: 1.0
  },
  {
    id: 'hard', name: '피켓팅', level: 3,
    desc: '좌석보다 사람이 훨씬 많은 상황. 1초 판단이 결과를 가릅니다.',
    users: 320000, seats: 1700, selloutSec: 105, drain: 350, maxWaitSec: 28,
    errorRate: 0.11, latMu: 5.7, latSig: 0.7, holdSec: 240, limitSec: 420, heat: 1.35
  },
  {
    id: 'hell', name: '지옥', level: 4,
    desc: '실제 최상위 티켓팅. 대부분 좌석 화면조차 보지 못하고 끝납니다.',
    users: 850000, seats: 850, selloutSec: 48, drain: 600, maxWaitSec: 32,
    errorRate: 0.19, latMu: 6.1, latSig: 0.85, holdSec: 180, limitSec: 360, heat: 1.7
  }
];

/* ─────────── 목표 좌석 (선택사항) ─────────── */
TP.TARGETS = [
  { id: 'any',  label: '아무 자리나',   desc: '일단 성공이 목표' },
  { id: 'VIP',  label: 'VIP석',        desc: '최상위 등급' },
  { id: 'R',    label: 'R석 이상',      desc: 'R 또는 VIP' },
  { id: 'front',label: '앞줄 (1~5열)',  desc: '등급 무관 앞자리' },
  { id: 'multi',label: '연석 2매',      desc: '붙어있는 두 자리' }
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
