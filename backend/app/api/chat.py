from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from ..agent.agent import chat_events
from ..services.handle_image import read_image

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
          image_ids = request['image_ids']
          images = []

          if len(image_ids) > 0:
            # 数据库查询图片
            for img_id in image_ids:
                img_obj = await read_image(img_id)
                if not img_obj:
                    raise ValueError(f"图片读取失败：{ img_id }")
                images.append(img_obj) 

          # 在这里将消息发送给agent，并获取响应
          async for event in chat_events(request["message"], images):
              await websocket.send_json(event)
                   
    except WebSocketDisconnect as e:
        print(f"WebSocket connection closed: {e}")
