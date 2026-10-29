from fastapi import APIRouter, UploadFile, HTTPException
from uuid import uuid4
from pathlib import Path
from ..db.table.Image import Image
from ..db.postgreSql import ImageTable
import base64

MAX_SIZE = 1024 * 1024 * 10

ALLOW_IMG_TYPES = ['image/png', 'image/jpg', 'image/jpeg', 'image/webp']

UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads" / "images"

async def insert_image(file: UploadFile):
  try:
    if file.content_type not in ALLOW_IMG_TYPES:
      raise HTTPException(415, "暂不支持该文件类型")
    
    if file.size > MAX_SIZE or file.size < 1:
      raise HTTPException(416, "文件大小不符合预期")
    
    extension = file.content_type.split("/")[1]
    content = await file.read()
    storage_key = f"{uuid4()}.{extension}"
    file_path = UPLOAD_DIR / storage_key
    
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

    try:
      file_path.write_bytes(content)

      imageData = Image(
        original_name=file.filename or storage_key,
        storage_key=storage_key,
        content_type = file.content_type,
        size_bytes=len(content)
      )

      imageObj = ImageTable()
      
      return imageObj.insert(imageData)
    except Exception:
      file_path.unlink(missing_ok=True)
      raise
  finally:
    await file.close()

async def read_image(img_id: str):
  try:
    img_table = ImageTable()
    img = img_table.get_by_id(img_id)

    if not img:
      raise Exception("该图片不存在")
    
    file_path = UPLOAD_DIR / img.storage_key
    content = file_path.read_bytes()

    if not content:
      raise Exception("该图片不存在")
    
    encoded = base64.b64encode(content)
    # 将bytes转为字符串，方便放入json
    base64_text = encoded.decode("ascii")

    return {
      "type": "image",
      "base64": base64_text,
      "mime_type": img.content_type
    }
  except Exception:
    print("该图片不存在")


