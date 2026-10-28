from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    Text,
    Uuid,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


# 所有数据库模型的公共基类
class Base(DeclarativeBase):
    pass


class Image(Base):
  # 对应数据库表名
  __tablename__ = "images"

  __table_args__ = (
      CheckConstraint("size_bytes > 0"),
      {"schema": "public"},
  )

  id: Mapped[UUID] = mapped_column(
      Uuid,
      primary_key=True,
      default=uuid4,
  )

  original_name: Mapped[str] = mapped_column(
      Text,
      nullable=False,
  )

  storage_key: Mapped[str] = mapped_column(
      Text,
      nullable=False,
      unique=True,
  )

  content_type: Mapped[str] = mapped_column(
      Text,
      nullable=False,
  )

  size_bytes: Mapped[int] = mapped_column(
      BigInteger,
      nullable=False,
  )

  created_at: Mapped[datetime] = mapped_column(
      DateTime(timezone=True),
      nullable=False,
      server_default=func.now(),
  )