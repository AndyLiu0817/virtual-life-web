const musicFiles = import.meta.glob<string>("../audio/bgm/*.mp3", {
  query: "?url",
  import: "default",
});
const effectFiles = import.meta.glob<string>("../audio/sfx/*.mp3", {
  query: "?url",
  import: "default",
});

type Music =
  | "title"
  | "story"
  | `board_${"junior" | "high" | "university"}`
  | `mg_${"rhythm" | "memory" | "math" | "shoot" | "whack" | "diff" | "catch" | "stack"}`;
type Effect =
  | "dice_roll"
  | "pawn_step"
  | "event_good"
  | "event_bad"
  | "story"
  | "shop"
  | "deity"
  | "game_start"
  | "answer_right"
  | "answer_wrong"
  | "mg_hit"
  | "mg_miss"
  | "mg_clear"
  | "mg_fail"
  | "ui_click"
  | "dialog_open"
  | "dialog_close"
  | "gain"
  | "loss"
  | "turn";

const settingsKey = "virtual-life-web.audio";
const defaults = {
  bgmVolume: 0.65,
  sfxVolume: 0.8,
  bgmMuted: false,
  sfxMuted: false,
};
type Settings = typeof defaults;

function loadSettings(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(settingsKey) ?? "null");
    const volume = (value: unknown, fallback: number) =>
      typeof value === "number" && Number.isFinite(value)
        ? Math.max(0, Math.min(1, value))
        : fallback;
    return {
      bgmVolume: volume(saved?.bgmVolume, defaults.bgmVolume),
      sfxVolume: volume(saved?.sfxVolume, defaults.sfxVolume),
      bgmMuted: saved?.bgmMuted === true,
      sfxMuted: saved?.sfxMuted === true,
    };
  } catch {
    return { ...defaults };
  }
}

let settings = loadSettings();

export function readAudioSettings() {
  return { ...settings };
}
let context: AudioContext | undefined;
let musicBus: GainNode;
let effectsBus: GainNode;
let unlocked = false;
let unlocking = false;
let baseMusic: Music = "title";
const modals = new Map<HTMLDialogElement, { track?: Music }>();
const effects = new Map<string, Promise<AudioBuffer | undefined>>();
const voices = new Map<Effect, AudioBufferSourceNode>();
const pending = new Map<Effect, number>();
let effectSequence = 0;
let refreshQueued = false;

interface PlayingMusic {
  track: Music;
  gain: GainNode;
  duck: GainNode;
  stop: (at: number) => void;
}
let playing: PlayingMusic | undefined;
let loading: Music | undefined;

export function updateAudioSettings(values: Settings) {
  settings = { ...values };
  try {
    localStorage.setItem(settingsKey, JSON.stringify(settings));
  } catch {
    // The controls still work when storage is unavailable.
  }
  updateVolumes();
}

function updateVolumes() {
  if (!context) return;
  musicBus.gain.setTargetAtTime(
    settings.bgmMuted ? 0 : settings.bgmVolume,
    context.currentTime,
    0.025,
  );
  effectsBus.gain.setTargetAtTime(
    settings.sfxMuted ? 0 : settings.sfxVolume,
    context.currentTime,
    0.012,
  );
}

async function decode(audio: AudioContext, load?: () => Promise<string>) {
  try {
    if (!load) return;
    const response = await fetch(await load());
    if (response.ok)
      return await audio.decodeAudioData(await response.arrayBuffer());
  } catch {
    // Missing or unsupported audio must not interrupt play.
  }
}

function effectBuffer(id: string) {
  if (!effects.has(id))
    effects.set(
      id,
      decode(context!, effectFiles[`../audio/sfx/sfx_${id}.mp3`]),
    );
  return effects.get(id)!;
}

