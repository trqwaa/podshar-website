/**
 * Конец отдыха — сигналом (1.55). Вибрация — где её дают (андроид); айфону
 * браузеры вибрировать не дают, поэтому ещё три коротких писка и вспышка
 * экрана. Писк на айфоне играет, только если звук разбудили нажатием:
 * `primeRestSignal` зовётся из галочки подхода, которая и запускает отдых. На
 * беззвучном режиме айфон глушит и его — остаётся вспышка.
 *
 * Мимо React: вспышка — элемент на одну анимацию, состояние ей ни к чему.
 */
let audio: AudioContext | null = null;

/**
 * Писк выключается кнопкой на таймере — чтобы не орать на весь зал. Выбор
 * помнит телефон: это удобство одного устройства, а не данные для всех.
 */
const SOUND_KEY = 'podshar:rest-sound';

export function soundOn(): boolean {
  try {
    return window.localStorage.getItem(SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setSoundOn(on: boolean) {
  try {
    window.localStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
  } catch {
    // Приватный режим: выбор проживёт до перезагрузки, и это не страшно.
  }
}

export function primeRestSignal() {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audio ??= new Ctx();
    if (audio.state === 'suspended') void audio.resume();
  } catch {
    audio = null;
  }
}

function beep(ctx: AudioContext) {
  const start = ctx.currentTime + 0.02;
  for (let i = 0; i < 3; i += 1) {
    const at = start + i * 0.22;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(0.3, at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.16);
    osc.connect(gain).connect(ctx.destination);
    osc.start(at);
    osc.stop(at + 0.18);
  }
}

export function restOver() {
  if ('vibrate' in navigator) navigator.vibrate?.([120, 80, 120]);
  if (audio?.state === 'running' && soundOn()) beep(audio);
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const flash = document.createElement('div');
  flash.className = 'pointer-events-none fixed inset-0 z-50 bg-accent';
  document.body.appendChild(flash);
  flash.animate([{ opacity: 0.35 }, { opacity: 0 }], { duration: 1200, easing: 'ease-out' }).finished.finally(() => flash.remove());
}
