import {useEffect, useEffectEvent, useRef, useState, type CSSProperties} from 'react'
import {
  Camera,
  CameraOff,
  ClipboardPaste,
  Flashlight,
  FlashlightOff,
  ImageUp,
  SwitchCamera,
} from 'lucide-react'
import {Button} from '@astryxdesign/core/Button'
import {IconButton} from '@astryxdesign/core/IconButton'
import {Switch} from '@astryxdesign/core/Switch'
import {decodeSource, preferredEngine, type ScanEngine} from '#/lib/scan'
import {useT, type MessageKey} from '#/i18n'

interface Props {
  onResult: (text: string) => void
  onPickImage?: () => void
  isPickingImage?: boolean
  onPaste?: () => void
  isPasting?: boolean
  externalScanCount?: number
  startRequest?: number
  autoStart?: boolean
}

const CAMERA_START_EVENT = 'qrviet:scan-camera-start'
let cameraStartSeq = 0
let cameraConsumedSeq = 0

/** Ask the scan page to open the camera immediately (e.g. from the bottom nav Scan FAB). */
export function requestCameraStart() {
  cameraStartSeq++
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CAMERA_START_EVENT))
}

/** Subscribe to pending/future camera start requests without double-firing under StrictMode. */
export function subscribeCameraStart(onTrigger: () => void): () => void {
  const flush = () => {
    if (cameraStartSeq === cameraConsumedSeq) return
    cameraConsumedSeq = cameraStartSeq
    onTrigger()
  }
  flush()
  window.addEventListener(CAMERA_START_EVENT, flush)
  return () => window.removeEventListener(CAMERA_START_EVENT, flush)
}

// Camera plumbing lives outside the component: plain async code, no render concerns.

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((tr) => tr.stop())
}

/** Opens the rear camera (or a chosen one), plays it in `video` and lists cameras. Null when cancelled meanwhile. */
async function startCamera(
  video: HTMLVideoElement,
  deviceId: string | undefined,
  cancelled: () => boolean,
) {
  const size = {width: {ideal: 1280}, height: {ideal: 720}}
  let stream: MediaStream | null = null
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: deviceId
        ? {deviceId: {exact: deviceId}, ...size}
        : {facingMode: {ideal: 'environment'}, ...size},
    })
    // The user may have stopped, switched tab or left the page while permission was pending.
    if (cancelled()) {
      stopStream(stream)
      return null
    }
    video.srcObject = stream
    const [, rawDevices] = await Promise.all([
      video.play(),
      navigator.mediaDevices.enumerateDevices(),
    ])
    const devices = rawDevices.filter((d) => d.kind === 'videoinput')
    if (cancelled()) {
      stopStream(stream)
      return null
    }
    const track = stream.getVideoTracks()[0]
    const caps = track?.getCapabilities?.() as {torch?: boolean} | undefined
    const activeDeviceId = track?.getSettings?.().deviceId
    return {stream, devices, torch: Boolean(caps?.torch), activeDeviceId}
  } catch (e) {
    stopStream(stream)
    throw e
  }
}

function cameraError(e: unknown): MessageKey {
  const name = (e as DOMException | undefined)?.name
  return name === 'NotFoundError' || name === 'OverconstrainedError'
    ? 'scan.noCamera'
    : 'scan.permission'
}

/** First code found in the current frame; decode failures just mean "nothing yet". */
async function decodeFrame(video: HTMLVideoElement): Promise<string | null> {
  if (video.readyState < 2 || !video.videoWidth) return null
  try {
    return (await decodeSource(video, video.videoWidth, video.videoHeight))[0] ?? null
  } catch {
    return null
  }
}

async function setTorchOn(track: MediaStreamTrack, on: boolean): Promise<boolean> {
  try {
    await track.applyConstraints({advanced: [{torch: on} as MediaTrackConstraintSet]})
    return true
  } catch {
    return false
  }
}

