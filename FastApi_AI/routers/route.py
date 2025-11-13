# routers/route.py
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import List, Dict, Tuple, Optional
import heapq, math, json

from database import get_db
from models import Item, Segment
from schemas import (
    RouteRequest,
    RouteResponse,
    RoutePoint,
    RouteByCoordsRequest,
    RoutePolylineResponse,
    RoutePlanRequest,
    RoutePlanResponse,
)

router = APIRouter(prefix="/api/route", tags=["route"])

@router.post("", response_model=RouteResponse)
async def get_route(req: RouteRequest, db: AsyncSession = Depends(get_db)):
    # 1. from item
    res_from = await db.execute(select(Item).where(Item.id == req.from_item_id))
    from_item = res_from.scalars().first()

    # 2. to item
    res_to = await db.execute(select(Item).where(Item.id == req.to_item_id))
    to_item = res_to.scalars().first()

    if not from_item or not to_item:
        raise HTTPException(status_code=404, detail="Item not found")

    # NOTE:
    # Одоо бол mock polyline. Дараа нь paths граф-аас shortest path гаргана.
    mid_x = (float(from_item.x) + float(to_item.x)) / 2.0
    mid_y = (float(from_item.y) + float(to_item.y)) / 2.0

    polyline = [
        RoutePoint(x=float(from_item.x), y=float(from_item.y)),
        RoutePoint(x=mid_x,             y=mid_y),
        RoutePoint(x=float(to_item.x),  y=float(to_item.y)),
    ]

    nodes = [req.from_item_id, req.to_item_id]

    return RouteResponse(polyline=polyline, nodes=nodes)


def _qkey(x: float, y: float, prec: int = 4) -> str:
    return f"{round(x, prec):.{prec}f},{round(y, prec):.{prec}f}"

def _dist(a: Tuple[float, float], b: Tuple[float, float]) -> float:
    dx = a[0] - b[0]
    dy = a[1] - b[1]
    return math.hypot(dx, dy)

def _project_point_to_segment(p: Tuple[float, float], a: Tuple[float, float], b: Tuple[float, float]) -> Tuple[Tuple[float, float], float]:
    ax, ay = a; bx, by = b; px, py = p
    abx, aby = (bx - ax), (by - ay)
    ab2 = abx*abx + aby*aby
    if ab2 == 0:
        return a, 0.0
    apx, apy = (px - ax), (py - ay)
    t = (apx*abx + apy*aby) / ab2
    t_clamped = max(0.0, min(1.0, t))
    qx = ax + t_clamped * abx
    qy = ay + t_clamped * aby
    return (qx, qy), t_clamped

def _seg_intersection(p: Tuple[float,float], p2: Tuple[float,float], q: Tuple[float,float], q2: Tuple[float,float]) -> Optional[Tuple[Tuple[float,float], float, float]]:
    EPS = 1e-9
    def sub2(a,b): return (a[0]-b[0], a[1]-b[1])
    def cross(a,b): return a[0]*b[1] - a[1]*b[0]
    def add2(a,b): return (a[0]+b[0], a[1]+b[1])
    def mul2(a,s): return (a[0]*s, a[1]*s)
    r = sub2(p2, p)
    s = sub2(q2, q)
    rxs = cross(r, s)
    qp = sub2(q, p)
    if abs(rxs) < EPS:
        return None
    t = (qp[0]*s[1] - qp[1]*s[0]) / rxs
    u = (qp[0]*r[1] - qp[1]*r[0]) / rxs
    if -EPS <= t <= 1+EPS and -EPS <= u <= 1+EPS:
        inter = add2(p, mul2(r, max(0.0, min(1.0, t))))
        return inter, t, u
    return None

