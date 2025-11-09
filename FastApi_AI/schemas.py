# schemas.py
from pydantic import BaseModel, Field
try:
    # Pydantic v2
    from pydantic.alias_generators import to_camel
    from pydantic import AliasChoices, ConfigDict
    HAS_V2 = True
except Exception:
    HAS_V2 = False
from typing import Optional, List
from datetime import datetime

#
# ITEM
#
class ItemBase(BaseModel):
    if HAS_V2:
        model_config = ConfigDict(extra='ignore')
    mart_id: int
    name: str
    type: str         # "product_zone" / "entrance" / "checkout"
    x: float
    y: float
    z: Optional[float] = None
    image_url: Optional[str] = None
    note: Optional[str] = None
    price: Optional[float] = None          # new
    sale_percent: Optional[int] = None     # new
    sale_end_at: Optional[datetime] = None # new: sale дуусах хугацаа
    description: Optional[str] = None 
    # Accept heading_deg or heading or headingDeg from clients
    if HAS_V2:
        heading_deg: Optional[float] = Field(default=None, validation_alias=AliasChoices('heading_deg','heading','headingDeg'))
    else:
        heading_deg: Optional[float] = None
    heading_deg: Optional[float] = None    # new: for SLAM start type

class ItemCreate(ItemBase):
    pass

class ItemRead(ItemBase):
    id: int
    class Config:
        from_attributes = True  # Pydantic v2 style (for SQLAlchemy models)

#
# PATH
#
class PathBase(BaseModel):
    from_item_id: int
    to_item_id: int
    distance: float

class PathCreate(PathBase):
    pass

class PathRead(PathBase):
    id: int
    class Config:
        from_attributes = True

#
# ROUTE REQUEST / RESPONSE
#
class RouteRequest(BaseModel):
    from_item_id: int
    to_item_id: int

class RoutePoint(BaseModel):
    x: float
    y: float

class RouteResponse(BaseModel):
    polyline: List[RoutePoint]
    nodes: List[int]  # дамжсан item-үүдийн id жагсаалт



from typing import List

class Point(BaseModel):
    x: float
    y: float

class SegmentCreate(BaseModel):
    from_item_id: int
    to_item_id: int
    polyline: List[Point]

class SegmentFreeCreate(BaseModel):
    polyline: List[Point]

class SegmentRead(BaseModel):
    id: int
    from_item_id: Optional[int] = None
    to_item_id: Optional[int] = None
    polyline: List[Point]
    class Config:
        from_attributes = True

#
# Route by coordinates (free start/end)
#
class RouteByCoordsRequest(BaseModel):
    start: Point
    end: Point
    # optional: choose shortest-path algorithm: 'dijkstra' | 'astar'
    algorithm: Optional[str] = None

class RoutePolylineResponse(BaseModel):
    polyline: List[RoutePoint]


#
# CHATBOT
#
class DevicePoint(BaseModel):
    x: Optional[float] = None
    y: Optional[float] = None
    z: Optional[float] = None

class ChatbotRequest(BaseModel):
    text: str
    device: Optional[DevicePoint] = None

class ChatbotResponse(BaseModel):
    intent: str
    item_ids: List[int]
    reply: str


#
# Multi-stop plan
#
class RoutePlanRequest(BaseModel):
    start: Optional[RoutePoint] = None
    item_ids: List[int]

class RoutePlanResponse(BaseModel):
    ordered_ids: List[int]
    polyline: List[RoutePoint]
#
# SLAM START (separate minimal schema)
#
class SlamStartCreate(BaseModel):
    x: float
    y: float
    z: Optional[float] = None
    # Accept heading variants too
    if HAS_V2:
        heading_deg: Optional[float] = Field(default=None, validation_alias=AliasChoices('heading_deg','heading','headingDeg'))
    else:
        heading_deg: Optional[float] = None

class SlamStartRead(BaseModel):
    id: int
    x: float
    y: float
    z: Optional[float] = None
    heading_deg: Optional[float] = None
    class Config:
        from_attributes = True


#
# MART
#
class MartBase(BaseModel):
    name: str
    # Accept longitude/latitude aliases but store as coord_x/coord_y
    if HAS_V2:
        coord_x: Optional[float] = Field(default=None, validation_alias=AliasChoices('coord_x','longitude','lon'))
        coord_y: Optional[float] = Field(default=None, validation_alias=AliasChoices('coord_y','latitude','lat'))
    else:
        coord_x: Optional[float] = None
        coord_y: Optional[float] = None
    map_width_px: Optional[int] = None
    map_height_px: Optional[int] = None
    map_image_url: Optional[str] = None

class MartCreate(MartBase):
    pass

class MartRead(MartBase):
    id: int
    class Config:
        from_attributes = True

#
# LISTS (stores item IDs)
#
class ItemListBase(BaseModel):
    name: Optional[str] = None
    item_ids: List[int]

class ItemListCreate(ItemListBase):
    pass

class ItemListRead(ItemListBase):
    id: int
    class Config:
        from_attributes = True
