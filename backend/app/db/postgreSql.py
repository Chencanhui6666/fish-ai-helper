import os
import psycopg
from pathlib import Path
from psycopg.rows import dict_row
from dotenv import load_dotenv
from sqlalchemy import create_engine, select, URL
from sqlalchemy.orm import Session
from uuid import UUID
from .table.Image import Image

env_path = Path(__file__).resolve().parents[2] / ".env.dev"
load_dotenv(env_path)

# database_url = os.getenv("DATABASE_URL")

# if not database_url:
#   raise RuntimeError('请配置DATABASE_URL')

# 建立数据库连接-简约写法
# with psycopg.connect(database_url, row_factory=dict_row) as conn:
#   with conn.cursor() as cursor:
#     cursor.execute("SELECT * FROM public.images LIMIT 10")
#     images = cursor.fetchall()
#     print('images------------>')
#     print(images)

# 建立数据库连接-简约写法
# conn = psycopg.connect(
#   host="localhost",
#   port=5432,
#   dbname="fish_ai",
#   user="postgres",
#   password=password,
#   row_factory=dict_row
# )

# try:
#   with conn.cursor() as cursor:
#     cursor.execute("SELECT * FROM public.images LIMIT 10")
#     images = cursor.fetchall()
#     print('images------------>')
#     print(images)

#     conn.commit()
# except:
#   conn.rollback() # 出错时回滚
#   raise # 将异常继续抛出
# finally:
#   conn.close() # 关闭连接



class ImageTable:
  def __init__(self):
    password = os.getenv("DATABASE_PASSWORD")
    if not password:
      raise RuntimeError("请配置 DATABASE_PASSWORD")

    database_url = URL.create(
      drivername="postgresql+psycopg",
      username="postgres",
      password=password,
      host="localhost",
      port=5432,
      database="fish_ai",
    )
    engine = create_engine(database_url)
    self.engine = engine

  def insert(self, value: Image) -> UUID:
    """ 插入一个image对象，并返回uuid """
    with Session(self.engine) as session:
      image = Image(
        original_name = value.original_name,
        storage_key = value.storage_key,
        content_type = value.content_type,
        size_bytes = value.size_bytes
      )
      session.add(image)
      session.commit()
      session.refresh(image)

      return image.id

  def get_by_id(self, image_id: UUID) -> Image | None:
    """根据主键查询；不存在时返回 None。返回对象的普通字段可直接读取。"""
    with Session(self.engine) as session:
      return session.get(Image, image_id)

  def list_images(self, limit: int = 20, offset: int = 0) -> list[Image]:
    """分页查询图片，按创建时间倒序排列。"""
    if limit < 1 or limit > 100:
      raise ValueError("limit 必须在 1 到 100 之间")
    if offset < 0:
      raise ValueError("offset 不能小于 0")

    with Session(self.engine) as session:
      statement = (
        select(Image)
        .order_by(Image.created_at.desc(), Image.id.desc())
        .limit(limit)
        .offset(offset)
      )
      return list(session.scalars(statement).all())

  def update(self, value: Image) -> bool:
    """根据 value.id 更新全部可编辑字段；不存在时返回 False。"""
    if value.id is None:
      raise ValueError("更新图片必须提供 id")

    with Session(self.engine) as session:
      image = session.get(Image, value.id)
      if image is None:
        return False

      image.original_name = value.original_name
      image.storage_key = value.storage_key
      image.content_type = value.content_type
      image.size_bytes = value.size_bytes
      session.commit()
      return True

  def delete(self, image_id: UUID) -> bool:
    """删除数据库记录；不存在时返回 False。不会删除磁盘上的图片文件。"""
    with Session(self.engine) as session:
      image = session.get(Image, image_id)
      if image is None:
        return False

      session.delete(image)
      session.commit()
      return True
