/* ═══════════════════════════════════════════════
   sb.js — 공용 서버(Supabase) 접속 정보

   온라인 랭킹 · 실시간 대결 · 방문 계측이 모두 같은 프로젝트를 쓴다.
   주소와 키가 세 파일에 흩어져 있으면 프로젝트를 옮길 때 반드시 하나를
   빠뜨리므로, 여기 한 곳에만 둔다.

   ⚠ 여기 들어가는 키는 anon public(또는 Publishable) 키뿐이다.
     service_role(Secret) 키는 전체 권한을 가지므로 절대 넣지 않는다.
   ═══════════════════════════════════════════════ */
window.TP = window.TP || {};

TP.SB = {
  URL: 'https://kqzwoocompjuulbdvybm.supabase.co',
  KEY: 'sb_publishable_LG7CmxKpctuTGcV5C4wXQw_MjOphvbv',

  /* Supabase 키가 두 형식이다 — 예전 JWT(eyJ...)와 새 Publishable(sb_publishable_...).
     apikey 헤더만으로 role 이 정해지므로, Authorization 은 JWT 일 때만 붙인다. */
  headers(key) {
    const k = key || TP.SB.KEY;
    const h = { 'apikey': k, 'Content-Type': 'application/json' };
    if (/^ey[A-Za-z0-9_-]/.test(k)) h['Authorization'] = 'Bearer ' + k;
    return h;
  }
};