function unlock() {
  if (context?.state === "running") return;
  try {
    if (!context) {
      const Audio =
        window.AudioContext ??
        (window as Window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Audio) return;
      context = new Audio();
      musicBus = context.createGain();
      effectsBus = context.createGain();
      const limiter = context.createDynamicsCompressor();
      limiter.threshold.value = -6;
      limiter.knee.value = 0;
      limiter.ratio.value = 16;
      limiter.attack.value = 0.003;
      musicBus.connect(limiter);
      effectsBus.connect(limiter);
      limiter.connect(context.destination);
      updateVolumes();
    }
    unlocking = true;
    void context
      .resume()
      .then(() => {
        if (!unlocked) {
          unlocked = true;
          for (const path of Object.keys(effectFiles))
            void effectBuffer(path.slice("../audio/sfx/sfx_".length, -4));
        }
        // A capture listener can resume audio before the button handler runs.
        // Select the first track after the gesture has finished dispatching.
        window.setTimeout(queueRefresh, 0);
      })
      .catch(() => {
        // A later gesture can retry if autoplay was blocked.
      })
      .finally(() => {
        unlocking = false;
      });
  } catch {
    // Audio is optional on browsers without a usable context.
  }
}

export function playEffect(id: Effect) {
  const audio = context;
  if (
    !audio ||
    (!unlocking && audio.state !== "running") ||
    settings.sfxMuted ||
    !settings.sfxVolume
  )
    return;
  const sequence = ++effectSequence;
  pending.set(id, sequence);
  const requested = performance.now();
  void effectBuffer(id).then((buffer) => {
    if (pending.get(id) !== sequence) return;
    pending.delete(id);
    if (
      !buffer ||
      audio.state !== "running" ||
      performance.now() - requested > 300
    )
      return;
    voices.get(id)?.stop();
    if (voices.size >= 6 && !voices.has(id)) {
      const oldest = voices.keys().next().value!;
      voices.get(oldest)?.stop();
      voices.delete(oldest);
    }
    const source = audio.createBufferSource();
    const gain = audio.createGain();
    gain.gain.value = 0.55;
    source.buffer = buffer;
    source.connect(gain).connect(effectsBus);
    voices.set(id, source);
    source.onended = () => {
      if (voices.get(id) === source) voices.delete(id);
      source.disconnect();
      gain.disconnect();
    };
    source.start();
  });
}

export function playBeat(atPerformanceTime: number, frequency: number) {
  if (context?.state !== "running") return;
  const audio = context;
  const at = audio.currentTime + (atPerformanceTime - performance.now()) / 1000;
  if (at < audio.currentTime) return;
  const tone = audio.createOscillator();
  const gain = audio.createGain();
  tone.frequency.value = frequency;
  gain.gain.setValueAtTime(0.045, at);
  gain.gain.exponentialRampToValueAtTime(0.001, at + 0.075);
  tone.connect(gain).connect(effectsBus);
  tone.start(at);
  tone.stop(at + 0.08);
  tone.onended = () => {
    tone.disconnect();
    gain.disconnect();
  };
}

export function setMusic(track: Music) {
  baseMusic = track;
  queueRefresh();
}

function desiredMusic() {
  let track = baseMusic;
  for (const [dialog, modal] of modals)
    if (dialog.open && dialog.isConnected && modal.track) track = modal.track;
  return track;
}

export function openAudioDialog(
  dialog: HTMLDialogElement,
  effect: Effect = "dialog_open",
  track?: Music,
) {
  dialog.showModal();
  const modal = { track };
  modals.set(dialog, modal);
  dialog.addEventListener(
    "close",
    () => {
      if (modals.get(dialog) !== modal) return;
      modals.delete(dialog);
      playEffect("dialog_close");
      queueRefresh();
    },
    { once: true },
  );
  playEffect(effect);
  queueRefresh();
}

export function setDialogMusic(dialog: HTMLDialogElement, track: Music) {
  const modal = modals.get(dialog);
  if (modal) modal.track = track;
  queueRefresh();
}

function queueRefresh() {
  if (refreshQueued) return;
  refreshQueued = true;
  queueMicrotask(() => {
    refreshQueued = false;
    void refreshMusic();
  });
}

