/* ═══════════════════════════════════════════════
   pwa.js — 서비스워커 등록 · 업데이트 · 홈 화면 설치

   서비스워커는 file:// 에서는 절대 동작하지 않는다 (브라우저 보안 제약).
   https 로 배포된 주소(또는 http://localhost)에서만 설치·오프라인이 된다.
   file:// 에서는 조용히 아무 것도 하지 않는다 — 콘솔에 오류를 남기지 않는다.
   ═══════════════════════════════════════════════ */
(function (TP) {

const $ = (sel) => document.querySelector(sel);

const PWA = {
  deferredPrompt: null,

  init() {
    this.registerSW();
    this.bindInstallPrompt();
    this.bindInstallButton();
    this.showIOSHintIfNeeded();
  },

  /* ─────────── 서비스워커 등록 · 업데이트 ───────────
     controllerchange 를 무조건 새로고침 신호로 쓰면 안 된다 — 처음 방문한
     사람도 SW 가 활성화되며 controller 가 null→값 으로 "바뀌므로" 똑같이
     걸려서, 첫 방문자까지 예상치 못한 새로고침을 겪는다.
     그래서 "새 버전으로 교체되는 순간"만 정확히 잡는다 —
     updatefound 시점에 이미 이 페이지를 관리하던 워커가 있었을 때만
     (= 신규 설치가 아니라 갱신일 때만) 새 워커가 activated 되는 순간 새로고침한다. */
  registerSW() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol === 'file:') {
      console.info('[PWA] file:// 에서는 서비스워커가 동작하지 않습니다. https 로 배포된 주소에서 설치할 수 있습니다.');
      return;
    }

    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').then((reg) => {
        reg.addEventListener('updatefound', () => {
          const fresh = reg.installing;
          if (!fresh) return;
          const isUpdate = !!navigator.serviceWorker.controller;
          fresh.addEventListener('statechange', () => {
            if (fresh.state !== 'activated' || !isUpdate) return;
            if (TP.ui && TP.ui.toast) TP.ui.toast('새 버전이 준비됐습니다. 곧 반영됩니다.', 'ok', 2200);
            setTimeout(() => location.reload(), 700);
          });
        });
      }).catch((e) => console.warn('[PWA] 서비스워커 등록 실패', e));
    });
  },

  /* ─────────── Android/데스크톱 설치 프롬프트 ─────────── */
  bindInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.setInstallButtonVisible(true);
    });
    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      this.setInstallButtonVisible(false);
      if (TP.ui && TP.ui.toast) TP.ui.toast('앱이 설치됐습니다. 홈 화면에서 바로 실행할 수 있습니다.', 'ok');
    });
  },

  bindInstallButton() {
    const btn = $('#btn-install-app');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      if (!this.deferredPrompt) return;
      this.deferredPrompt.prompt();
      await this.deferredPrompt.userChoice;
      this.deferredPrompt = null;
      this.setInstallButtonVisible(false);
    });
  },

  setInstallButtonVisible(on) {
    const btn = $('#btn-install-app');
    if (btn) btn.classList.toggle('hidden', !on);
  },

  /* ─────────── iOS 안내 ───────────
     iOS Safari 는 beforeinstallprompt 를 지원하지 않는다.
     이미 설치된 상태(standalone)라면 안내할 필요가 없다. */
  showIOSHintIfNeeded() {
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
    if (!isIOS || standalone) return;
    const hint = $('#ios-install-hint');
    if (hint) hint.classList.remove('hidden');
  }
};

TP.PWA = PWA;
document.addEventListener('DOMContentLoaded', () => PWA.init());

})(window.TP = window.TP || {});