def _build_graph(polylines: List[List[Tuple[float,float]]]):
    coords_by_key: Dict[str, Tuple[float, float]] = {}
    graph: Dict[str, Dict[str, float]] = {}
    def ensure_node(pt: Tuple[float,float]) -> str:
        k = _qkey(pt[0], pt[1])
        if k not in coords_by_key:
            coords_by_key[k] = pt
            graph.setdefault(k, {})
        return k
    def add_edge(ka, kb, w):
        if ka == kb:
            return
        graph.setdefault(ka, {})
        graph.setdefault(kb, {})
        graph[ka][kb] = min(graph[ka].get(kb, float('inf')), w)
        graph[kb][ka] = min(graph[kb].get(ka, float('inf')), w)

    # edges
    edges = []
    for pi, pl in enumerate(polylines):
        for si in range(len(pl)-1):
            edges.append((pi, si, pl[si], pl[si+1]))
    # intersections
    splits: Dict[Tuple[int,int], List[float]] = {}
    for i in range(len(edges)):
        pi, si, a1, b1 = edges[i]
        for j in range(i+1, len(edges)):
            pj, sj, a2, b2 = edges[j]
            inter = _seg_intersection(a1, b1, a2, b2)
            if inter is None:
                continue
            _, t1, t2 = inter
            EPS = 1e-9
            if EPS < t1 < 1.0-EPS:
                splits.setdefault((pi, si), []).append(float(t1))
            if EPS < t2 < 1.0-EPS:
                splits.setdefault((pj, sj), []).append(float(t2))
    # subdivide
    for (pi, si, a, b) in edges:
        r = (b[0]-a[0], b[1]-a[1])
        ts = [0.0, 1.0]
        if (pi, si) in splits:
            ts.extend(splits[(pi, si)])
        ts = sorted(set(max(0.0, min(1.0, t)) for t in ts))
        prev = (a[0] + r[0]*ts[0], a[1] + r[1]*ts[0])
        for k in range(1, len(ts)):
            cur = (a[0] + r[0]*ts[k], a[1] + r[1]*ts[k])
            ka = ensure_node(prev)
            kb = ensure_node(cur)
            add_edge(ka, kb, _dist(prev, cur))
            prev = cur
    return graph, coords_by_key

def _connect_nearby_nodes(graph: Dict[str, Dict[str, float]], coords_by_key: Dict[str, Tuple[float,float]], eps: float = 6.0):
    """
    Heuristic: endpoints that are extremely close (within eps pixels) should be
    considered connected. This helps when drawn segments didn't snap perfectly.
    """
    keys = list(coords_by_key.keys())
    for i in range(len(keys)):
        ki = keys[i]
        xi, yi = coords_by_key[ki]
        for j in range(i+1, len(keys)):
            kj = keys[j]
            xj, yj = coords_by_key[kj]
            d = math.hypot(xi - xj, yi - yj)
            if d <= eps:
                graph.setdefault(ki, {})
                graph.setdefault(kj, {})
                w = max(d, 1e-6)
                # undirected minimal weight
                graph[ki][kj] = min(graph[ki].get(kj, float('inf')), w)
                graph[kj][ki] = min(graph[kj].get(ki, float('inf')), w)

