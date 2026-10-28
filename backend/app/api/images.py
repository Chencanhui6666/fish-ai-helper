from fastapi import APIRouter, UploadFile, HTTPException, Request
from fastapi.responses import FileResponse
from uuid import UUID
from pathlib import Path
from ..services.handle_image import insert_image
from starlette.concurrency import run_in_threadpool
from ..db.postgreSql import ImageTable
from ..utils.debug import print_object

imageRouter = APIRouter()

@imageRouter.post('/images')
async def upload_images(request: Request, file: UploadFile):
  message = "upload success"
  code = 0
  image_id = ""
  preview_url = ""

  try:
    image_id =  await insert_image(file)
    preview_url = str(
       request.url_for(
          "preview_image",
          image_id=str(image_id),
       )
    )
  except:
    code = -1
    message = "上传失败请重试"
    image_id = ""
    raise HTTPException(421)

  return {
    "code": code,
    "message": message,
    "data": {
      "image_id": image_id,
      "preview_url": preview_url
    }
  }

@imageRouter.get("/images/{image_id}", name="preview_image")
async def preview_image(image_id: UUID):
    imageTable = ImageTable()
    # 根据 ID 查询图片记录
    image = await run_in_threadpool(
        imageTable.get_by_id,
        image_id,
    )

    if image is None:
        raise HTTPException(404, "图片记录不存在")

    UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads" / "images"
    # 根据存储标识找到实际文件
    file_path = UPLOAD_DIR / image.storage_key

    if not await run_in_threadpool(file_path.is_file):
        raise HTTPException(404, "图片文件不存在")

    return FileResponse(
        path=file_path,
        media_type=image.content_type,
    )