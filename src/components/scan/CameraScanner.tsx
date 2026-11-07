import {useCallback, useEffect, useRef, useState} from 'react'
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


export function CameraScanner({onResult, autoStart = false}: Props) {
  const t = useT()
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const runningRef = useRef(false)
  /** Bumped by every start/stop; a getUserMedia that resolves for an old attempt is discarded. */
  const attemptRef = useRef(0)
  const mountedRef = useRef(true)
  const lastRef = useRef<{text: string; at: number} | null>(null)
  const continuousRef = useRef(false)
  const onResultRef = useRef(onResult)
  onResultRef.current = onResult

  const [state, setState] = useState<'idle' | 'starting' | 'running'>('idle')
  const [error, setError] = useState<MessageKey | null>(null)
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceIndex, setDeviceIndex] = useState(-1)
  const [torch, setTorch] = useState<{supported: boolean; on: boolean}>({supported: false, on: false})
  const [continuous, setContinuous] = useState(false)
  const [engine, setEngine] = useState<ScanEngine | null>(null)
  continuousRef.current = continuous

  useEffect(() => {
    void preferredEngine().then(setEngine)
  }, [])

  const stop = useCallback(() => {
    attemptRef.current++
    runningRef.current = false
    streamRef.current?.getTracks().forEach((tr) => tr.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
    setTorch({supported: false, on: false})
    setState('idle')
  }, [])

  const loop = useCallback(async () => {
    const video = videoRef.current
    if (!runningRef.current || !video) return
    if (video.readyState >= 2 && video.videoWidth) {
      try {
        const found = await decodeSource(video, video.videoWidth, video.videoHeight)
        const text = found[0]
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
      } catch {
        /* keep scanning */
      }
    }
    if (runningRef.current) window.setTimeout(() => void loop(), 110)
  }, [stop])

  const start = useCallback(
    async (index = deviceIndex) => {
      setError(null)
      if (!window.isSecureContext) return setError('scan.insecure')
      if (!navigator.mediaDevices?.getUserMedia) return setError('scan.noCamera')
      stop()
      const attempt = ++attemptRef.current
      const cancelled = () => attempt !== attemptRef.current || !mountedRef.current || !videoRef.current
      setState('starting')
      let stream: MediaStream | null = null
      try {
        const deviceId = index >= 0 ? devices[index]?.deviceId : undefined
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: deviceId
            ? {deviceId: {exact: deviceId}, width: {ideal: 1280}, height: {ideal: 720}}
            : {facingMode: {ideal: 'environment'}, width: {ideal: 1280}, height: {ideal: 720}},
        })
        // The user may have stopped, switched tab or left the page while permission was pending.
        if (cancelled()) {
          stream.getTracks().forEach((tr) => tr.stop())
          return
        }
        streamRef.current = stream
        const video = videoRef.current!
        video.srcObject = stream
        await video.play()
        const list = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput')
        if (cancelled()) {
          stream.getTracks().forEach((tr) => tr.stop())
          return
        }
        setDevices(list)
        const track = stream.getVideoTracks()[0]
        const caps = track?.getCapabilities?.() as {torch?: boolean} | undefined
        setTorch({supported: Boolean(caps?.torch), on: false})
        runningRef.current = true
        setState('running')
        void loop()
      } catch (e) {
        if (cancelled()) {
          stream?.getTracks().forEach((tr) => tr.stop())
          return
        }
        setState('idle')
        const name = (e as DOMException)?.name
        setError(name === 'NotFoundError' || name === 'OverconstrainedError' ? 'scan.noCamera' : 'scan.permission')
      }
    },
    [deviceIndex, devices, loop, stop],
  )

  // Release the camera when the tab is hidden or the component unmounts.
  useEffect(() => {
    const onHide = () => document.hidden && stop()
    mountedRef.current = true
    document.addEventListener('visibilitychange', onHide)
    return () => {
      mountedRef.current = false
      document.removeEventListener('visibilitychange', onHide)
      stop()
    }
  }, [stop])

  useEffect(() => {
    if (autoStart) void start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    const on = !torch.on
    try {
      await track.applyConstraints({advanced: [{torch: on} as MediaTrackConstraintSet]})
      setTorch({supported: true, on})
    } catch {
      setTorch({supported: false, on: false})
    }
  }

  const switchCamera = () => {
    if (devices.length < 2) return
    const next = (deviceIndex + 1) % devices.length
    setDeviceIndex(next)
    void start(next)
  }

  const running = state === 'running'
  return (
    <div className="flex flex-col gap-3">
      <div
        className="relative overflow-hidden rounded-xl bg-[#0d0a0b] aspect-square sm:aspect-[4/3] grid place-items-center"
        style={{['--qv-scan-h' as string]: '280px'}}>
        <video ref={videoRef} className={`absolute inset-0 size-full object-cover ${running ? '' : 'opacity-0'}`} playsInline muted aria-label={t('scan.camera')} />
        {running ? (
          <div className="qv-scanner-frame" aria-hidden />
        ) : (
          <div className="relative flex flex-col items-center gap-3 p-6 text-center text-white/80">
            <Camera size={40} aria-hidden />
            {error && <p className="text-sm max-w-xs text-white">{t(error)}</p>}
            <Button label={t('scan.start')} variant="primary" icon={<Camera size={16} />} isLoading={state === 'starting'} onClick={() => void start()} />
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