def _shortest_polyline_between(start: Tuple[float,float], end: Tuple[float,float], graph, coords_by_key, polylines, algorithm: str = "dijkstra"):
    # snap endpoints
    def best_projection(p):
        best=None; best_d=float('inf')
        for pl in polylines:
            for i in range(len(pl)-1):
                a=pl[i]; b=pl[i+1]
                q,_=_project_point_to_segment(p,a,b)
                d=_dist(p,q)
                if d<best_d:
                    best_d=d; best=(a,b,q)
        return best
    s_proj = best_projection(start)
    e_proj = best_projection(end)
    if not s_proj or not e_proj:
        return [start, end]
    (sa, sb, sq) = s_proj
    (ea, eb, eq) = e_proj
    S = "__S__"; E = "__E__"
    graph.setdefault(S, {})
    graph.setdefault(E, {})
    def ensure_node(pt):
        k = _qkey(pt[0], pt[1])
        coords_by_key.setdefault(k, pt)
        graph.setdefault(k, {})
        return k
    sa_k = ensure_node(sa); sb_k=ensure_node(sb); ea_k=ensure_node(ea); eb_k=ensure_node(eb)
    # Insert projection nodes on the segments themselves to avoid long detours to endpoints
    sq_k = ensure_node(sq)
    eq_k = ensure_node(eq)
    def add_edge(ka,kb,w):
        graph.setdefault(ka,{}); graph.setdefault(kb,{})
        graph[ka][kb]=min(graph[ka].get(kb,float('inf')),w)
        graph[kb][ka]=min(graph[kb].get(ka,float('inf')),w)
    # Connect projection nodes along their segments (split edges)
    add_edge(sa_k, sq_k, _dist(sa, sq))
    add_edge(sq_k, sb_k, _dist(sq, sb))
    add_edge(ea_k, eq_k, _dist(ea, eq))
    add_edge(eq_k, eb_k, _dist(eq, eb))

    # Additionally, connect projection nodes to any existing graph vertices that lie
    # on the same geometric segment, so the path can enter/exit mid-segment without
    # detouring to endpoints.
    def _connect_proj_to_segment_nodes(proj_pt: Tuple[float,float], a: Tuple[float,float], b: Tuple[float,float], proj_key: str):
        # Parameter t for projection itself along AB
        _, t_proj = _project_point_to_segment(proj_pt, a, b)
        seg_len = _dist(a, b)
        if seg_len <= 1e-9:
            return
        for key, pt in list(coords_by_key.items()):
            # Skip S/E special nodes (not in coords_by_key anyway) and self
            if key == proj_key:
                continue
            # Check if pt lies on segment AB (within small perpendicular tolerance)
            q, t = _project_point_to_segment(pt, a, b)
            # Only consider interior points (exclude endpoints, which are already connected)
            if t <= 1e-6 or t >= 1.0 - 1e-6:
                continue
            # Close enough to the segment line
            if _dist(q, pt) <= 1e-4:
                # Connect along-the-segment distance between projection and pt
                w = abs(t - t_proj) * seg_len
                add_edge(proj_key, key, w)

    _connect_proj_to_segment_nodes(sq, sa, sb, sq_k)
    _connect_proj_to_segment_nodes(eq, ea, eb, eq_k)

    # Connect S/E to projection nodes using perpendicular distances
    s_to_sq=_dist(start,sq); e_to_eq=_dist(end,eq)
    via_S={sq_k:sq}
    via_E={eq_k:eq}
    add_edge(S, sq_k, s_to_sq)
    add_edge(eq_k, E, e_to_eq)
    # shortest path (Dijkstra or A*)
    def dijkstra_search():
        pq=[(0.0,S)]; dist_map={S:0.0}; prev={S:None}; vis=set()
        while pq:
            d,u=heapq.heappop(pq)
            if u in vis: continue
            vis.add(u)
            if u==E: break
            for v,w in graph.get(u,{}).items():
                nd=d+w
                if nd < dist_map.get(v,float('inf')):
                    dist_map[v]=nd; prev[v]=u; heapq.heappush(pq,(nd,v))
        return prev
    def astar_search():
        # heuristic = Euclidean distance to end point (eq)
        def h(key: str) -> float:
            if key == E:
                return 0.0
            if key == S:
                return _dist(start, end)
            p = coords_by_key.get(key)
            if p is None:
                return 0.0
            return _dist(p, end)
        open_pq=[(h(S), 0.0, S)]  # (f, g, node)
        g_map={S:0.0}; prev={S:None}
        closed=set()
        while open_pq:
            f,g,u=heapq.heappop(open_pq)
            if u in closed:
                continue
            closed.add(u)
            if u==E:
                break
            for v,w in graph.get(u,{}).items():
                tentative=g+w
                if tentative < g_map.get(v, float('inf')):
                    g_map[v]=tentative
                    prev[v]=u
                    heapq.heappush(open_pq, (tentative + h(v), tentative, v))
        return prev

    if (algorithm or "").lower() == "astar":
        prev = astar_search()
    else:
        prev = dijkstra_search()
    if E not in prev:
        # cleanup before returning
        for cleanup_key in (S, E, sq_k, eq_k):
            graph.pop(cleanup_key, None)
        for k in list(graph.keys()):
            for cleanup_key in (S, E, sq_k, eq_k):
                graph[k].pop(cleanup_key, None)
        return [start, end]
    # reconstruct
    path=[]; cur=E
    while cur is not None:
        path.append(cur); cur=prev.get(cur)
    path.reverse()
    out=[start]
    for i in range(len(path)-1):
        u=path[i]; v=path[i+1]
        if u==S:
            proj=via_S.get(v)
            if proj is not None: out.append(proj)
            if v not in (S,E): out.append(coords_by_key[v])
        elif v==E:
            if u not in (S,E): out.append(coords_by_key[u])
            proj=via_E.get(u)
            if proj is not None: out.append(proj)
            out.append(end)
        else:
            if v in coords_by_key: out.append(coords_by_key[v])
    # cleanup: remove S/E and projection nodes from graph to avoid pollution
    for cleanup_key in (S, E, sq_k, eq_k):
        graph.pop(cleanup_key, None)
    for k in list(graph.keys()):
        for cleanup_key in (S, E, sq_k, eq_k):
            graph[k].pop(cleanup_key, None)
    # dedup
    cleaned=[]
    for p in out:
        if not cleaned or abs(cleaned[-1][0]-p[0])>1e-6 or abs(cleaned[-1][1]-p[1])>1e-6:
            cleaned.append(p)
    return cleaned

