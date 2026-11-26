import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Delete,
  Globe,
  ImagePlus,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  Trash2,
  WifiOff,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CLOCK_REQUIRED_COUNT,
  FrameRingBuffer,
  clampTilt,
  clampZoom,
  stepClockIndex,
  type ClockSeedMode,
} from '../../engine/gen7/clockHelper';
import { useApp } from '../../store/AppContext';
import { ScannerModalShell } from '../common/ScannerModalShell';
import { ClockReticleOverlay } from './ClockReticleOverlay';

interface ClockCameraHelperProps {
  mode: ClockSeedMode;
  isEndReading: boolean;
  offset: number;
  hasValidSeed: boolean;
  onConfirmSequence: (rawSequence: number[]) => void;
  close: () => void;
}

type HelperPhase = 'starting' | 'live' | 'frozen' | 'fallback' | 'paused';

interface ExtendedTrackCapabilities extends MediaTrackCapabilities {
  focusMode?: string[];
  zoom?: { min?: number; max?: number; step?: number };
}

const RING_CAPACITY = 10;
const SAMPLE_INTERVAL_MS = 150;
const RING_FRAME_SIZE = 320;
const FALLBACK_FRAME_SIZE = 480;

function formatClockIdx(idx: number): string {
  return String(idx).padStart(2, '0');
}

