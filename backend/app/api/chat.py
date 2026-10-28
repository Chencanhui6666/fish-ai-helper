from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from ..agent.agent import chat_events

chatRouter = APIRouter()

@chatRouter.get("/")
async def read_root():
    return {"Hello": "World"}

@chatRouter.websocket("/ws/chat")
async def chat(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
          request = await websocket.receive_json()
          print(f"Received message: {request}")
          print("-------------------------")
          # 在这里将消息发送给agent，并获取响应
          async for event in chat_events(request["message"]):
              await websocket.send_json(event)
                   
    except WebSocketDisconnect as e:
        print(f"WebSocket connection closed: {e}")
