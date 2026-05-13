from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import json
import random

app = FastAPI()


# Разрешаем frontend подключаться
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Проверка API
@app.get("/")
async def root():
    return {
        "message": "PingVision AI backend работает"
    }


# WebSocket endpoint
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):

    await websocket.accept()

    print("Client connected")

    try:

        while True:

            # Получаем данные от frontend
            data = await websocket.receive_text()

            print("Frame received")

            # Здесь потом будет YOLO/OpenCV

            # Временные координаты мяча
            result = {
                "x": random.randint(100, 500),
                "y": random.randint(100, 400),
                "speed": random.randint(20, 80),
                "confidence": round(random.uniform(0.8, 0.99), 2)
            }

            # Отправляем результат обратно
            await websocket.send_text(json.dumps(result))

    except Exception as e:
        print("Disconnected:", e)