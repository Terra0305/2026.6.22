(function () {
  const STORAGE_KEY = 'aquaguard-demo-state-v4';
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

  function toneFor(pressure, vibration, targetId) {
    if (targetId === 'recovery') return 'recovery';
    if (pressure >= 8 || vibration >= 75) return 'danger';
    if (pressure >= 7 || vibration >= 50) return 'warning';
    return 'normal';
  }

  function materialize(source, now = Date.now()) {
    if (!source.transition) return source;
    const transition = source.transition;
    const target = scenarios[transition.targetId];
    const progress = Math.min(1, Math.max(0, (now - transition.startedAt) / transition.duration));
    const eased = progress < .5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    const pressure = transition.startPressure + (target.pressure - transition.startPressure) * eased;
    const vibration = Math.round(transition.startVibration + (target.vibration - transition.startVibration) * eased);
    const tone = toneFor(pressure, vibration, transition.targetId);
    const toneData = scenarios[tone];
    const generatedCount = Math.max(1, Math.round(progress * 11));
    const generated = Array.from({ length: generatedCount }, (_, index) => {
      const fraction = (index + 1) / generatedCount * eased;
      return Number((transition.startPressure + (target.pressure - transition.startPressure) * fraction).toFixed(2));
    });
    const history = [...transition.startHistory.slice(-(12 - generatedCount)), ...generated].slice(-12);
    return {
      ...toneData,
      id: transition.targetId,
      tone,
      pressure: Number(pressure.toFixed(2)),
      vibration,
      history,
      eventId: source.eventId,
      updatedAt: source.updatedAt,
      transition,
      transitionProgress: progress
    };
  }

  function publish(id) {
    const state = stateFor(id);
    return publishLive(state);
  }

  function publishLive(input) {
    const state = {
      ...scenarios.normal,
      ...input,
      eventId: input.eventId || `${Date.now()}-${Math.random()}`,
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (channel) channel.postMessage(state);
    window.dispatchEvent(new CustomEvent('aquaguard-state', { detail: state }));
    return state;
  }

  function startTransition(targetId, duration) {
    const start = materialize(read());
    const state = {
      ...start,
      eventId: `sequence-${Date.now()}-${Math.random()}`,
      updatedAt: new Date().toISOString(),
      transition: {
        targetId,
        startedAt: Date.now(),
        duration,
        startPressure: start.pressure,
        startVibration: start.vibration,
        startHistory: [...(start.history || scenarios.normal.history)]
      }
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (channel) channel.postMessage(state);
    window.dispatchEvent(new CustomEvent('aquaguard-state', { detail: state }));
    return state;
  }

  function subscribe(handler) {
    let timer = null;
    let activeState = null;
    function deliver(state) {
      activeState = state;
      if (timer) clearInterval(timer);
      if (!state.transition) { handler(state); return; }
      const tick = () => {
        const current = materialize(state);
        handler(current);
        if (current.transitionProgress >= 1 && timer) { clearInterval(timer); timer = null; }
      };
      tick();
      timer = setInterval(tick, 100);
    }
    deliver(read());
    if (channel) channel.addEventListener('message', (event) => deliver(event.data));
    window.addEventListener('storage', (event) => {
      if (event.key === STORAGE_KEY && event.newValue) deliver(JSON.parse(event.newValue));
    });
    window.addEventListener('aquaguard-state', (event) => deliver(event.detail));
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && activeState && activeState.transition) handler(materialize(activeState));
    });
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

  window.AquaGuardDemo = { scenarios, read, materialize, publish, publishLive, startTransition, subscribe, requestNotifications, notifyDanger };
})();
