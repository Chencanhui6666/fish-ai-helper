from fastapi import FastAPI
from app.api.chat import chatRouter
from app.api.images import imageRouter
# from fastapi.middleware.httpsredirect import HTTPSRedirectMiddleware

app = FastAPI(title="Fish AI Helper", version="1.0.0")

# 将请求重定向到https的中间件
# app.add_middleware(HTTPSRedirectMiddleware)

app.include_router(chatRouter, prefix="/api")
app.include_router(imageRouter, prefix="/api")