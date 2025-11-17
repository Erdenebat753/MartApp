# models.py
from sqlalchemy import Column, Integer, String, DECIMAL, Text, ForeignKey, TIMESTAMP, func, LargeBinary
from sqlalchemy.orm import relationship
from database import Base

class Item(Base):
    __tablename__ = "items"

    id = Column(Integer, primary_key=True, autoincrement=True)
    mart_id = Column(Integer, ForeignKey("marts.id", ondelete="CASCADE", onupdate="CASCADE"), nullable=False)

    # үндсэн мэдээлэл
    name = Column(String(100), nullable=False)          # "Coffee Section" эсвэл "Nescafe Gold 200g"
    type = Column(String(50),  nullable=False)          # "product_zone", "product", "entrance", "checkout"

    # дэлгүүрийн зураг дээрх байрлал
    x = Column(DECIMAL(10,4), nullable=False)           # pixel X in map coords
    y = Column(DECIMAL(10,4), nullable=False)           # pixel Y in map coords
    z = Column(DECIMAL(10,4), nullable=True)            # optional floor/height (future use)

    image_url = Column(Text, nullable=True)             # thumbnail / shelf photo
    note = Column(Text, nullable=True)                  # дотоод тэмдэглэл (админы хувьд)
    # optional category reference
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True)

    # ⇩ шинэ талбарууд
    price = Column(DECIMAL(10,2), nullable=True)        # 12900.00 ₩ гэх мэт
    sale_percent = Column(Integer, nullable=True)       # 30 гэж хадгалаад "30%" гэж үзэж болно
    # Sale дуусах хугацаа; хугацаа дууссан бол API талд sale_percent-ийг null болгоно
    from sqlalchemy import TIMESTAMP as _TS
    sale_end_at = Column(_TS, nullable=True)
    description = Column(Text, nullable=True)           # "Rich aroma instant coffee ..."
    heading_deg = Column(DECIMAL(10,4), nullable=True)  # optional: SLAM start heading in degrees

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
    mart = relationship("Mart")


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


class Mart(Base):
    __tablename__ = "marts"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(120), nullable=False)

    # Store entrance or reference coordinate on the map (in map pixels)
    coord_x = Column(DECIMAL(10,4), nullable=True)
    coord_y = Column(DECIMAL(10,4), nullable=True)

    # Intrinsic map image size in pixels
    map_width_px = Column(Integer, nullable=True)
    map_height_px = Column(Integer, nullable=True)

    # Public URL to map image served from /uploads
    map_image_url = Column(Text, nullable=True)

    created_at = Column(
        TIMESTAMP,
        server_default=func.current_timestamp()
    )
    updated_at = Column(
        TIMESTAMP,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp()
    )
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


class SlamStart(Base):
    __tablename__ = "slam_start"

    id = Column(Integer, primary_key=True, autoincrement=True)
    x = Column(DECIMAL(10,4), nullable=False)
    y = Column(DECIMAL(10,4), nullable=False)
    z = Column(DECIMAL(10,4), nullable=True)
    heading_deg = Column(DECIMAL(10,4), nullable=True)

    created_at = Column(
        TIMESTAMP,
        server_default=func.current_timestamp()
    )
    updated_at = Column(
        TIMESTAMP,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp()
    )
    updated_at = Column(
        TIMESTAMP,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp()
    )

class ItemList(Base):
    __tablename__ = "lists"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(120), nullable=True)
    # Store item ids as JSON array for simplicity
    item_ids_json = Column(Text, nullable=False, default="[]")

    created_at = Column(
        TIMESTAMP,
        server_default=func.current_timestamp()
    )
    updated_at = Column(
        TIMESTAMP,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp()
    )


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, autoincrement=True)
    mart_id = Column(Integer, ForeignKey("marts.id", ondelete="CASCADE", onupdate="CASCADE"), nullable=False)
    name = Column(String(120), nullable=False)
    # store polygon as JSON array of points [{x,y},...], closed (first=last)
    polygon_json = Column(Text, nullable=False)
    color = Column(String(24), nullable=True)

    created_at = Column(
        TIMESTAMP,
        server_default=func.current_timestamp()
    )
    updated_at = Column(
        TIMESTAMP,
        server_default=func.current_timestamp(),
        onupdate=func.current_timestamp()
    )


class StoredFile(Base):
    __tablename__ = "stored_files"

    id = Column(Integer, primary_key=True, autoincrement=True)
    slug = Column(String(255), unique=True, nullable=False)
    scope = Column(String(64), nullable=True)
    original_name = Column(String(255), nullable=True)
    content_type = Column(String(128), nullable=True)
    size_bytes = Column(Integer, nullable=False)
    data = Column(LargeBinary, nullable=True)  # legacy storage (now unused)
    url = Column(Text, nullable=True)
    cloudinary_public_id = Column(String(255), nullable=True)
    created_at = Column(
        TIMESTAMP,
        server_default=func.current_timestamp()
    )