function loopMusic(
  audio: AudioContext,
  buffer: AudioBuffer,
  track: Music,
): PlayingMusic {
  const gain = audio.createGain();
  gain.gain.value = 0;
  const duck = audio.createGain();
  gain.connect(duck).connect(musicBus);
  // The authored tracks are 75 s. Exclude trailing MP3 padding and overlap
  // the end and beginning on the audio clock, independently of render frames.
  const duration = Math.min(75, buffer.duration);
  const overlap = Math.min(0.35, duration / 4);
  const sources = new Set<AudioBufferSourceNode>();
  let next = audio.currentTime + 0.02;
  let first = true;
  function schedule() {
    // Schedule the next overlap even when a background tab throttles timers.
    while (next < audio.currentTime + duration + 5) {
      const start = Math.max(next, audio.currentTime + 0.005);
      const source = audio.createBufferSource();
      const envelope = audio.createGain();
      source.buffer = buffer;
      source.connect(envelope).connect(gain);
      envelope.gain.setValueAtTime(first ? 1 : 0, start);
      envelope.gain.linearRampToValueAtTime(1, start + overlap);
      envelope.gain.setValueAtTime(1, start + duration - overlap);
      envelope.gain.linearRampToValueAtTime(0, start + duration);
      source.start(start, 0, duration);
      sources.add(source);
      source.onended = () => {
        sources.delete(source);
        source.disconnect();
        envelope.disconnect();
      };
      first = false;
      next = start + duration - overlap;
    }
  }
  schedule();
  const timer = window.setInterval(schedule, 1000);
  return {
    track,
    gain,
    duck,
    stop(at) {
      window.clearInterval(timer);
      sources.forEach((source) => source.stop(at));
      window.setTimeout(
        () => {
          gain.disconnect();
          duck.disconnect();
        },
        (at - audio.currentTime) * 1000 + 100,
      );
    },
  };
}

async function refreshMusic() {
  const audio = context;
  if (!unlocked || audio?.state !== "running") return;
  const track = desiredMusic();
  const duck = track.startsWith("board_") && modals.size ? 0.35 : 1;
  if (playing?.track === track) {
    playing.duck.gain.setTargetAtTime(duck, audio.currentTime, 0.06);
    return;
  }
  if (loading === track) return;
  loading = track;
  const buffer = await decode(
    audio,
    musicFiles[`../audio/bgm/bgm_${track}.mp3`],
  );
  if (loading === track) loading = undefined;
  if (!buffer || desiredMusic() !== track || playing?.track === track) return;
  const now = audio.currentTime;
  const fade = matchMedia("(prefers-reduced-motion: reduce)").matches
    ? 0.3
    : 0.8;
  if (playing) {
    if (typeof playing.gain.gain.cancelAndHoldAtTime === "function") {
      playing.gain.gain.cancelAndHoldAtTime(now);
    } else {
      const level = playing.gain.gain.value;
      playing.gain.gain.cancelScheduledValues(now);
      playing.gain.gain.setValueAtTime(level, now);
    }
    playing.gain.gain.linearRampToValueAtTime(0, now + fade);
    playing.stop(now + fade);
  }
  playing = loopMusic(audio, buffer, track);
  playing.gain.gain.setValueAtTime(0, now);
  playing.gain.gain.linearRampToValueAtTime(1, now + fade);
  playing.duck.gain.value =
    track.startsWith("board_") && modals.size ? 0.35 : 1;
}

document.addEventListener(
  "click",
  (event) => {
    if (event.isTrusted) unlock();
    const button = (event.target as Element | null)?.closest<HTMLButtonElement>(
      "button",
    );
    if (
      !button ||
      button.matches(
        ":disabled, [data-audio-action], #roll, .assessment-option, .mg-field button",
      )
    )
      return;
    if (button.form?.method === "dialog") return;
    playEffect("ui_click");
  },
  true,
);
document.addEventListener(
  "keydown",
  (event) => {
    if (!event.isTrusted || event.key === "Escape") return;
    if (event.key === " " && event.target instanceof HTMLButtonElement) return;
    unlock();
  },
  true,
);
document.addEventListener(
  "touchend",
  (event) => {
    if (event.isTrusted && !(event.target as Element | null)?.closest("button"))
      unlock();
  },
  { capture: true, passive: true },
);
