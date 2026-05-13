from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware

import json
import base64
import cv2
import numpy as np
import random

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):

    await websocket.accept()

    print("Client connected", flush=True)

    try:

        while True:

            data_url = await websocket.receive_text()
            if "," in data_url:
                base64_str = data_url.split(",")[1]
            else:
                base64_str = data_url

            image_bytes = base64.b64decode(base64_str)

            nparr = np.frombuffer(image_bytes, np.uint8)

            frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

            if frame is None:
                print("Frame decode failed")
                continue

            print("Frame:", frame.shape, flush=True)

            result = {
                "x": random.randint(0,1),
                "y": random.randint(100, 400),
                "speed": random.randint(20, 80),
                "confidence": round(random.uniform(0.8, 0.99), 2)
            }

            await websocket.send_text(json.dumps(result)) 

    except Exception as e:
        print("Disconnected:", e)