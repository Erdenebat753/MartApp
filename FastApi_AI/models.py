# models.py
from sqlalchemy import Column, Integer, String, DECIMAL, Text, ForeignKey, TIMESTAMP, func
from sqlalchemy.orm import relationship
from database import Base

class Item(Base):
    __tablename__ = "items"

    id = Column(Integer, primary_key=True, autoincrement=True)

    # үндсэн мэдээлэл
    name = Column(String(100), nullable=False)          # "Coffee Section" эсвэл "Nescafe Gold 200g"
    type = Column(String(50),  nullable=False)          # "product_zone", "product", "entrance", "checkout"

    # дэлгүүрийн зураг дээрх байрлал
    x = Column(DECIMAL(10,4), nullable=False)           # pixel X in map coords
    y = Column(DECIMAL(10,4), nullable=False)           # pixel Y in map coords
    z = Column(DECIMAL(10,4), nullable=True)            # optional floor/height (future use)

    image_url = Column(Text, nullable=True)             # thumbnail / shelf photo
    note = Column(Text, nullable=True)                  # дотоод тэмдэглэл (админы хувьд)

    # ⇩ шинэ талбарууд
    price = Column(DECIMAL(10,2), nullable=True)        # 12900.00 ₩ гэх мэт
    sale_percent = Column(Integer, nullable=True)       # 30 гэж хадгалаад "30%" гэж үзэж болно
    description = Column(Text, nullable=True)           # "Rich aroma instant coffee ..."

    created_at = Column(
        TIMESTAMP,
        server_default=func.current_timestamp()
    )
    updated_at = Column(
        TIMESTAMP,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp()
    )

    # relationships (замын графын холбоос)
    from_paths = relationship("Path", foreign_keys="Path.from_item_id", back_populates="from_item")
    to_paths   = relationship("Path", foreign_keys="Path.to_item_id", back_populates="to_item")


class Path(Base):
    __tablename__ = "paths"

    id = Column(Integer, primary_key=True, autoincrement=True)

    from_item_id = Column(Integer, ForeignKey("items.id", ondelete="CASCADE", onupdate="CASCADE"), nullable=False)
    to_item_id   = Column(Integer, ForeignKey("items.id", ondelete="CASCADE", onupdate="CASCADE"), nullable=False)

    distance = Column(DECIMAL(10,4), nullable=False)    # pixel distance эсвэл метр equivalent

    created_at = Column(
        TIMESTAMP,
        server_default=func.current_timestamp()
    )
    updated_at = Column(
        TIMESTAMP,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp()
    )

    from_item = relationship("Item", foreign_keys=[from_item_id], back_populates="from_paths")
    to_item   = relationship("Item", foreign_keys=[to_item_id],   back_populates="to_paths")
class Segment(Base):
    __tablename__ = "segments"

    id = Column(Integer, primary_key=True, autoincrement=True)

    from_item_id = Column(Integer, ForeignKey("items.id", ondelete="SET NULL"), nullable=True)
    to_item_id   = Column(Integer, ForeignKey("items.id", ondelete="SET NULL"), nullable=True)

    polyline_json = Column(Text, nullable=False)  # store raw JSON string
    walkable = Column(Integer, nullable=False, default=1)

    created_at = Column(
        TIMESTAMP,
        server_default=func.current_timestamp()
    )
    updated_at = Column(
        TIMESTAMP,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp()
    )
