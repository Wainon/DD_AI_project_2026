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

      setTrajectory((prev) => [
        ...prev.slice(-40),
        { x: data.x, y: data.y }
      ])
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

    if (trajectory.length > 1) {
      ctx.beginPath()

      trajectory.forEach((point, index) => {
        if (index === 0) {
          ctx.moveTo(point.x, point.y)
        } else {
          ctx.lineTo(point.x, point.y)
        }
      })

      ctx.strokeStyle = "lime"
      ctx.lineWidth = 3
      ctx.stroke()
    }

    if (ball) {
      ctx.beginPath()
      ctx.arc(ball.x, ball.y, 10, 0, Math.PI * 2)
      ctx.fillStyle = "red"
      ctx.fill()
    }
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
          <h2>Source</h2>

          <button onClick={startWebcam}>
            Webcam
          </button>

          <button onClick={startScreenCapture}>
            Screen / Window
          </button>

          <label className="file-button">
            Video file
            <input
              type="file"
              accept="video/*"
              onChange={handleVideoFile}
            />
          </label>

          <h2>Detection</h2>

          <button onClick={() => setIsRunning(true)}>
            Start detection
          </button>

          <button onClick={() => setIsRunning(false)}>
            Stop detection
          </button>

          <h2>Statistics</h2>

          <p>Status: {status}</p>
          <p>Source: {videoSource}</p>
          <p>Speed: {ball?.speed ?? 0} km/h</p>
          <p>Confidence: {ball?.confidence ?? 0}</p>
          <p>X: {ball?.x ?? "-"}</p>
          <p>Y: {ball?.y ?? "-"}</p>
        </div>
      </div>
    </div>
  )
}

export default App