export function CameraScanner({
  onResult,
  onPickImage,
  isPickingImage = false,
  onPaste,
  isPasting = false,
  externalScanCount = 0,
  startRequest = 0,
  autoStart = false,
}: Props) {
  const t = useT()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const runningRef = useRef(false)
  /** Bumped by every start/stop; a camera that opens for an old attempt is discarded. */
  const attemptRef = useRef(0)
  const mountedRef = useRef(true)
  const lastRef = useRef<{text: string; at: number} | null>(null)
  const continuousRef = useRef(false)
  const onResultRef = useRef(onResult)
  const prevExternalRef = useRef(externalScanCount)
  const flipTimerRef = useRef<number | null>(null)

  const [state, setState] = useState<'idle' | 'starting' | 'running' | 'switching'>('idle')
  const [flipPhase, setFlipPhase] = useState<'idle' | 'out' | 'in'>('idle')
  const [error, setError] = useState<MessageKey | null>(null)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceIndex, setDeviceIndex] = useState(-1)
  const [torch, setTorch] = useState<{supported: boolean; on: boolean}>({
    supported: false,
    on: false,
  })
  const [continuous, setContinuous] = useState(false)
  const [engine, setEngine] = useState<ScanEngine | null>(null)

  // The scan loop runs outside React (timers): it reads the latest props/state through refs.
  useEffect(() => {
    onResultRef.current = onResult
    continuousRef.current = continuous
  })

  useEffect(() => {
    void preferredEngine().then(setEngine)
  }, [])

  const clearFlipTimer = () => {
    if (flipTimerRef.current != null) {
      window.clearTimeout(flipTimerRef.current)
      flipTimerRef.current = null
    }
  }

  const stop = () => {
    attemptRef.current++
    runningRef.current = false
    clearFlipTimer()
    stopStream(streamRef.current)
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setTorch({supported: false, on: false})
    setFlipPhase('idle')
    setState('idle')
  }

  const loop = async () => {
    const video = videoRef.current
    if (!runningRef.current || !video) return
    const text = await decodeFrame(video)
    if (text) {
      const now = Date.now()
      const last = lastRef.current
      if (!last || last.text !== text || now - last.at > 2500) {
        lastRef.current = {text, at: now}
        navigator.vibrate?.(60)
        onResultRef.current(text)
        if (!continuousRef.current) {
          stop()
          return
        }
      }
    }
    if (runningRef.current) window.setTimeout(() => void loop(), 110)
  }

  const resolveIndex = (
    list: MediaDeviceInfo[],
    activeId: string | undefined,
    fallback: number,
  ) => {
    if (activeId) {
      const matched = list.findIndex((d) => d.deviceId === activeId)
      if (matched >= 0) return matched
    }
    return fallback >= 0 ? fallback : 0
  }

  const start = (index = deviceIndex) => {
    setError(null)
    if (!window.isSecureContext) return setError('scan.insecure')
    if (!navigator.mediaDevices?.getUserMedia) return setError('scan.noCamera')
    const video = videoRef.current
    if (!video) return
    stop()
    const attempt = ++attemptRef.current
    const cancelled = () => attempt !== attemptRef.current || !mountedRef.current
    setState('starting')
    startCamera(video, index >= 0 ? devices[index]?.deviceId : undefined, cancelled).then(
      (camera) => {
        if (!camera) return
        streamRef.current = camera.stream
        setDevices(camera.devices)
        setDeviceIndex(resolveIndex(camera.devices, camera.activeDeviceId, index))
        setTorch({supported: camera.torch, on: false})
        runningRef.current = true
        setState('running')
        void loop()
      },
      (e: unknown) => {
        if (cancelled()) return
        setState('idle')
        setError(cameraError(e))
      },
    )
  }

  // Release the camera when the tab is hidden or the component unmounts.
  const release = useEffectEvent(() => stop())
  useEffect(() => {
    const onHide = () => document.hidden && release()
    mountedRef.current = true
    document.addEventListener('visibilitychange', onHide)
    return () => {
      mountedRef.current = false
      document.removeEventListener('visibilitychange', onHide)
      release()
    }
  }, [])

  // Auto-start once, on mount (later prop changes do not restart the camera).
  const startOnMount = useEffectEvent(() => {
    if (autoStart) start()
  })
  useEffect(() => {
    startOnMount()
  }, [])

  // Start immediately when triggered from the bottom nav Scan FAB.
  const startOnRequest = useEffectEvent(() => {
    if (startRequest > 0 && state === 'idle') start()
  })
  useEffect(() => {
    startOnRequest()
  }, [startRequest])

  // Stop single-scan camera after an image upload (or paste/drop) decodes a QR code.
  const stopOnExternal = useEffectEvent(() => {
    if (runningRef.current && !continuousRef.current) stop()
  })
  useEffect(() => {
    if (externalScanCount === prevExternalRef.current) return
    prevExternalRef.current = externalScanCount
    stopOnExternal()
  }, [externalScanCount])

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    const on = !torch.on
    setTorch((await setTorchOn(track, on)) ? {supported: true, on} : {supported: false, on: false})
  }

  const switchCamera = () => {
    if (state !== 'running' || devices.length < 2) return
    const video = videoRef.current
    if (!video) return
    const baseIndex = deviceIndex >= 0 ? deviceIndex : 0
    const next = (baseIndex + 1) % devices.length
    setDeviceIndex(next)
    setError(null)
    setTorch({supported: false, on: false})

    // Keep the active scanner UI mounted (no "Start camera" loading button flash) while flipping.
    clearFlipTimer()
    runningRef.current = false
    stopStream(streamRef.current)
    streamRef.current = null
    const attempt = ++attemptRef.current
    const cancelled = () => attempt !== attemptRef.current || !mountedRef.current
    setState('switching')
    setFlipPhase('out')

    const flipOutDelay = new Promise<void>((resolve) => window.setTimeout(resolve, 160))
    Promise.all([startCamera(video, devices[next]?.deviceId, cancelled), flipOutDelay]).then(
      ([camera]) => {
        if (!camera || cancelled()) return
        streamRef.current = camera.stream
        setDevices(camera.devices)
        setDeviceIndex(resolveIndex(camera.devices, camera.activeDeviceId, next))
        setTorch({supported: camera.torch, on: false})
        runningRef.current = true
        setState('running')
        setFlipPhase('in')
        flipTimerRef.current = window.setTimeout(() => {
          flipTimerRef.current = null
          setFlipPhase('idle')
        }, 250)
        void loop()
      },
      (e: unknown) => {
        if (cancelled()) return
        setFlipPhase('idle')
        setState('idle')
        if (videoRef.current) videoRef.current.srcObject = null
        setError(cameraError(e))
      },
    )
  }

  const running = state === 'running' || state === 'switching'
  const flipClass =
    flipPhase === 'out' ? 'qv-cam-flip-out' : flipPhase === 'in' ? 'qv-cam-flip-in' : ''
  return (
    <div className="flex flex-col gap-3">
      <div
        className="relative aspect-square overflow-hidden rounded-xl bg-[#0d0a0b] sm:aspect-4/3"
        style={{'--qv-scan-h': '280px'} as CSSProperties}
      >
        <video
          ref={videoRef}
          className={`absolute inset-0 size-full object-cover ${running ? flipClass : 'opacity-0'}`}
          playsInline
          muted
          aria-label={t('scan.camera')}
        />
        {running ? (
          <div className="qv-scanner-frame" aria-hidden />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white/80">
            <Camera size={40} aria-hidden />
            {error && <p className="max-w-xs text-sm text-white">{t(error)}</p>}
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                label={t('scan.start')}
                variant="primary"
                icon={<Camera size={16} />}
                isLoading={state === 'starting'}
                onClick={() => start()}
              />
              {error && onPickImage && (
                <IconButton
                  label={t('scan.uploadImage')}
                  tooltip={t('scan.uploadImage')}
                  icon={<ImageUp size={18} />}
                  className="bg-white/15 text-white hover:bg-white/25"
                  isLoading={isPickingImage}
                  onClick={onPickImage}
                />
              )}
              {onPaste && (
                <IconButton
                  label={t('scan.paste')}
                  tooltip={t('scan.paste')}
                  icon={<ClipboardPaste size={18} />}
                  className="bg-white/15 text-white hover:bg-white/25"
                  isLoading={isPasting}
                  onClick={onPaste}
                />
              )}
            </div>
          </div>
        )}
        {running && (
          <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2">
            <span className="rounded-full bg-black/55 px-2.5 py-1 text-xs text-white backdrop-blur">
              {t('scan.engine', {engine: engine === 'native' ? 'BarcodeDetector' : 'jsQR'})}
            </span>
            <span className="flex gap-1.5">
              {onPickImage && (
                <IconButton
                  label={t('scan.uploadImage')}
                  tooltip={t('scan.uploadImage')}
                  icon={<ImageUp size={18} />}
                  className="bg-black/55 text-white backdrop-blur hover:bg-black/75"
                  isLoading={isPickingImage}
                  onClick={onPickImage}
                />
              )}
              {torch.supported && (
                <IconButton
                  label={t('scan.torch')}
                  icon={torch.on ? <FlashlightOff size={18} /> : <Flashlight size={18} />}
                  className="bg-black/55 text-white backdrop-blur hover:bg-black/75"
                  onClick={() => void toggleTorch()}
                />
              )}
              {devices.length > 1 && (
                <IconButton
                  label={t('scan.switch')}
                  icon={
                    <SwitchCamera
                      size={18}
                      className={`transition-transform duration-300 ${flipPhase !== 'idle' ? 'rotate-180' : ''}`}
                    />
                  }
                  className="bg-black/55 text-white backdrop-blur hover:bg-black/75"
                  onClick={switchCamera}
                />
              )}
              <IconButton
                label={t('scan.stop')}
                icon={<CameraOff size={18} />}
                className="bg-black/55 text-white backdrop-blur hover:bg-black/75"
                onClick={stop}
              />
            </span>
          </div>
        )}
      </div>
      <Switch label={t('scan.continuous')} value={continuous} onChange={setContinuous} size="sm" />
    </div>
  )
}