@router.post("/coords", response_model=RoutePolylineResponse)
async def get_route_by_coords(req: RouteByCoordsRequest, db: AsyncSession = Depends(get_db)):
    """
    Чөлөөт координатаас маршрутын polyline-г бодож буцаана.
    Алгоритм: бүх segments-оос граф үүсгээд, эх/төгсгөлийг ойрын ирмэгт snap хийж Dijkstra-аар бодно.
    """
    res = await db.execute(select(Segment))
    seg_rows = res.scalars().all()
    polylines: List[List[Tuple[float, float]]] = []
    for r in seg_rows:
        try:
            pl = json.loads(r.polyline_json)
            pts = [(float(p["x"]), float(p["y"])) for p in pl]
            if len(pts) >= 2:
                polylines.append(pts)
        except Exception:
            continue
    if not polylines:
        return RoutePolylineResponse(polyline=[
            RoutePoint(x=req.start.x, y=req.start.y),
            RoutePoint(x=req.end.x, y=req.end.y),
        ])
    graph, coords_by_key = _build_graph(polylines)
    # Connect very-near nodes to bridge tiny gaps between drawn segments
    # Allow slightly larger snapping tolerance to bridge small drawing gaps
    _connect_nearby_nodes(graph, coords_by_key, eps=20.0)
    algo = (req.algorithm or "").lower().strip() or "astar"
    poly = _shortest_polyline_between((req.start.x, req.start.y), (req.end.x, req.end.y), graph, coords_by_key, polylines, algorithm=algo)
    return RoutePolylineResponse(polyline=[RoutePoint(x=p[0], y=p[1]) for p in poly])

