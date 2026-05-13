import { useEffect, useRef } from "react"

function App() {

	const videoRef = useRef(null)

	useEffect(() => {

		navigator.mediaDevices.getUserMedia({
			video: true
		})
			.then((stream) => {
				videoRef.current.srcObject = stream
			})

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