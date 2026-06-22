(function () {
  const STORAGE_KEY = 'aquaguard-demo-state-v1';
  const CHANNEL_NAME = 'aquaguard-demo-channel';

  const scenarios = {
    normal: {
      id: 'normal', label: '정상', tone: 'normal', pressure: 5.2, vibration: 18,
      message: '모든 센서가 정상 범위입니다.',
      history: [5.0, 5.1, 5.0, 5.2, 5.1, 5.3, 5.2, 5.2, 5.1, 5.2, 5.3, 5.2]
    },
    warning: {
      id: 'warning', label: '주의', tone: 'warning', pressure: 7.4, vibration: 55,
      message: '수압과 진동이 평소보다 높습니다.',
      history: [5.1, 5.2, 5.4, 5.7, 5.8, 6.1, 6.3, 6.6, 6.8, 7.0, 7.2, 7.4]
    },
    danger: {
      id: 'danger', label: '위험', tone: 'danger', pressure: 8.5, vibration: 82,
      message: '메인 펌프 A동 이상. 즉시 점검이 필요합니다.',
      history: [5.2, 5.4, 5.8, 6.1, 6.5, 6.9, 7.2, 7.6, 7.9, 8.1, 8.3, 8.5]
    },
    recovery: {
      id: 'recovery', label: '복구 중', tone: 'recovery', pressure: 6.3, vibration: 32,
      message: '수압과 진동이 정상 범위로 내려오고 있습니다.',
      history: [8.5, 8.2, 7.9, 7.6, 7.4, 7.1, 6.9, 6.7, 6.6, 6.5, 6.4, 6.3]
    }
  };

  let channel = null;
  try { channel = new BroadcastChannel(CHANNEL_NAME); } catch (_) {}

  function stateFor(id) {
    const base = scenarios[id] || scenarios.normal;
    return { ...base, eventId: `${Date.now()}-${Math.random()}`, updatedAt: new Date().toISOString() };
  }

  function read() {
    try {
      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return stored && stored.id ? stored : stateFor('normal');
    } catch (_) { return stateFor('normal'); }
  }

  function publish(id) {
    const state = stateFor(id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (channel) channel.postMessage(state);
    window.dispatchEvent(new CustomEvent('aquaguard-state', { detail: state }));
    return state;
  }

  function subscribe(handler) {
    handler(read());
    if (channel) channel.addEventListener('message', (event) => handler(event.data));
    window.addEventListener('storage', (event) => {
      if (event.key === STORAGE_KEY && event.newValue) handler(JSON.parse(event.newValue));
    });
    window.addEventListener('aquaguard-state', (event) => handler(event.detail));
  }

  async function requestNotifications() {
    if (!('Notification' in window)) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    return Notification.requestPermission();
  }

  function notifyDanger(state) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return false;
    new Notification('AquaGuard AI 긴급 경고', {
      body: `${state.message} 현재 수압 ${state.pressure} bar, 진동 이상 점수 ${state.vibration}점`,
      icon: '/assets/logo.png', tag: 'aquaguard-danger', requireInteraction: true
    });
    return true;
  }

  window.AquaGuardDemo = { scenarios, read, publish, subscribe, requestNotifications, notifyDanger };
})();
