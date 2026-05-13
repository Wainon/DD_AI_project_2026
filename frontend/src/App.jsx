import { useEffect, useRef, useState } from "react"
import "./App.css"

function App() {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const wsRef = useRef(null)
  const hiddenCanvasRef = useRef(document.createElement("canvas"))

  const [ball, setBall] = useState(null)
  const [trajectory, setTrajectory] = useState([])
  const [isRunning, setIsRunning] = useState(false)
  const [status, setStatus] = useState("Disconnected")
  const [videoSource, setVideoSource] = useState("webcam")
  const [error, setError] = useState("")

  useEffect(() => {
    connectWebSocket()

    return () => {
      stopStream()
      if (wsRef.current) {
        wsRef.current.close()
      }
    }
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      sendFrame()
    }, 100)

    return () => clearInterval(interval)
  }, [isRunning])

  useEffect(() => {
    drawOverlay()
  }, [ball, trajectory])

  const connectWebSocket = () => {
    const ws = new WebSocket("ws://localhost:8000/ws")

    ws.onopen = () => {
      console.log("WebSocket connected")
      setStatus("Connected")
    }

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data)

      setBall(data)

      setTrajectory((prev) => {
		const nextPoint = { x: data.x, y: data.y }

		const lastPoint = prev[prev.length - 1]

		// Убираем слишком резкие скачки, чтобы шлейф не превращался в "паутину"
		if (lastPoint) {
			const dx = nextPoint.x - lastPoint.x
			const dy = nextPoint.y - lastPoint.y
			const distance = Math.sqrt(dx * dx + dy * dy)

			if (distance > 180) {
			return [nextPoint]
			}
		}

		// Меньше точек = короче шлейф
		return [...prev.slice(-12), nextPoint]
		})
    }

    ws.onerror = (event) => {
      console.error("WebSocket error:", event)
      setStatus("WebSocket error")
    }

    ws.onclose = () => {
      console.log("WebSocket closed")
      setStatus("Disconnected")
    }

    wsRef.current = ws
  }

  const stopStream = () => {
    const video = videoRef.current

    if (video && video.srcObject) {
      const tracks = video.srcObject.getTracks()
      tracks.forEach((track) => track.stop())
      video.srcObject = null
    }
  }

  const startWebcam = async () => {
    try {
      setError("")
      stopStream()

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 800 },
          height: { ideal: 450 },
          frameRate: { ideal: 30 }
        },
        audio: false
      })

      videoRef.current.srcObject = stream
      await videoRef.current.play()

      setVideoSource("webcam")
      setTrajectory([])
      setBall(null)
    } catch (err) {
      console.error("Camera error:", err)

      setError(
        "Не удалось открыть камеру. Закрой Zoom/Discord/OBS/другой браузер или выбери Screen / Video file."
      )
    }
  }

  const startScreenCapture = async () => {
    try {
      setError("")
      stopStream()

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 800 },
          height: { ideal: 450 },
          frameRate: { ideal: 30 }
        },
        audio: false
      })

      videoRef.current.srcObject = stream
      await videoRef.current.play()

      setVideoSource("screen")
      setTrajectory([])
      setBall(null)
    } catch (err) {
      console.error("Screen capture error:", err)
      setError("Не удалось запустить захват экрана.")
    }
  }

  const handleVideoFile = async (event) => {
    try {
      setError("")
      stopStream()

      const file = event.target.files[0]
      if (!file) return

      const url = URL.createObjectURL(file)

      videoRef.current.srcObject = null
      videoRef.current.src = url
      videoRef.current.loop = true
      videoRef.current.muted = true

      await videoRef.current.play()

      setVideoSource("file")
      setTrajectory([])
      setBall(null)
    } catch (err) {
      console.error("Video file error:", err)
      setError("Не удалось открыть видеофайл.")
    }
  }

  const sendFrame = () => {
    if (!isRunning) return

    const video = videoRef.current
    const ws = wsRef.current

    if (!video || !ws || ws.readyState !== WebSocket.OPEN) {
      return
    }

    if (video.videoWidth === 0 || video.videoHeight === 0) {
      return
    }

    const hiddenCanvas = hiddenCanvasRef.current
    hiddenCanvas.width = video.videoWidth
    hiddenCanvas.height = video.videoHeight

    const ctx = hiddenCanvas.getContext("2d")
    ctx.drawImage(video, 0, 0, hiddenCanvas.width, hiddenCanvas.height)

    const frame = hiddenCanvas.toDataURL("image/jpeg", 0.6)

    ws.send(frame)
  }

  const drawOverlay = () => {
	const canvas = canvasRef.current
	if (!canvas) return

	const ctx = canvas.getContext("2d")
	ctx.clearRect(0, 0, canvas.width, canvas.height)

	if (trajectory.length < 2) {
		return
	}

	// Рисуем короткий градиентный шлейф без красной точки
	for (let i = 1; i < trajectory.length; i++) {
		const prev = trajectory[i - 1]
		const current = trajectory[i]

		const progress = i / trajectory.length

		// Чем ближе к текущей позиции, тем ярче
		const alpha = 0.15 + progress * 0.85
		const lineWidth = 2 + progress * 5

		const gradient = ctx.createLinearGradient(
		prev.x,
		prev.y,
		current.x,
		current.y
		)

		gradient.addColorStop(0, `rgba(0, 255, 120, ${alpha * 0.25})`)
		gradient.addColorStop(1, `rgba(0, 255, 40, ${alpha})`)

		ctx.beginPath()
		ctx.moveTo(prev.x, prev.y)
		ctx.lineTo(current.x, current.y)
		ctx.strokeStyle = gradient
		ctx.lineWidth = lineWidth
		ctx.lineCap = "round"
		ctx.lineJoin = "round"
		ctx.stroke()
	}

	// Небольшое свечение в конце шлейфа, но без красной точки
	const last = trajectory[trajectory.length - 1]

	const glow = ctx.createRadialGradient(
		last.x,
		last.y,
		0,
		last.x,
		last.y,
		18
	)

	glow.addColorStop(0, "rgba(0, 255, 80, 0.75)")
	glow.addColorStop(1, "rgba(0, 255, 80, 0)")

	ctx.beginPath()
	ctx.arc(last.x, last.y, 18, 0, Math.PI * 2)
	ctx.fillStyle = glow
	ctx.fill()
	}

  return (
    <div className="app">
      <h1>PingVision AI</h1>

      <div className="content">
        <div>
          <div className="video-wrapper">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              controls={videoSource === "file"}
              width="800"
              height="450"
            />

            <canvas
              ref={canvasRef}
              width="800"
              height="450"
              className="overlay"
            />
          </div>

          {error && (
            <div className="error">
              {error}
            </div>
          )}
        </div>

        <div className="panel">
          <h2>Источник</h2>

          <button onClick={startWebcam}>
            Веб-камера
          </button>

          <button onClick={startScreenCapture}>
            Захват экрана
          </button>

          <label className="file-button">
            Видео файл
            <input
              type="file"
              accept="video/*"
              onChange={handleVideoFile}
            />
          </label>

          <h2>Детекция</h2>

          <button onClick={() => setIsRunning(true)}>
            Начать детекцию
          </button>

          <button onClick={() => setIsRunning(false)}>
            Остановить детекцию
          </button>

          <h2>Статистика</h2>

          <p>Статус: {status}</p>
          <p>Источник: {videoSource}</p>
          <p>Скорость: {ball?.speed ?? 0} km/h</p>
          <p>Уверенность: {ball?.confidence ?? 0}</p>
          <p>X: {ball?.x ?? "-"}</p>
          <p>Y: {ball?.y ?? "-"}</p>
        </div>
      </div>
    </div>
  )
}

export default App