# schemas.py
from pydantic import BaseModel
from typing import Optional, List

#
# ITEM
#
class ItemBase(BaseModel):
    name: str
    type: str         # "product_zone" / "entrance" / "checkout"
    x: float
    y: float
    z: Optional[float] = None
    image_url: Optional[str] = None
    note: Optional[str] = None
    price: Optional[float] = None          # new
    sale_percent: Optional[int] = None     # new
    description: Optional[str] = None 

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