function captureSquareFromVideo(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  digitalZoom: number,
): string | null {
  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (vw <= 0 || vh <= 0) return null;

  if (canvas.width !== RING_FRAME_SIZE || canvas.height !== RING_FRAME_SIZE) {
    canvas.width = RING_FRAME_SIZE;
    canvas.height = RING_FRAME_SIZE;
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const baseSide = Math.min(vw, vh);
  const srcSide = Math.max(16, baseSide / Math.max(1, digitalZoom));
  const sx = (vw - srcSide) / 2;
  const sy = (vh - srcSide) / 2;

  ctx.clearRect(0, 0, RING_FRAME_SIZE, RING_FRAME_SIZE);
  ctx.drawImage(video, sx, sy, srcSide, srcSide, 0, 0, RING_FRAME_SIZE, RING_FRAME_SIZE);
  return canvas.toDataURL('image/jpeg', 0.78);
}

export default function ClockCameraHelper({
  mode,
  isEndReading,
  offset,
  hasValidSeed,
  onConfirmSequence,
  close,
}: ClockCameraHelperProps) {
  const { lang, isOnline, activeProfile } = useApp();
  const it = lang === 'it';

  const [openedProfile] = useState(() => ({
    id: activeProfile.id,
    game: activeProfile.gameVersion,
  }));
  const sameProfile =
    openedProfile.id === activeProfile.id &&
    openedProfile.game === activeProfile.gameVersion;

  const requiredCount = CLOCK_REQUIRED_COUNT[mode];

  // Persistent session controls across readings
  const [zoom, setZoom] = useState(2.0);
  const [tiltDeg, setTiltDeg] = useState(0);
  const [digitalZoom, setDigitalZoom] = useState(2.0);

  const [phase, setPhase] = useState<HelperPhase>('starting');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [draftRaw, setDraftRaw] = useState<number[]>([]);
  const [frozenFrames, setFrozenFrames] = useState<string[]>([]);
  const [scrubIndex, setScrubIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const hwZoomRangeRef = useRef<{ min: number; max: number } | null>(null);
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const ringBufferRef = useRef(new FrameRingBuffer<string>(RING_CAPACITY));
  const sampleTimerRef = useRef<number | null>(null);
  const phaseRef = useRef<HelperPhase>('starting');
  const zoomRef = useRef(zoom);
  const digitalZoomRef = useRef(digitalZoom);
  const mountedRef = useRef(true);
  const cameraAttemptRef = useRef(0);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    digitalZoomRef.current = digitalZoom;
  }, [digitalZoom]);

  const stopSampling = useCallback(() => {
    if (sampleTimerRef.current !== null) {
      window.clearInterval(sampleTimerRef.current);
      sampleTimerRef.current = null;
    }
  }, []);

  const zeroCaptureCanvas = useCallback(() => {
    if (captureCanvasRef.current) {
      captureCanvasRef.current.width = 0;
      captureCanvasRef.current.height = 0;
      captureCanvasRef.current = null;
    }
  }, []);

  const stopCamera = useCallback(() => {
    cameraAttemptRef.current += 1;
    stopSampling();
    const stream = streamRef.current;
    streamRef.current = null;
    hwZoomRangeRef.current = null;
    if (stream) {
      for (const track of stream.getTracks()) {
        try {
          track.stop();
        } catch {
          // ignore
        }
      }
    }
    if (videoRef.current) {
      try {
        videoRef.current.pause();
      } catch {
        // ignore
      }
      videoRef.current.srcObject = null;
    }
  }, [stopSampling]);

  const applyZoomToTrack = useCallback(async (targetZoom: number) => {
    const clamped = clampZoom(targetZoom, 1, 4);
    const stream = streamRef.current;
    const range = hwZoomRangeRef.current;
    const track = stream?.getVideoTracks()[0];

    if (track && range && range.max > range.min) {
      const hwTarget = Math.min(range.max, Math.max(range.min, clamped));
      try {
        await track.applyConstraints({
          advanced: [{ zoom: hwTarget }],
        } as unknown as MediaTrackConstraints);
        const residual = clamped / hwTarget;
        if (mountedRef.current) {
          setDigitalZoom(residual);
        }
        return;
      } catch {
        // Fallback transparently to pure digital zoom
      }
    }

    if (mountedRef.current) {
      setDigitalZoom(clamped);
    }
  }, []);

  const startSampling = useCallback(() => {
    stopSampling();
    sampleTimerRef.current = window.setInterval(() => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || phaseRef.current !== 'live') return;
      if (!captureCanvasRef.current) {
        captureCanvasRef.current = document.createElement('canvas');
      }
      const frame = captureSquareFromVideo(
        video,
        captureCanvasRef.current,
        digitalZoomRef.current,
      );
      if (frame) {
        ringBufferRef.current.push(frame);
      }
    }, SAMPLE_INTERVAL_MS);
  }, [stopSampling]);

  const startCamera = useCallback(async () => {
    stopCamera();
    const attemptId = ++cameraAttemptRef.current;
    ringBufferRef.current.clear();
    setCameraError(null);
    setPhase('starting');

    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      setPhase('fallback');
      setCameraError(
        it
          ? 'Fotocamera live non supportata su questo browser. Usa Apri foto.'
          : 'Live camera not supported here. Use Open photo instead.',
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      if (!mountedRef.current || cameraAttemptRef.current !== attemptId) {
        for (const track of stream.getTracks()) track.stop();
        return;
      }

      streamRef.current = stream;
      const track = stream.getVideoTracks()[0];
      if (track) {
        let caps: ExtendedTrackCapabilities | undefined;
        try {
          caps = track.getCapabilities?.() as ExtendedTrackCapabilities | undefined;
        } catch {
          caps = undefined;
        }

        if (caps?.focusMode?.includes('continuous')) {
          try {
            await track.applyConstraints({
              advanced: [{ focusMode: 'continuous' }],
            } as unknown as MediaTrackConstraints);
          } catch {
            // Ignore unsupported continuous focus constraints
          }
        }

        if (
          caps?.zoom &&
          typeof caps.zoom.min === 'number' &&
          typeof caps.zoom.max === 'number' &&
          caps.zoom.max > caps.zoom.min
        ) {
          hwZoomRangeRef.current = { min: caps.zoom.min, max: caps.zoom.max };
        }
      }

      if (!mountedRef.current || cameraAttemptRef.current !== attemptId) {
        stopCamera();
        return;
      }

      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => {});
      }

      await applyZoomToTrack(zoomRef.current);
      if (!mountedRef.current || cameraAttemptRef.current !== attemptId) {
        stopCamera();
        return;
      }

      setPhase('live');
      startSampling();
    } catch {
      if (!mountedRef.current || cameraAttemptRef.current !== attemptId) return;
      stopCamera();
      setPhase('fallback');
      setCameraError(
        it
          ? 'Permesso fotocamera negato o non disponibile. Puoi comunque usare Apri foto.'
          : 'Camera permission denied or unavailable. You can still use Open photo.',
      );
    }
  }, [applyZoomToTrack, it, startSampling, stopCamera]);

  useEffect(() => {
    mountedRef.current = true;
    void startCamera();
    return () => {
      mountedRef.current = false;
      stopCamera();
      zeroCaptureCanvas();
      ringBufferRef.current.clear();
    };
  }, [startCamera, stopCamera, zeroCaptureCanvas]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (!document.hidden) return;
      stopCamera();
      zeroCaptureCanvas();
      if (phaseRef.current === 'live' || phaseRef.current === 'starting') {
        setPhase('paused');
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [stopCamera, zeroCaptureCanvas]);

  const handleZoomChange = (nextZoom: number) => {
    const clamped = clampZoom(nextZoom, 1, 4);
    setZoom(clamped);
    if (phase === 'live') {
      void applyZoomToTrack(clamped);
    }
  };

  const handleFreeze = () => {
    if (phase !== 'live') return;
    const video = videoRef.current;
    if (video && video.readyState >= 2) {
      if (!captureCanvasRef.current) {
        captureCanvasRef.current = document.createElement('canvas');
      }
      const latest = captureSquareFromVideo(
        video,
        captureCanvasRef.current,
        digitalZoomRef.current,
      );
      if (latest) {
        ringBufferRef.current.push(latest);
      }
      try {
        video.pause();
      } catch {
        // ignore
      }
    }
    stopSampling();
    const frames = ringBufferRef.current.snapshot();
    if (frames.length === 0) {
      setCameraError(
        it
          ? 'Fotogramma non ancora pronto — riprova tra un istante.'
          : 'Frame not ready yet — try again in a moment.',
      );
      if (video) void video.play().catch(() => {});
      startSampling();
      return;
    }
    setCameraError(null);
    setFrozenFrames(frames);
    setScrubIndex(frames.length - 1);
    setPhase('frozen');
  };

  const resumeLiveOrFallback = useCallback(() => {
    setFrozenFrames([]);
    setScrubIndex(0);
    ringBufferRef.current.clear();
    if (streamRef.current && videoRef.current) {
      setPhase('live');
      void videoRef.current.play().catch(() => {});
      startSampling();
    } else if (phaseRef.current === 'frozen') {
      setPhase('fallback');
    }
  }, [startSampling]);

  const handleAddReading = () => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(10);
    }
    setDraftRaw((prev) => [...prev, selectedIndex]);
    resumeLiveOrFallback();
  };

  const handleStep = (delta: number) => {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(10);
    }
    setSelectedIndex((prev) => stepClockIndex(prev, delta));
  };

  const handlePhotoUpload = async (file: File) => {
    cameraAttemptRef.current += 1;
    stopSampling();
    const url = URL.createObjectURL(file);
    let tempCanvas: HTMLCanvasElement | null = null;
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const el = new Image();
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error('image_load_failed'));
        el.src = url;
      });
      if (!mountedRef.current) return;

      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      const baseSide = Math.min(w, h);
      const srcSide = Math.max(16, baseSide / Math.max(1, zoomRef.current));
      const sx = (w - srcSide) / 2;
      const sy = (h - srcSide) / 2;

      tempCanvas = document.createElement('canvas');
      tempCanvas.width = FALLBACK_FRAME_SIZE;
      tempCanvas.height = FALLBACK_FRAME_SIZE;
      const ctx = tempCanvas.getContext('2d');
      if (!ctx) throw new Error('canvas_unavailable');
      ctx.drawImage(
        img,
        sx,
        sy,
        srcSide,
        srcSide,
        0,
        0,
        FALLBACK_FRAME_SIZE,
        FALLBACK_FRAME_SIZE,
      );
      const dataUrl = tempCanvas.toDataURL('image/jpeg', 0.85);
      setCameraError(null);
      setFrozenFrames([dataUrl]);
      setScrubIndex(0);
      if (videoRef.current) {
        try {
          videoRef.current.pause();
        } catch {
          // ignore
        }
      }
      setPhase('frozen');
    } catch {
      if (mountedRef.current) {
        setCameraError(it ? 'Impossibile aprire la foto.' : 'Unable to open photo.');
      }
    } finally {
      URL.revokeObjectURL(url);
      if (tempCanvas) {
        tempCanvas.width = 0;
        tempCanvas.height = 0;
        tempCanvas = null;
      }
    }
  };

  const canConfirm =
    sameProfile &&
    (mode === 'qr'
      ? draftRaw.length >= requiredCount && hasValidSeed
      : draftRaw.length >= requiredCount);

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirmSequence(draftRaw);
    close();
  };

  const activeFrozenSrc = frozenFrames[scrubIndex] ?? '';
  const hasStream = streamRef.current !== null;
  const subtitle = `${activeProfile.name} · ${
    mode === 'save'
      ? isEndReading
        ? it
          ? `Save (End · offset ${offset} alla conferma)`
          : `Save (End · offset ${offset} on confirm)`
        : it
          ? 'Save (Start)'
          : 'Save (Start)'
      : mode === 'id'
        ? it
          ? 'New Game ID (Start · 9 letture)'
          : 'New Game ID (Start · 9 readings)'
        : it
          ? 'QR Scanner (Start · min 2 letture)'
          : 'QR Scanner (Start · min 2 readings)'
  }`;

  return (
    <ScannerModalShell
      icon={<Camera className="w-4 h-4 text-amber-400" aria-hidden="true" />}
      title={it ? 'Camera lancette' : 'Clock camera'}
      subtitle={subtitle}
      closeLabel={it ? 'Chiudi' : 'Close'}
      onClose={close}
    >

        {!sameProfile && (
          <p role="alert" className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-2 text-xs text-rose-200">
            {it ? 'Profilo cambiato. Riapri lo helper.' : 'Profile changed. Reopen the helper.'}
          </p>
        )}

        {cameraError && (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-200">
            {cameraError}
          </p>
        )}

        {/* Square Viewfinder / Frozen Frame + 17-tick Reticle */}
        <div className="relative mx-auto aspect-square w-full max-w-[340px] overflow-hidden rounded-2xl border border-zinc-800 bg-black">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className={`h-full w-full object-cover ${
              phase === 'live' || phase === 'starting' ? 'block' : 'hidden'
            }`}
            style={{
              transform: `scale(${digitalZoom})`,
              transformOrigin: 'center center',
            }}
          />

          {phase === 'frozen' && activeFrozenSrc && (
            <img
              src={activeFrozenSrc}
              alt={it ? 'Fotogramma congelato dell’orologio' : 'Frozen clock frame'}
              className="h-full w-full object-cover select-none"
              draggable={false}
            />
          )}

          {(phase === 'live' || phase === 'frozen') && (
            <ClockReticleOverlay
              selectedIndex={selectedIndex}
              tiltDeg={tiltDeg}
              interactive={phase === 'frozen'}
              onSelectIndex={setSelectedIndex}
            />
          )}

          {phase === 'starting' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-zinc-950/80 text-xs text-zinc-300">
              <Camera className="w-6 h-6 text-amber-400 animate-pulse" />
              <span>{it ? 'Avvio fotocamera…' : 'Starting camera…'}</span>
            </div>
          )}

          {phase === 'paused' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-950/90 p-4 text-center">
              <p className="text-xs text-zinc-300">
                {it
                  ? 'Fotocamera messa in pausa in background.'
                  : 'Camera paused while in background.'}
              </p>
              <button
                type="button"
                onClick={() => void startCamera()}
                className="min-h-11 px-4 rounded-xl bg-amber-400 text-zinc-950 text-xs font-bold flex items-center gap-1.5 active:scale-95 transition"
              >
                <Play className="w-4 h-4" />
                <span>{it ? 'Riattiva camera' : 'Resume camera'}</span>
              </button>
            </div>
          )}

          {phase === 'fallback' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-950/90 p-4 text-center">
              <ImagePlus className="w-7 h-7 text-amber-400" />
              <p className="text-xs text-zinc-300">
                {it
                  ? 'Scatta o seleziona una foto dell’orologio per allineare le 17 tacche.'
                  : 'Take or pick a clock photo to align the 17 ticks.'}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <label className="min-h-11 px-4 rounded-xl bg-amber-400 text-zinc-950 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer active:scale-95 transition">
                  <ImagePlus className="w-4 h-4" />
                  <span>{it ? 'Apri foto' : 'Open photo'}</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void handlePhotoUpload(f);
                      e.target.value = '';
                    }}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => void startCamera()}
                  className="min-h-11 px-3 rounded-xl border border-zinc-700 bg-zinc-900 text-xs font-medium text-zinc-200 active:scale-95 transition"
                >
                  {it ? 'Riprova live' : 'Retry live'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Micro-scrub & Manual 17-tick fine selection when frozen */}
        {phase === 'frozen' && (
          <div className="space-y-2.5 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-2.5">
            {frozenFrames.length > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={scrubIndex <= 0}
                  onClick={() => setScrubIndex((i) => Math.max(0, i - 1))}
                  aria-label={it ? 'Fotogramma precedente' : 'Previous frame'}
                  className="h-11 w-11 shrink-0 rounded-xl border border-zinc-700 bg-zinc-950 flex items-center justify-center disabled:opacity-40 active:scale-95"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <input
                  type="range"
                  min={0}
                  max={frozenFrames.length - 1}
                  step={1}
                  value={scrubIndex}
                  onChange={(e) => setScrubIndex(Number(e.target.value))}
                  aria-label={it ? 'Scorri fotogrammi recenti' : 'Scrub recent frames'}
                  className="flex-1 accent-amber-400"
                />
                <button
                  type="button"
                  disabled={scrubIndex >= frozenFrames.length - 1}
                  onClick={() => setScrubIndex((i) => Math.min(frozenFrames.length - 1, i + 1))}
                  aria-label={it ? 'Fotogramma successivo' : 'Next frame'}
                  className="h-11 w-11 shrink-0 rounded-xl border border-zinc-700 bg-zinc-950 flex items-center justify-center disabled:opacity-40 active:scale-95"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <span className="font-mono text-[11px] tabular-nums text-zinc-400 shrink-0">
                  {scrubIndex + 1}/{frozenFrames.length}
                </span>
              </div>
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleStep(-1)}
                aria-label={it ? 'Tacca precedente' : 'Previous tick'}
                className="h-12 w-12 shrink-0 rounded-xl border border-zinc-700 bg-zinc-950 flex items-center justify-center text-zinc-200 active:scale-95"
              >
                <Minus className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={handleAddReading}
                className="min-h-12 flex-1 rounded-xl bg-amber-400 text-zinc-950 text-sm font-bold flex items-center justify-center gap-1.5 active:scale-95 transition"
              >
                <Plus className="w-4 h-4" />
                <span>
                  {it
                    ? `Aggiungi ${formatClockIdx(selectedIndex)}`
                    : `Add ${formatClockIdx(selectedIndex)}`}
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleStep(1)}
                aria-label={it ? 'Tacca successiva' : 'Next tick'}
                className="h-12 w-12 shrink-0 rounded-xl border border-zinc-700 bg-zinc-950 flex items-center justify-center text-zinc-200 active:scale-95"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            <button
              type="button"
              onClick={resumeLiveOrFallback}
              className="w-full min-h-11 rounded-xl border border-zinc-700 bg-zinc-950 text-xs font-medium text-zinc-300 flex items-center justify-center gap-1.5 active:scale-95"
            >
              <Play className="w-3.5 h-3.5" />
              <span>
                {hasStream
                  ? it
                    ? 'Riprendi live'
                    : 'Resume live'
                  : it
                    ? 'Scarta foto'
                    : 'Discard photo'}
              </span>
            </button>
          </div>
        )}

        {/* Primary bottom thumb button: Freeze when live */}
        {phase === 'live' && (
          <button
            type="button"
            onClick={handleFreeze}
            className="min-h-14 w-full rounded-2xl bg-amber-400 text-zinc-950 text-base font-bold flex items-center justify-center gap-2 shadow-lg active:scale-95 transition"
          >
            <Pause className="w-5 h-5" />
            <span>Freeze</span>
          </button>
        )}

        {/* Persistent Zoom & Tilt controls + Secondary Photo Fallback */}
        <div className="space-y-2 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-2.5 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-zinc-400 font-medium">
              Zoom {zoom.toFixed(1)}×
            </span>
            <input
              type="range"
              min={1}
              max={4}
              step={0.25}
              value={zoom}
              onChange={(e) => handleZoomChange(Number(e.target.value))}
              aria-label="Zoom"
              className="flex-1 accent-amber-400"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="w-16 shrink-0 text-zinc-400 font-medium">
              {it ? 'Inclin.' : 'Tilt'} {tiltDeg > 0 ? `+${tiltDeg}°` : `${tiltDeg}°`}
            </span>
            <input
              type="range"
              min={-15}
              max={15}
              step={1}
              value={tiltDeg}
              onChange={(e) => setTiltDeg(clampTilt(Number(e.target.value)))}
              aria-label={it ? 'Inclinazione mirino' : 'Reticle tilt'}
              className="flex-1 accent-amber-400"
            />
            <button
              type="button"
              onClick={() => setTiltDeg(0)}
              disabled={tiltDeg === 0}
              title={it ? 'Azzera inclinazione' : 'Reset tilt'}
              className="min-h-11 px-3 rounded-xl border border-zinc-700 bg-zinc-950 text-xs text-zinc-300 disabled:opacity-40 flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>0°</span>
            </button>
          </div>

          <div className="flex items-center justify-between gap-2 pt-0.5">
            <span className="text-[11px] text-zinc-400">
              {it
                ? 'Tocca il quadrante congelato o usa −1 / +1.'
                : 'Tap frozen dial or use −1 / +1.'}
            </span>
            <label className="min-h-11 px-3 shrink-0 rounded-xl border border-zinc-700 bg-zinc-950 text-xs font-medium text-zinc-200 inline-flex items-center gap-1.5 cursor-pointer active:scale-95">
              <ImagePlus className="w-3.5 h-3.5" />
              <span>{it ? 'Apri foto' : 'Open photo'}</span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handlePhotoUpload(f);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        </div>

        {/* Independent local draft bar */}
        <div className="space-y-2 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-zinc-300">
                {it ? 'Bozza camera' : 'Camera draft'}
              </span>
              <span
                className={`px-2 py-0.5 rounded-full font-mono text-xs font-bold tabular-nums ${
                  draftRaw.length >= requiredCount
                    ? 'bg-emerald-500/20 text-emerald-300'
                    : 'bg-zinc-800 text-zinc-400'
                }`}
              >
                {draftRaw.length}/{requiredCount}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={draftRaw.length === 0}
                onClick={() => setDraftRaw((prev) => prev.slice(0, -1))}
                className="min-h-11 px-3 rounded-xl border border-zinc-700 bg-zinc-950 text-xs text-zinc-200 flex items-center gap-1 disabled:opacity-40"
              >
                <Delete className="w-3.5 h-3.5" />
                <span>{it ? 'Annulla' : 'Undo'}</span>
              </button>
              <button
                type="button"
                disabled={draftRaw.length === 0}
                onClick={() => setDraftRaw([])}
                className="min-h-11 px-3 rounded-xl border border-zinc-700 bg-zinc-950 text-xs text-rose-300 flex items-center gap-1 disabled:opacity-40"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{it ? 'Svuota' : 'Clear'}</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 min-h-7">
            {draftRaw.length === 0 ? (
              <span className="text-xs text-zinc-500 italic">—</span>
            ) : (
              draftRaw.map((val, idx) => (
                <span
                  key={idx}
                  className="shrink-0 inline-flex items-center justify-center h-7 min-w-8 px-2 rounded-lg bg-zinc-800 border border-zinc-700 font-mono text-xs font-bold tabular-nums text-amber-300"
                >
                  {formatClockIdx(val)}
                </span>
              ))
            )}
          </div>
        </div>

        {/* Network / Seed guards & explicit confirmation */}
        {mode !== 'qr' && !isOnline && (
          <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-200">
            <WifiOff className="w-4 h-4 shrink-0 text-amber-400" />
            <span>
              {it
                ? 'Dispositivo offline: la ricerca seed richiede internet alla conferma.'
                : 'Device offline: seed lookup requires internet when confirmed.'}
            </span>
          </div>
        )}

        {mode === 'qr' && !hasValidSeed && (
          <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-xs text-amber-200">
            {it
              ? 'Inserisci prima un Initial Seed hex valido nella pagina Seed per cercare i frame QR.'
              : 'Enter a valid hex Initial Seed on the Seed page first to search QR frames.'}
          </p>
        )}

        <button
          type="button"
          disabled={!canConfirm}
          onClick={handleConfirm}
          className="min-h-12 w-full rounded-xl bg-sky-400 text-zinc-950 text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-40 active:scale-95 transition"
        >
          {mode === 'qr' ? (
            <Search className="w-4 h-4 shrink-0" aria-hidden="true" />
          ) : (
            <Globe className="w-4 h-4 shrink-0" aria-hidden="true" />
          )}
          <span>
            {mode === 'qr'
              ? it
                ? 'Cerca frame QR'
                : 'Search QR frames'
              : it
                ? 'Cerca seed online'
                : 'Look up seed online'}
          </span>
        </button>
    </ScannerModalShell>
  );
}