@router.post("/plan", response_model=RoutePlanResponse)
async def plan_multistop(req: RoutePlanRequest, db: AsyncSession = Depends(get_db)):
    """
    Олон бараанд хамгийн ойролцоогоор (greedy) дараалсан маршрутын polyline + эрэмбэлсэн item id-уудыг буцаана.
    Эхлэх цэг: req.start (заавал биш). Байхгүй бол эхний item-оос эхэлнэ.
    """
    # Load segments graph once
    res = await db.execute(select(Segment))
    seg_rows = res.scalars().all()
    polylines: List[List[Tuple[float, float]]] = []
    for r in seg_rows:
        try:
            pl = json.loads(r.polyline_json)
            pts = [(float(p["x"]), float(p["y"])) for p in pl]
            if len(pts) >= 2:
                polylines.append(pts)
        except Exception:
            continue
    graph, coords_by_key = _build_graph(polylines)

    # Load items
    ires = await db.execute(select(Item))
    all_items = {it.id: it for it in ires.scalars().all()}
    targets = [all_items[i] for i in req.item_ids if i in all_items]
    if not targets:
        return RoutePlanResponse(ordered_ids=[], polyline=[])

    # Determine start point
    if req.start is not None:
        cur = (req.start.x, req.start.y)
    else:
        # default to first item position
        first = targets[0]
        cur = (float(first.x), float(first.y))

    remaining = targets[:]
    order: List[Item] = []
    # Greedy nearest neighbor over Euclidean as heuristic
    while remaining:
        nearest = min(remaining, key=lambda it: _dist(cur, (float(it.x), float(it.y))))
        order.append(nearest)
        cur = (float(nearest.x), float(nearest.y))
        remaining.remove(nearest)

    # Build combined polyline
    combined: List[Tuple[float,float]] = []
    cur_pt = (req.start.x, req.start.y) if req.start is not None else (float(order[0].x), float(order[0].y))
    for idx, it in enumerate(order):
        goal = (float(it.x), float(it.y))
        if idx == 0 and req.start is None:
            # already at first item; just append
            if not combined:
                combined.append(goal)
            continue
        leg = _shortest_polyline_between(cur_pt, goal, graph, coords_by_key, polylines)
        if not combined:
            combined.extend(leg)
        else:
            # avoid duplicate joint point
            if combined[-1] == leg[0]:
                combined.extend(leg[1:])
            else:
                combined.extend(leg)
        cur_pt = goal

    return RoutePlanResponse(
        ordered_ids=[it.id for it in order],
        polyline=[RoutePoint(x=p[0], y=p[1]) for p in combined]
    )
    def qkey(x: float, y: float, prec: int = 4) -> str:
        return f"{round(x, prec):.{prec}f},{round(y, prec):.{prec}f}"

    def dist(a: Tuple[float, float], b: Tuple[float, float]) -> float:
        dx = a[0] - b[0]
        dy = a[1] - b[1]
        return math.hypot(dx, dy)

    def project_point_to_segment(p: Tuple[float, float], a: Tuple[float, float], b: Tuple[float, float]) -> Tuple[Tuple[float, float], float]:
        """p-г AB хэсэг дээр проекцлоно. Буцаах: (closest_point, t in [0,1])."""
        ax, ay = a; bx, by = b; px, py = p
        abx, aby = (bx - ax), (by - ay)
        ab2 = abx*abx + aby*aby
        if ab2 == 0:
            return a, 0.0
        apx, apy = (px - ax), (py - ay)
        t = (apx*abx + apy*aby) / ab2
        t_clamped = max(0.0, min(1.0, t))
        qx = ax + t_clamped * abx
        qy = ay + t_clamped * aby
        return (qx, qy), t_clamped

    # 2) Граф үүсгэх (segment intersection splitting)
    coords_by_key: Dict[str, Tuple[float, float]] = {}
    graph: Dict[str, Dict[str, float]] = {}

    def ensure_node(pt: Tuple[float, float]) -> str:
        k = qkey(pt[0], pt[1])
        if k not in coords_by_key:
            coords_by_key[k] = pt
            graph.setdefault(k, {})
        return k

    def add_edge(ka: str, kb: str, w: float):
        if ka == kb:
            return
        graph.setdefault(ka, {})
        graph.setdefault(kb, {})
        # undirected
        graph[ka][kb] = min(graph[ka].get(kb, float("inf")), w)
        graph[kb][ka] = min(graph[kb].get(ka, float("inf")), w)

    # Geometry helpers for intersections
    EPS = 1e-9

    def sub2(a: Tuple[float,float], b: Tuple[float,float]) -> Tuple[float,float]:
        return (a[0]-b[0], a[1]-b[1])

    def cross(a: Tuple[float,float], b: Tuple[float,float]) -> float:
        return a[0]*b[1] - a[1]*b[0]

    def add2(a: Tuple[float,float], b: Tuple[float,float]) -> Tuple[float,float]:
        return (a[0]+b[0], a[1]+b[1])

    def mul2(a: Tuple[float,float], s: float) -> Tuple[float,float]:
        return (a[0]*s, a[1]*s)

    def seg_intersection(p: Tuple[float,float], p2: Tuple[float,float], q: Tuple[float,float], q2: Tuple[float,float]) -> Optional[Tuple[Tuple[float,float], float, float]]:
        # p + t r, q + u s
        r = sub2(p2, p)
        s = sub2(q2, q)
        rxs = cross(r, s)
        qp = sub2(q, p)
        qpxr = cross(qp, r)
        if abs(rxs) < EPS:
            # parallel or colinear; skip splitting to keep simple
            return None
        t = cross(qp, s) / rxs
        u = cross(qp, r) / rxs
        if -EPS <= t <= 1+EPS and -EPS <= u <= 1+EPS:
            inter = add2(p, mul2(r, max(0.0, min(1.0, t))))
            return inter, t, u
        return None

    # Build edge list from polylines
    edges: List[Tuple[int,int,Tuple[float,float],Tuple[float,float]]] = []  # (pl_idx, seg_idx, a, b)
    for pi, pl in enumerate(polylines):
        for si in range(len(pl) - 1):
            a = pl[si]
            b = pl[si+1]
            edges.append((pi, si, a, b))

    # Collect split parameters per original edge
    splits: Dict[Tuple[int,int], List[float]] = {}
    for i in range(len(edges)):
        pi, si, a1, b1 = edges[i]
        for j in range(i+1, len(edges)):
            pj, sj, a2, b2 = edges[j]
            inter = seg_intersection(a1, b1, a2, b2)
            if inter is None:
                continue
            (ix, iy), t1, t2 = inter
            # ignore near endpoints
            if t1 <= EPS or t1 >= 1.0-EPS:
                pass
            else:
                splits.setdefault((pi, si), []).append(float(t1))
            if t2 <= EPS or t2 >= 1.0-EPS:
                pass
            else:
                splits.setdefault((pj, sj), []).append(float(t2))

    # From splits, create subdivided edges and add to graph
    for (pi, si, a, b) in edges:
        key = (pi, si)
        ts = [0.0, 1.0]
        if key in splits:
            ts.extend(splits[key])
        ts = sorted(set(max(0.0, min(1.0, t)) for t in ts))
        if len(ts) <= 1:
            ka = ensure_node(a)
            kb = ensure_node(b)
            add_edge(ka, kb, dist(a, b))
        else:
            # create sub-segments between consecutive t's
            r = sub2(b, a)
            prev_pt = add2(a, mul2(r, ts[0]))
            for k in range(1, len(ts)):
                cur_pt = add2(a, mul2(r, ts[k]))
                ka = ensure_node(prev_pt)
                kb = ensure_node(cur_pt)
                add_edge(ka, kb, dist(prev_pt, cur_pt))
                prev_pt = cur_pt

    # 3) Start/End-ийг ойрын ирмэг дээр snap хийх, тусгай S/E нод үүсгэх
    start = (req.start.x, req.start.y)
    end = (req.end.x, req.end.y)

    def best_projection(p: Tuple[float, float]) -> Optional[Tuple[Tuple[float,float], Tuple[float,float], Tuple[float,float]]]:
        best = None
        best_d = float("inf")
        for pl in polylines:
            for i in range(len(pl) - 1):
                a = pl[i]; b = pl[i+1]
                q, _ = project_point_to_segment(p, a, b)
                d = dist(p, q)
                if d < best_d:
                    best_d = d
                    best = (a, b, q)
        return best

    s_proj = best_projection(start)
    e_proj = best_projection(end)

    # Хэрэв проекц олдохгүй бол шулуун
    if not s_proj or not e_proj:
        return RoutePolylineResponse(polyline=[
            RoutePoint(x=req.start.x, y=req.start.y),
            RoutePoint(x=req.end.x, y=req.end.y),
        ])

    (sa, sb, sq) = s_proj
    (ea, eb, eq) = e_proj

    # S/E-нод бэлтгэх
    S = "__S__"; E = "__E__"
    graph.setdefault(S, {})
    graph.setdefault(E, {})

    # S-ээс sa, sb руу: |S->sq| + |sq->sa|, |S->sq| + |sq->sb|
    sa_k = ensure_node(sa)
    sb_k = ensure_node(sb)
    ea_k = ensure_node(ea)
    eb_k = ensure_node(eb)

    s_to_sq = dist(start, sq)
    e_to_eq = dist(end, eq)

    # special edges store via points for polyline rendering
    via_S = {sa_k: sq, sb_k: sq}
    via_E = {ea_k: eq, eb_k: eq}

    add_edge(S, sa_k, s_to_sq + dist(sq, sa))
    add_edge(S, sb_k, s_to_sq + dist(sq, sb))
    add_edge(ea_k, E, dist(ea, eq) + e_to_eq)
    add_edge(eb_k, E, dist(eb, eq) + e_to_eq)

    # 4) Dijkstra on graph
    def dijkstra(start_key: str, end_key: str) -> List[str]:
        pq = [(0.0, start_key)]
        dist_map: Dict[str, float] = {start_key: 0.0}
        prev: Dict[str, Optional[str]] = {start_key: None}
        visited = set()
        while pq:
            dcur, u = heapq.heappop(pq)
            if u in visited:
                continue
            visited.add(u)
            if u == end_key:
                break
            for v, w in graph.get(u, {}).items():
                nd = dcur + w
                if nd < dist_map.get(v, float("inf")):
                    dist_map[v] = nd
                    prev[v] = u
                    heapq.heappush(pq, (nd, v))
        if end_key not in prev:
            return []
        path = []
        cur = end_key
        while cur is not None:
            path.append(cur)
            cur = prev.get(cur)
        path.reverse()
        return path

    path_keys = dijkstra(S, E)
    if not path_keys:
        # fallback: straight line
        return RoutePolylineResponse(polyline=[
            RoutePoint(x=req.start.x, y=req.start.y),
            RoutePoint(x=req.end.x, y=req.end.y),
        ])

    # 5) Polyline-г сэргээх (S/E тусгай ирмэгүүдэд projection оруулж өгөх)
    out_pts: List[Tuple[float, float]] = []

    # эхлэл цэг
    out_pts.append(start)

    for i in range(len(path_keys) - 1):
        u = path_keys[i]
        v = path_keys[i+1]
        if u == S:
            # S -> endpoint
            # insert projection towards the chosen endpoint
            # determine projection point
            proj = via_S.get(v)
            if proj is not None:
                out_pts.append(proj)
            if v != E and v != S:
                out_pts.append(coords_by_key[v])
        elif v == E:
            # endpoint -> E
            # add endpoint coord then projection then end
            if u != S and u != E:
                out_pts.append(coords_by_key[u])
            proj = via_E.get(u)
            if proj is not None:
                out_pts.append(proj)
            out_pts.append(end)
        else:
            # normal graph edge, add v coord
            if v in coords_by_key:
                out_pts.append(coords_by_key[v])

    # Дараалсан давхардлыг цэвэрлэх
    dedup: List[Tuple[float, float]] = []
    for pt in out_pts:
        if not dedup or (abs(dedup[-1][0]-pt[0])>1e-6 or abs(dedup[-1][1]-pt[1])>1e-6):
            dedup.append(pt)

    return RoutePolylineResponse(polyline=[RoutePoint(x=p[0], y=p[1]) for p in dedup])
