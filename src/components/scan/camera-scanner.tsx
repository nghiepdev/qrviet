import {useEffect, useEffectEvent, useRef, useState, type CSSProperties} from 'react'
import {Camera, CameraOff, Flashlight, FlashlightOff, SwitchCamera} from 'lucide-react'
import {Button} from '@astryxdesign/core/Button'
import {IconButton} from '@astryxdesign/core/IconButton'
import {Switch} from '@astryxdesign/core/Switch'
import {decodeSource, preferredEngine, type ScanEngine} from '#/lib/scan'
import {useT, type MessageKey} from '#/i18n'

interface Props {
  onResult: (text: string) => void
  autoStart?: boolean
}

// Camera plumbing lives outside the component: plain async code, no render concerns.

function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((tr) => tr.stop())
}

/** Opens the rear camera (or a chosen one), plays it in `video` and lists cameras. Null when cancelled meanwhile. */
async function startCamera(video: HTMLVideoElement, deviceId: string | undefined, cancelled: () => boolean) {
  const size = {width: {ideal: 1280}, height: {ideal: 720}}
  let stream: MediaStream | null = null
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: deviceId ? {deviceId: {exact: deviceId}, ...size} : {facingMode: {ideal: 'environment'}, ...size},
    })
    // The user may have stopped, switched tab or left the page while permission was pending.
    if (cancelled()) {
      stopStream(stream)
      return null
    }
    video.srcObject = stream
    await video.play()
    const devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput')
    if (cancelled()) {
      stopStream(stream)
      return null
    }
    const caps = stream.getVideoTracks()[0]?.getCapabilities?.() as {torch?: boolean} | undefined
    return {stream, devices, torch: Boolean(caps?.torch)}
  } catch (e) {
    stopStream(stream)
    throw e
  }
}

function cameraError(e: unknown): MessageKey {
  const name = (e as DOMException | undefined)?.name
  return name === 'NotFoundError' || name === 'OverconstrainedError' ? 'scan.noCamera' : 'scan.permission'
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

export function CameraScanner({onResult, autoStart = false}: Props) {
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

  const [state, setState] = useState<'idle' | 'starting' | 'running'>('idle')
  const [error, setError] = useState<MessageKey | null>(null)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceIndex, setDeviceIndex] = useState(-1)
  const [torch, setTorch] = useState<{supported: boolean; on: boolean}>({supported: false, on: false})
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

  const stop = () => {
    attemptRef.current++
    runningRef.current = false
    stopStream(streamRef.current)
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setTorch({supported: false, on: false})
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

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    const on = !torch.on
    setTorch((await setTorchOn(track, on)) ? {supported: true, on} : {supported: false, on: false})
  }

  const switchCamera = () => {
    if (devices.length < 2) return
    const next = (deviceIndex + 1) % devices.length
    setDeviceIndex(next)
    start(next)
  }

  const running = state === 'running'
  return (
    <div className="flex flex-col gap-3">
      <div
        className="relative overflow-hidden rounded-xl bg-[#0d0a0b] aspect-square sm:aspect-[4/3] grid place-items-center"
        style={{'--qv-scan-h': '280px'} as CSSProperties}>
        <video ref={videoRef} className={`absolute inset-0 size-full object-cover ${running ? '' : 'opacity-0'}`} playsInline muted aria-label={t('scan.camera')} />
        {running ? (
          <div className="qv-scanner-frame" aria-hidden />
        ) : (
          <div className="relative flex flex-col items-center gap-3 p-6 text-center text-white/80">
            <Camera size={40} aria-hidden />
            {error && <p className="text-sm max-w-xs text-white">{t(error)}</p>}
            <Button label={t('scan.start')} variant="primary" icon={<Camera size={16} />} isLoading={state === 'starting'} onClick={() => start()} />
          </div>
        )}
        {running && (
          <div className="absolute bottom-3 inset-x-3 flex items-center justify-between gap-2">
            <span className="rounded-full bg-black/55 text-white text-xs px-2.5 py-1 backdrop-blur">{t('scan.engine', {engine: engine === 'native' ? 'BarcodeDetector' : 'jsQR'})}</span>
            <span className="flex gap-1.5">
              {torch.supported && (
                <IconButton label={t('scan.torch')} icon={torch.on ? <FlashlightOff size={18} /> : <Flashlight size={18} />} onClick={() => void toggleTorch()} />
              )}
              {devices.length > 1 && <IconButton label={t('scan.switch')} icon={<SwitchCamera size={18} />} onClick={switchCamera} />}
              <IconButton label={t('scan.stop')} icon={<CameraOff size={18} />} onClick={stop} />
            </span>
          </div>
        )}
      </div>
      <Switch label={t('scan.continuous')} value={continuous} onChange={setContinuous} size="sm" />
    </div>
  )
}
