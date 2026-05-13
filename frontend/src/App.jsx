import { useEffect, useRef } from "react"

function App() {

	const videoRef = useRef(null)

	useEffect(() => {

		// Подключение к backend
		const ws = new WebSocket("ws://localhost:8000/ws")

		ws.onopen = () => {
			console.log("WebSocket connected")
			ws.send('1');
		}

		ws.onmessage = (event) => {

			const data = JSON.parse(event.data)

			console.log("Ball coordinates:", data)

		}

		// Получаем камеру
		navigator.mediaDevices.getUserMedia({
			video: true
		})
			.then((stream) => {
				videoRef.current.srcObject = stream
			})

		return () => {
			ws.close()
		}

	}, [])

	return (
		<div>

			<h1>PingVision AI</h1>

			<video
				ref={videoRef}
				autoPlay
				playsInline
				width="800"
			/>

		</div>
	)
}

export default App