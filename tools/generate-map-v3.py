# -*- coding: utf-8 -*-
"""FRONTIERS harita üreticisi v3.

Boyalı referans haritayı (1448x1086) okur ve şunları üretir:
  public/game/assets/map/terrain.jpg, terrain-small.jpg, snow.png, forest.png, land.png
  public/game/js/data/map.js
  tools/map-v3-preview.png

Çalıştırma:  python tools/generate-map-v3.py
Deterministiktir (sabit tohumlar). Ara hata ayıklama görüntüleri için MAPGEN_DEBUG=<klasör>.
"""
import os, sys, json, math, heapq, random
import numpy as np
import cv2
from scipy import ndimage as ndi
from skimage.morphology import reconstruction, skeletonize
from skimage.graph import MCP_Geometric

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_PNG = os.path.join(os.path.dirname(ROOT), 'referans gorseller',
                       'ChatGPT Görseli 16 Eki 2026 16_29_26-10.png')
OUT_ASSETS = os.path.join(ROOT, 'public', 'game', 'assets', 'map')
OUT_JS = os.environ.get('MAPGEN_OUT_JS') or os.path.join(ROOT, 'public', 'game', 'js', 'data', 'map.js')
OUT_PREVIEW = os.path.join(ROOT, 'tools', 'map-v3-preview.png')
DEBUG = os.environ.get('MAPGEN_DEBUG')

SEED = 20261016
random.seed(SEED)
np.random.seed(SEED)

W, H = 1448, 1086
TARGET_REGIONS = 60

KINGDOMS = [
    dict(id=0, name='Kızıl Aslan Krallığı', label=(290, 190)),
    dict(id=1, name='Mavi Kartal İmparatorluğu', label=(735, 240)),
    dict(id=2, name='Mor Taç Krallığı', label=(1135, 230)),
    dict(id=3, name='Yeşil Meşe Dükalığı', label=(335, 455)),
    dict(id=4, name='Altın Güneş Prensliği', label=(735, 650)),
    dict(id=5, name='Bakır Kılıç Beyliği', label=(1240, 640)),
]

# Baked crest + label boxes (x0, y0, x1, y1) in source pixels.
CREST_BOXES = [(250, 80, 330, 172), (690, 158, 780, 248), (1082, 120, 1168, 214),
               (292, 392, 376, 482), (694, 552, 778, 646), (1196, 536, 1280, 628)]
TEXT_BOXES = [(228, 170, 380, 228), (625, 242, 848, 296), (1068, 212, 1196, 270),
              (262, 478, 404, 532), (660, 640, 815, 698), (1178, 622, 1326, 676)]

# Generous areas where each kingdom's paint may appear (to separate e.g. red/orange hues).
KINGDOM_AREAS = {
    0: [(0, 0), (560, 0), (560, 110), (520, 200), (470, 330), (180, 330), (0, 300)],
    1: [(420, 60), (700, 40), (900, 90), (1030, 330), (1020, 470), (900, 500), (600, 500), (430, 360)],
    2: [(960, 40), (1340, 40), (1340, 400), (1000, 400)],
    3: [(0, 260), (480, 260), (640, 420), (620, 600), (400, 720), (100, 760), (0, 700)],
    4: [(80, 600), (500, 470), (900, 440), (1080, 480), (1180, 760), (1100, 1000), (300, 1000), (80, 850)],
    5: [(1000, 420), (1448, 420), (1448, 820), (1150, 840), (1060, 760), (1000, 560)],
}

# Off-map (clouds / decorative frame mountains).
OFFMAP = [
    [(0, 760), (70, 790), (110, 880), (110, 940), (300, 985), (330, 1086), (0, 1086)],
    [(960, 1086), (1000, 990), (1150, 950), (1260, 880), (1330, 830), (1448, 760), (1448, 1086)],
    [(0, 1045), (1448, 1045), (1448, 1086), (0, 1086)],
    [(0, 0), (345, 0), (338, 30), (300, 36), (240, 40), (200, 40), (150, 50), (100, 52), (60, 40), (0, 40)],
    [(1370, 0), (1448, 0), (1448, 70), (1400, 60)],
    [(0, 0), (10, 0), (10, 1086), (0, 1086)],
    [(1438, 0), (1448, 0), (1448, 1086), (1438, 1086)],
]

# Inland polygon: painted-blue water-like blobs inside it are land (Mavi Kartal), not sea.
INLAND = [(445, 140), (560, 95), (700, 60), (880, 110), (1010, 320), (1010, 450),
          (900, 480), (600, 480), (430, 330)]

ISLAND_MIN = 2000
# Unpainted land forced to a kingdom.
KINGDOM_OVERRIDES = [
    ([(1040, 790), (1215, 790), (1215, 915), (1040, 915)], 5),   # kale adası (güneydoğu)
]

# Painted capital cities (settlement anchors).
CAPITALS = {0: (430, 128), 1: (722, 330), 2: (1290, 160), 3: (330, 555), 4: (735, 760), 5: (1290, 735)}


def dbg(name, im):
    if DEBUG:
        os.makedirs(DEBUG, exist_ok=True)
        cv2.imwrite(os.path.join(DEBUG, name), im)


def disk(r):
    return cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2 * r + 1, 2 * r + 1))


def poly_mask(pts, shape=(H, W)):
    m = np.zeros(shape, np.uint8)
    cv2.fillPoly(m, [np.array(pts, np.int32)], 1)
    return m.astype(bool)


def inside(poly, x, y):
    return cv2.pointPolygonTest(np.array(poly, np.float32).reshape(-1, 1, 2), (float(x), float(y)), False) > 0


def load_src():
    img = cv2.imdecode(np.fromfile(SRC_PNG, np.uint8), cv2.IMREAD_COLOR)
    assert img.shape[:2] == (H, W), img.shape
    return img


# ---------------------------------------------------------------- masks
def offmap_mask():
    off = np.zeros((H, W), bool)
    xs = np.arange(0, W + 1, 4)
    ytop = 24 + 7 * np.sin(xs / 37.0) + 4 * np.sin(xs / 11.0 + 1.3)
    off |= poly_mask([(0, 0)] + [(int(x), int(y)) for x, y in zip(xs, ytop)] + [(W, 0)])
    for p in OFFMAP:
        off |= poly_mask(p)
    return off


def build_masks(img):
    hsv = cv2.cvtColor(cv2.GaussianBlur(img, (3, 3), 0), cv2.COLOR_BGR2HSV)
    Hh, S, V = [hsv[..., i].astype(int) for i in range(3)]
    water = ((Hh >= 84) & (Hh <= 118) & (S >= 70) & (V >= 35)) | \
            ((Hh >= 85) & (Hh <= 105) & (S >= 30) & (V >= 140))
    water = ndi.binary_opening(water, structure=np.ones((3, 3)))
    water = ndi.binary_closing(water, iterations=2)
    wo = cv2.morphologyEx(water.astype(np.uint8), cv2.MORPH_OPEN, disk(6)).astype(bool)
    lab, n = ndi.label(wo)
    seeds = np.zeros_like(wo)
    objs = ndi.find_objects(lab)
    for i, sl in enumerate(objs):
        m = lab[sl] == i + 1
        cnt = m.sum()
        if cnt < 800:
            continue
        ys, xs = np.nonzero(m)
        cx, cy = xs.mean() + sl[1].start, ys.mean() + sl[0].start
        if inside(INLAND, cx, cy):
            continue
        seeds[sl] |= m
    rec = reconstruction(seeds.astype(np.uint8), water.astype(np.uint8), method='dilation').astype(bool)
    op = cv2.morphologyEx(rec.astype(np.uint8), cv2.MORPH_OPEN, disk(5))
    sea = rec & cv2.dilate(op, disk(2)).astype(bool)
    # light shallow-water band along shores (bluish relative to surroundings) belongs to the sea
    labb = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)[..., 2].astype(np.float32)
    shallow = (labb < 126) & (labb < cv2.blur(labb, (31, 31)) - 7) & (V >= 60)
    for _ in range(3):
        sea |= shallow & cv2.dilate(sea.astype(np.uint8), disk(2)).astype(bool)
    off = offmap_mask()
    land = ~sea & ~off
    # cut piers / bridges and specks
    land = cv2.morphologyEx(land.astype(np.uint8), cv2.MORPH_OPEN, disk(3)).astype(bool)
    inv = ~land
    L, nn = ndi.label(inv)
    sz = ndi.sum(inv, L, range(1, nn + 1))
    land |= np.isin(L, 1 + np.where(sz < 250)[0])
    # inland water (lakes / rivers): water pixels inside land not belonging to blue paint
    return land, water, sea, off, hsv


def kingdom_paint(hsv):
    Hh, S, V = [hsv[..., i].astype(int) for i in range(3)]
    P = {
        0: ((Hh <= 7) | (Hh >= 170)) & (S >= 100) & (V >= 55),
        5: (Hh > 6) & (Hh <= 17) & (S >= 130) & (V >= 105),
        4: (Hh > 17) & (Hh <= 32) & (S >= 100) & (V >= 120),
        3: (Hh >= 35) & (Hh <= 85) & (S >= 70) & (V >= 35),
        1: (Hh >= 100) & (Hh <= 126) & (S >= 90) & (V >= 35),
        2: (Hh > 126) & (Hh < 170) & (S >= 50) & (V >= 35),
    }
    for k in P:
        P[k] &= poly_mask(KINGDOM_AREAS[k])
    return P


def assign_kingdoms(land, P):
    dens = np.stack([ndi.gaussian_filter((P[k] & land).astype(np.float32), 6) for k in range(6)])
    best = dens.argmax(0)
    val = dens.max(0)
    K = np.where(land & (val > 0.22), best, -1)
    # keep only big painted bodies
    for k in range(6):
        L, n = ndi.label(K == k)
        if n == 0:
            continue
        sz = ndi.sum(np.ones_like(L), L, range(1, n + 1))
        keep = 1 + np.where(sz >= 3000)[0]
        K[(K == k) & ~np.isin(L, keep)] = -1
    # components of land
    CL, n = ndi.label(land)
    sz = ndi.sum(land, CL, range(1, n + 1))
    main_id = 1 + int(np.argmax(sz))
    mainland = CL == main_id
    _, (iy, ix) = ndi.distance_transform_edt(K < 0, return_indices=True)
    K = np.where(mainland, K[iy, ix], -1)
    for poly, k in KINGDOM_OVERRIDES:
        K[poly_mask(poly) & mainland] = k
    # every kingdom's mainland territory must be one piece
    for _ in range(3):
        for k in range(6):
            L, nl = ndi.label(K == k)
            if nl <= 1:
                continue
            szk = ndi.sum(np.ones_like(L), L, range(1, nl + 1))
            big = 1 + int(np.argmax(szk))
            for j in range(1, nl + 1):
                if j == big:
                    continue
                m = L == j
                ring = cv2.dilate(m.astype(np.uint8), disk(1)).astype(bool) & ~m & (K >= 0) & (K != k)
                if ring.any():
                    K[m] = np.bincount(K[ring], minlength=6).argmax()
    # islands
    islands = []
    for i in range(n):
        if i + 1 == main_id or sz[i] < ISLAND_MIN:
            continue
        m = CL == i + 1
        islands.append(m)
    _, (iy, ix) = ndi.distance_transform_edt(K < 0, return_indices=True)
    nearestK = K[iy, ix]
    isl_info = []
    for m in islands:
        ys, xs = np.nonzero(m)
        ks = np.bincount(nearestK[m], minlength=6)
        k = int(np.argmax(ks))
        K[m] = k
        isl_info.append(dict(mask=m, kingdom=k, area=int(m.sum()), cx=float(xs.mean()), cy=float(ys.mean())))
    play = K >= 0
    return K, play, mainland, isl_info


N8 = [(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 1), (1, -1), (1, 0), (1, 1)]


def skeleton_paths(sk):
    """Split an 8-connected skeleton into pixel paths between nodes (deg!=2)."""
    pts = set(zip(*np.nonzero(sk)))

    def nb(p):
        return [(p[0] + dy, p[1] + dx) for dy, dx in N8 if (p[0] + dy, p[1] + dx) in pts]

    deg = {p: len(nb(p)) for p in pts}
    nodes = {p for p in pts if deg[p] != 2}
    seen_edges = set()
    paths = []
    for n0 in nodes:
        for q in nb(n0):
            if (n0, q) in seen_edges:
                continue
            path = [n0, q]
            seen_edges.add((n0, q)); seen_edges.add((q, n0))
            prev, cur = n0, q
            while cur not in nodes:
                nxt = [r for r in nb(cur) if r != prev and (cur, r) not in seen_edges]
                if not nxt:
                    break
                # prefer 4-neighbours to avoid diagonal shortcuts
                nxt.sort(key=lambda r: abs(r[0] - cur[0]) + abs(r[1] - cur[1]))
                r = nxt[0]
                seen_edges.add((cur, r)); seen_edges.add((r, cur))
                prev, cur = cur, r
                path.append(cur)
            paths.append(path)
    # pure loops without nodes
    rest = pts - {p for pa in paths for p in pa}
    while rest:
        p0 = rest.pop()
        path = [p0]
        cur = p0
        while True:
            nxt = [r for r in nb(cur) if r in rest]
            if not nxt:
                break
            cur = nxt[0]
            rest.discard(cur)
            path.append(cur)
        path.append(p0)
        paths.append(path)
    return paths, deg


def prune_skeleton(sk, min_spur=25, rounds=4):
    sk = sk.copy()
    for _ in range(rounds):
        paths, deg = skeleton_paths(sk)
        changed = False
        for pa in paths:
            a, b = pa[0], pa[-1]
            da, db = deg.get(a, 0), deg.get(b, 0)
            if len(pa) < min_spur and ((da == 1 and db >= 3) or (db == 1 and da >= 3)):
                for p in pa:
                    if deg.get(p, 0) <= 2:
                        sk[p] = False
                changed = True
        sk = skeletonize(sk)
        if not changed:
            break
    return sk


def chaikin(pts, it=2, closed=False):
    pts = np.asarray(pts, float)
    for _ in range(it):
        if len(pts) < 3:
            return pts
        if closed:
            P = pts
            Q = 0.75 * P + 0.25 * np.roll(P, -1, 0)
            R = 0.25 * P + 0.75 * np.roll(P, -1, 0)
            pts = np.empty((2 * len(P), 2)); pts[0::2] = Q; pts[1::2] = R
        else:
            P0, P1 = pts[:-1], pts[1:]
            Q = 0.75 * P0 + 0.25 * P1
            R = 0.25 * P0 + 0.75 * P1
            mid = np.empty((2 * len(P0), 2)); mid[0::2] = Q; mid[1::2] = R
            pts = np.vstack([pts[:1], mid, pts[-1:]])
    return pts


def dp_simplify(pts, eps):
    pts = np.asarray(pts, float)
    if len(pts) < 3:
        return pts
    c = cv2.approxPolyDP(pts.reshape(-1, 1, 2).astype(np.float32), eps, False).reshape(-1, 2)
    c = c.astype(float)
    c[0], c[-1] = pts[0], pts[-1]
    return c


# Ana nehirlerin kaba kılavuz çizgileri; boyalı nehir piksellerine yapıştırılır (snap).
RIVER_GUIDES = [
    # Yeşil Meşe ormanlarından Altın Güneş başkentinin güneyine
    [(372, 318), (382, 352), (405, 380), (428, 412), (446, 436), (442, 466), (462, 494), (484, 522)],
    [(480, 578), (492, 603), (508, 630), (518, 660), (514, 690), (545, 705), (585, 722), (600, 748),
     (620, 785), (660, 795), (720, 800), (800, 795), (860, 782), (905, 775), (950, 768), (985, 758)],
    # Mavi Kartal dağlarından Altın Güneş ovasına (mavi boya içinde kılavuz kullanılır)
    [(745, 362), (762, 392), (780, 418), (796, 444), (806, 470), (808, 505), (822, 535), (802, 556),
     (806, 582), (838, 602), (868, 622), (888, 650), (900, 680), (938, 700), (970, 720), (1000, 742),
     (1020, 760)],
    # Yeşil Meşe batı kıyısına akan dere
    [(242, 408), (205, 414), (172, 420), (150, 428)],
]


def extract_rivers(hsv, land, sea, K):
    Hh, S, V = [hsv[..., i].astype(int) for i in range(3)]
    landd = cv2.dilate(land.astype(np.uint8), disk(3)).astype(bool)
    blue = cv2.dilate((K == 1).astype(np.uint8), disk(2)).astype(bool)
    labb = cv2.cvtColor(cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR), cv2.COLOR_BGR2LAB)[..., 2].astype(np.float32)
    loc = cv2.blur(labb, (31, 31))
    rc = (labb < 124) & (labb < loc - 9) & (V >= 60) & ~((Hh < 30) | (Hh > 130)) & landd & ~blue
    if DEBUG:
        v = np.zeros((H, W, 3), np.uint8); v[rc] = (0, 255, 255); v[sea] //= 1; v[sea & ~rc] = (90, 40, 0)
        dbg('04a_rc.png', v)
    rc = cv2.morphologyEx(rc.astype(np.uint8), cv2.MORPH_CLOSE, disk(2)).astype(bool)
    rc = ndi.binary_fill_holes(rc) & landd
    L, n = ndi.label(rc, structure=np.ones((3, 3)))
    sz = ndi.sum(rc, L, range(1, n + 1))
    rc = np.isin(L, 1 + np.where(sz >= 60)[0])
    lakes = cv2.morphologyEx(rc.astype(np.uint8), cv2.MORPH_OPEN, disk(5)).astype(bool)
    L, n = ndi.label(lakes)
    sz = ndi.sum(lakes, L, range(1, n + 1))
    lakes = np.isin(L, 1 + np.where(sz >= 300)[0])
    lakes = cv2.dilate(lakes.astype(np.uint8), disk(2)).astype(bool) & rc
    dt = ndi.distance_transform_edt(rc)
    _, (iy, ix) = ndi.distance_transform_edt(~rc, return_indices=True)
    dist_rc = ndi.distance_transform_edt(~rc)
    rivers = []
    for g in RIVER_GUIDES:
        g = np.array(g, float)
        seg = np.linalg.norm(np.diff(g, axis=0), axis=1)
        t = np.concatenate([[0], np.cumsum(seg)])
        ts = np.arange(0, t[-1], 3.0)
        pts = np.stack([np.interp(ts, t, g[:, 0]), np.interp(ts, t, g[:, 1])], 1)
        ws = []
        snapped = []
        for x, y in pts:
            xi, yi = int(np.clip(round(x), 0, W - 1)), int(np.clip(round(y), 0, H - 1))
            if dist_rc[yi, xi] <= 8:
                sx, sy = ix[yi, xi], iy[yi, xi]
                # move to the centre of the water ribbon (local DT maximum)
                y0, y1, x0, x1 = max(sy - 3, 0), min(sy + 4, H), max(sx - 3, 0), min(sx + 4, W)
                win = dt[y0:y1, x0:x1]
                k = np.unravel_index(np.argmax(win), win.shape)
                snapped.append((x0 + k[1] + 0.5, y0 + k[0] + 0.5))
                ws.append(dt[y0 + k[0], x0 + k[1]] * 2)
            else:
                snapped.append((x, y))
        sp = np.array(snapped)
        # smooth (moving average, endpoints fixed)
        for _ in range(3):
            sp[1:-1] = 0.25 * sp[:-2] + 0.5 * sp[1:-1] + 0.25 * sp[2:]
        wv = np.median(ws) if ws else 3
        rivers.append(dict(pts=sp, w=int(np.clip(round(wv / 2.2), 1, 4))))
    # widen downstream rivers a bit (lower course)
    rmask = np.zeros((H, W), np.uint8)
    for r in rivers:
        cv2.polylines(rmask, [np.round(r['pts']).astype(np.int32).reshape(-1, 1, 2)], False, 1, 3)
    rmask = rmask.astype(bool) | (rc & ~lakes)
    return rivers, rmask, lakes


# ---------------------------------------------------------------- partition
def smooth_noise(shape, sigma, seed):
    rs = np.random.RandomState(seed)
    n = ndi.gaussian_filter(rs.rand(*shape).astype(np.float32), sigma)
    n -= n.min(); n /= (n.max() + 1e-9)
    return n


def multi_dijkstra(cost, allowed, seeds, offsets):
    """Additively-weighted geodesic Voronoi on a grid. seeds: list of (y, x)."""
    h, w = cost.shape
    INF = 1e18
    dist = np.full(h * w, INF)
    lab = np.full(h * w, -1, np.int32)
    al = allowed.ravel().tolist()
    cf = cost.ravel().astype(float).tolist()
    dist = dist.tolist()
    labl = lab.tolist()
    heap = []
    for i, (y, x) in enumerate(seeds):
        f = y * w + x
        d0 = float(offsets[i])
        if d0 < dist[f]:
            dist[f] = d0
            labl[f] = i
            heap.append((d0, f, i))
    heapq.heapify(heap)
    nbs = [(-w, 1.0), (w, 1.0), (-1, 1.0), (1, 1.0),
           (-w - 1, 1.4142), (-w + 1, 1.4142), (w - 1, 1.4142), (w + 1, 1.4142)]
    pop, push = heapq.heappop, heapq.heappush
    N = h * w
    while heap:
        d, f, i = pop(heap)
        if d > dist[f] or labl[f] != i:
            continue
        x = f % w
        cf0 = cf[f]
        for off, ln in nbs:
            g = f + off
            if g < 0 or g >= N:
                continue
            gx = g % w
            if gx - x > 1 or x - gx > 1:
                continue
            if not al[g]:
                continue
            nd = d + ln * 0.5 * (cf0 + cf[g])
            if nd < dist[g]:
                dist[g] = nd
                labl[g] = i
                push(heap, (nd, g, i))
    return np.array(labl, np.int32).reshape(h, w)


def partition(K, isl, cost_full, counts, fixed_seeds):
    """Split each kingdom's mainland into counts[k] compact regions. Returns full-res label map."""
    f = 2
    h2, w2 = H // f, W // f
    K2 = K[::f, ::f][:h2, :w2].copy()
    isl_mask = np.zeros((H, W), bool)
    for it in isl:
        isl_mask |= it['mask']
    K2[isl_mask[::f, ::f][:h2, :w2]] = -1
    cost2 = cv2.resize(cost_full, (w2, h2), interpolation=cv2.INTER_AREA)
    R2 = np.full((h2, w2), -1, np.int32)
    next_id = 0
    region_kingdom = []
    for k in range(6):
        m = K2 == k
        ys, xs = np.nonzero(m)
        n = counts[k]
        data = np.stack([xs, ys], 1).astype(np.float32)
        cv2.setRNGSeed(SEED + k)
        crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 60, 0.2)
        _, lb, cen = cv2.kmeans(data, n, None, crit, 6, cv2.KMEANS_PP_CENTERS)
        seeds = []
        for cx, cy in cen:
            j = np.argmin((xs - cx) ** 2 + (ys - cy) ** 2)
            seeds.append([int(ys[j]), int(xs[j])])
        fixed_idx = set()
        for (fx, fy) in fixed_seeds.get(k, []):
            fx2, fy2 = fx / f, fy / f
            j = int(np.argmin([(sy - fy2) ** 2 + (sx - fx2) ** 2 for sy, sx in seeds]))
            jj = np.argmin((xs - fx2) ** 2 + (ys - fy2) ** 2)
            seeds[j] = [int(ys[jj]), int(xs[jj])]
            fixed_idx.add(j)
        off = np.zeros(n)
        mean_area = m.sum() / n
        scale = math.sqrt(mean_area) * float(np.mean(cost2[m]))
        best = None
        for itr in range(12):
            lab = multi_dijkstra(cost2, m, seeds, off)
            areas = np.bincount(lab[m], minlength=n).astype(float)
            dev = np.abs(areas / mean_area - 1).max()
            if best is None or dev < best[0]:
                best = (dev, lab.copy())
            for i in range(n):
                yy, xx = np.nonzero(lab == i)
                if len(yy) == 0:
                    continue
                if i not in fixed_idx and itr < 8:
                    cy, cx = yy.mean(), xx.mean()
                    j = np.argmin((xx - cx) ** 2 + (yy - cy) ** 2)
                    seeds[i] = [int(yy[j]), int(xx[j])]
            off += 0.35 * scale * (areas / mean_area - 1)
            off -= off.min()
        lab = best[1]
        print(f'  kingdom {k}: {n} regions, max area dev {best[0]:.2f}')
        R2[m] = lab[m] + next_id
        region_kingdom += [k] * n
        next_id += n
    R = np.full((H, W), -1, np.int32)
    up = np.repeat(np.repeat(R2, f, 0), f, 1)
    R[:up.shape[0], :up.shape[1]] = up
    kingdom_of = np.array(region_kingdom + [-1])
    main = (K >= 0) & ~isl_mask
    bad = main & ((R < 0) | (kingdom_of[R] != K))
    R[bad | ~main] = -1
    for k in range(6):
        mk = (K == k) & ~isl_mask
        lk = np.where(mk & (R >= 0), R, -1)
        miss = mk & (R < 0)
        if miss.any():
            _, (iy, ix) = ndi.distance_transform_edt(lk < 0, return_indices=True)
            R[miss] = lk[iy, ix][miss]
    # domain warp: natural, meandering borders (kept inside each kingdom, calmer along rivers)
    calm = 1.0 - np.clip(ndi.gaussian_filter((cost_full > 4).astype(np.float32), 3) * 2, 0, 1)
    dx = (smooth_noise((H, W), 14, SEED + 7) - 0.5) * 22 + (smooth_noise((H, W), 5, SEED + 8) - 0.5) * 9
    dy = (smooth_noise((H, W), 14, SEED + 9) - 0.5) * 22 + (smooth_noise((H, W), 5, SEED + 10) - 0.5) * 9
    yy, xx = np.mgrid[0:H, 0:W]
    sx = np.clip(np.round(xx + dx * calm), 0, W - 1).astype(int)
    sy = np.clip(np.round(yy + dy * calm), 0, H - 1).astype(int)
    Rw = R[sy, sx]
    ok = main & (Rw >= 0) & (kingdom_of[Rw] == K)
    R = np.where(ok, Rw, R)
    for it in isl:
        R[it['mask']] = next_id
        region_kingdom.append(it['kingdom'])
        it['rid'] = next_id
        next_id += 1
    return R, region_kingdom


def fix_fragments(R, rk):
    """Each region one connected component; stray pieces go to the neighbour with longest contact."""
    for _ in range(4):
        changed = False
        for r in range(len(rk)):
            L, n = ndi.label(R == r)
            if n <= 1:
                continue
            sz = ndi.sum(np.ones_like(L), L, range(1, n + 1))
            big = 1 + int(np.argmax(sz))
            for j in range(1, n + 1):
                if j == big:
                    continue
                m = L == j
                ring = cv2.dilate(m.astype(np.uint8), np.ones((3, 3), np.uint8)).astype(bool) & ~m & (R >= 0)
                labs = R[ring]
                if len(labs) == 0:
                    R[m] = -1
                    continue
                same = [l for l in labs if rk[l] == rk[r] and l != r]
                pick = np.bincount(same).argmax() if same else np.bincount(labs).argmax()
                R[m] = pick
                changed = True
        if not changed:
            break
    return R


def smooth_labels(R, n, sigma=2.5):
    """Majority-style smoothing of region borders (coastline untouched)."""
    best = np.zeros(R.shape, np.float32)
    out = R.copy()
    pad = int(sigma * 4)
    for r in range(n):
        ys, xs = np.nonzero(R == r)
        if len(xs) == 0:
            continue
        y0, y1 = max(ys.min() - pad, 0), min(ys.max() + pad + 1, H)
        x0, x1 = max(xs.min() - pad, 0), min(xs.max() + pad + 1, W)
        sc = ndi.gaussian_filter((R[y0:y1, x0:x1] == r).astype(np.float32), sigma)
        sub_b = best[y0:y1, x0:x1]
        upd = (sc > sub_b) & (R[y0:y1, x0:x1] >= 0)
        sub_b[upd] = sc[upd]
        out[y0:y1, x0:x1][upd] = r
    return out


# ---------------------------------------------------------------- vectorisation
def renumber(R, rk, isl):
    """Stable, readable ids: by kingdom, mainland north->south / west->east, islands last."""
    n = len(rk)
    isl_ids = {it['rid'] for it in isl}
    info = []
    for r in range(n):
        ys, xs = np.nonzero(R == r)
        if len(xs) == 0:
            continue
        info.append((rk[r], r in isl_ids, round(ys.mean() / 110), xs.mean(), r))
    info.sort()
    remap = np.full(n + 1, -1, np.int32)
    new_rk, new_isl = [], []
    for new, (k, il, _, _, old) in enumerate(info):
        remap[old] = new
        new_rk.append(k)
        new_isl.append(il)
    R2 = np.where(R >= 0, remap[R], -1)
    for it in isl:
        it['rid'] = int(remap[it['rid']])
    return R2, new_rk, new_isl


def crack_chains(R):
    """Shared boundary chains between labels (water/outside = -1) along pixel cracks."""
    Hh_, Ww_ = R.shape
    P = np.full((Hh_ + 2, Ww_ + 2), -1, np.int32)
    P[1:-1, 1:-1] = R
    # horizontal cracks: corner (y,x)->(y,x+1) between P[y,x+1] (above) and P[y+1,x+1] (below)
    A = P[0:Hh_ + 1, 1:Ww_ + 1]
    B = P[1:Hh_ + 2, 1:Ww_ + 1]
    hy, hx = np.nonzero(A != B)
    # vertical cracks: corner (y,x)->(y+1,x) between P[y+1,x] (left) and P[y+1,x+1] (right)
    Cl = P[1:Hh_ + 1, 0:Ww_ + 1]
    Cr = P[1:Hh_ + 1, 1:Ww_ + 2]
    vy, vx = np.nonzero(Cl != Cr)
    adj = {}
    cracks = []
    for y, x in zip(hy.tolist(), hx.tolist()):
        a, b = int(A[y, x]), int(B[y, x])
        cracks.append(((y, x), (y, x + 1), (min(a, b), max(a, b))))
    for y, x in zip(vy.tolist(), vx.tolist()):
        a, b = int(Cl[y, x]), int(Cr[y, x])
        cracks.append(((y, x), (y + 1, x), (min(a, b), max(a, b))))
    for i, (p0, p1, pr) in enumerate(cracks):
        adj.setdefault(p0, []).append(i)
        adj.setdefault(p1, []).append(i)
    junction = {c for c, l in adj.items() if len(l) != 2}
    used = bytearray(len(cracks))
    chains = []

    def other(i, c):
        p0, p1, _ = cracks[i]
        return p1 if c == p0 else p0

    for j in junction:
        for i in adj[j]:
            if used[i]:
                continue
            pr = cracks[i][2]
            pts = [j]
            cur, ci = j, i
            while True:
                used[ci] = 1
                nxt = other(ci, cur)
                pts.append(nxt)
                if nxt in junction:
                    break
                cand = [k for k in adj[nxt] if not used[k]]
                if not cand:
                    break
                cur, ci = nxt, cand[0]
            chains.append(dict(pts=pts, pair=pr, closed=False))
    for i in range(len(cracks)):
        if used[i]:
            continue
        pr = cracks[i][2]
        start = cracks[i][0]
        pts = [start]
        cur, ci = start, i
        while True:
            used[ci] = 1
            nxt = other(ci, cur)
            pts.append(nxt)
            if nxt == start:
                break
            cand = [k for k in adj[nxt] if not used[k]]
            if not cand:
                break
            cur, ci = nxt, cand[0]
        chains.append(dict(pts=pts, pair=pr, closed=True))
    for c in chains:
        arr = np.array([(x, y) for y, x in c['pts']], float)   # corner coords = image coords
        c['raw'] = arr
        c['length'] = len(arr) - 1
    return chains


def smooth_chain(arr, closed, eps=1.2):
    if closed:
        a = arr[:-1]
        if len(a) < 8:
            return arr
        # rotate so that the start is a "corner" and simplify as closed curve
        c = cv2.approxPolyDP(a.reshape(-1, 1, 2).astype(np.float32), eps, True).reshape(-1, 2).astype(float)
        if len(c) < 3:
            return arr
        c = chaikin(c, 2, closed=True)
        return np.vstack([c, c[:1]])
    if len(arr) <= 2:
        return arr
    c = dp_simplify(arr, eps)
    c = chaikin(c, 2)
    return c


def assemble_rings(pieces):
    """pieces: list of point arrays (open, endpoints shared) -> closed rings."""
    rings = []
    open_p = []
    for p in pieces:
        if np.allclose(p[0], p[-1]) and len(p) > 2:
            rings.append(p)
        else:
            open_p.append(p)
    key = lambda pt: (round(pt[0] * 10), round(pt[1] * 10))
    ends = {}
    for i, p in enumerate(open_p):
        ends.setdefault(key(p[0]), []).append((i, 0))
        ends.setdefault(key(p[-1]), []).append((i, 1))
    used = [False] * len(open_p)
    for i in range(len(open_p)):
        if used[i]:
            continue
        used[i] = True
        ring = [open_p[i]]
        start = key(open_p[i][0])
        cur = key(open_p[i][-1])
        guard = 0
        while cur != start and guard < 10000:
            guard += 1
            nxt = None
            for (j, e) in ends.get(cur, []):
                if not used[j]:
                    nxt = (j, e)
                    break
            if nxt is None:
                break
            j, e = nxt
            used[j] = True
            seg = open_p[j] if e == 0 else open_p[j][::-1]
            ring.append(seg[1:])
            cur = key(seg[-1])
        rings.append(np.vstack(ring))
    return rings


def fmt(v):
    s = f'{v:.1f}'
    return s[:-2] if s.endswith('.0') else s


def path_d(rings, close=True):
    out = []
    for r in rings:
        pts = r[:-1] if (close and np.allclose(r[0], r[-1])) else r
        out.append('M' + ' '.join(f'{fmt(x)},{fmt(y)}' for x, y in pts) + ('Z' if close else ''))
    return ''.join(out)


def vectorize(R, n):
    chains = crack_chains(R)
    for c in chains:
        c['pts_s'] = smooth_chain(c['raw'], c['closed'])
    region_rings = []
    for r in range(n):
        pieces = [c['pts_s'] for c in chains if r in c['pair']]
        region_rings.append(assemble_rings(pieces))
    coast_rings = assemble_rings([c['pts_s'] for c in chains if c['pair'][0] == -1])
    border_len = {}
    border_chains = {}
    for c in chains:
        a, b = c['pair']
        if a < 0:
            continue
        border_len[(a, b)] = border_len.get((a, b), 0) + c['length']
        border_chains.setdefault((a, b), []).append(c)
    return chains, region_rings, coast_rings, border_len, border_chains

# ---------------------------------------------------------------- names
NAMES = {
    0: dict(capital='Aslanburç',
            port=['Yeleliman', 'Kızılkoy', 'Aslanburnu'],
            mine=['Kızılkaya', 'Kor Ocağı'],
            mountain=['Pençe Geçidi', 'Kükreyen Tepe', 'Kor Dağı'],
            generic=['Alazova', 'Kanlıdere', 'Yelehisar', 'Al Bayır', 'Ateşyurdu', 'Kızılçam', 'Pençeköy',
                     'Gürleyen Vadi', 'Aslanpınar']),
    1: dict(capital='Kartalyuva',
            port=['Kartal Limanı', 'Gökliman'],
            mine=['Gökdoruk', 'Gümüşkaya'],
            mountain=['Bulutkale', 'Yüce Zirve', 'Kanatlı Geçit', 'Buzpınar', 'Atmacabeli', 'Sarp Doruk'],
            generic=['Doğankaya', 'Şahinköy', 'Mavigöl', 'Gökçedere', 'Pusulatepe', 'Tüylüova', 'Gökçeyayla',
                     'Kanatlıköy']),
    2: dict(capital='Taçkale',
            port=['Ametist Koyu', 'Erguvan Limanı', 'Mor Fiyort'],
            mine=['Kristal Sarp', 'Ametist Ocağı'],
            mountain=['Karlıtepe', 'Buzlu Kayalar', 'Asaburç', 'Kar Geçidi', 'Mor Doruk'],
            generic=['Menekşe Vadisi', 'Leylakhisar', 'Taçburnu', 'Karayaka', 'Saraybeli', 'Mor Yamaç',
                     'Lalezar']),
    3: dict(capital='Meşekale',
            port=['Yosunlu Liman', 'Sarmaşık Koyu', 'Yeşilburun'],
            mine=['Kozalak Ocağı', 'Taşlıkoru'],
            mountain=['Ladin Doruğu', 'Kayın Tepe'],
            generic=['Meşeköy', 'Palamut Ormanı', 'Yaprakhisar', 'Gölgeorman', 'Dalboyu', 'Köklüdere',
                     'Ladin Yaylası', 'Avcılar Korusu', 'Kozalaklı', 'Çınaraltı']),
    4: dict(capital='Güneşkent',
            port=['Altınliman', 'Kehribar Koyu', 'Sarayburnu'],
            mine=['Altıntepe', 'Kehribar Ocağı'],
            mountain=['Şafak Tepesi', 'Işık Doruğu'],
            generic=['Başakova', 'Şafakhisar', 'Sarıçayır', 'Harmanlı', 'Tanyeri', 'Buğdaylı', 'Ayçiçeği Ovası',
                     'Gündoğdu', 'Işıklı', 'Bereketli', 'Saman Pazarı', 'Güneydere', 'Altınbaşak', 'Sazlıdelta',
                     'Değirmenköy', 'Gümüşırmak']),
    5: dict(capital='Bakırhisar',
            port=['Tunçliman', 'Kumburnu', 'Kılıç Koyu'],
            mine=['Bakır Ocağı', 'Pas Kayası'],
            mountain=['Kızgın Tepe', 'Demir Sırtı'],
            generic=['Kılıçbozkırı', 'Kızılkum', 'Demirçöl', 'Kılıçlıköy', 'Kuru Vadi', 'Akrep Yaylası',
                     'Kavruk Ova', 'Bakırdere', 'Serapköy']),
}
ISLAND_NAMES = ['Martı Adası', 'Fener Adası', 'Kayalık Ada', 'İnci Adası', 'Rüzgâr Adası', 'Mercan Adası',
                'Sis Adası', 'Kartal Adası']

# Painted harbours / ships (source px) -> port candidates.
HARBOURS = [(70, 150), (60, 480), (100, 545), (520, 905), (840, 950), (960, 830), (1110, 850),
            (1300, 760), (1190, 780), (1240, 330), (1300, 60), (300, 830), (130, 720), (1390, 470)]

TYPE_POP = dict(capital=(180, 260), city=(90, 140), industrial=(80, 120), port=(60, 100),
                town=(35, 60), village=(15, 35), mine=(20, 40))


# ---------------------------------------------------------------- analysis helpers
def feature_maps(img, hsv):
    Hh, S, V = [hsv[..., i].astype(np.float32) for i in range(3)]
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)
    mu = cv2.blur(g, (11, 11))
    std = np.sqrt(np.maximum(cv2.blur(g * g, (11, 11)) - mu * mu, 0))
    rock = (S < 80) & (V > 70) & (std > 16)
    snow = (V > 185) & (S < 50)
    forest = (Hh >= 30) & (Hh <= 95) & (V < 125) & (S > 45)
    farm = (Hh > 15) & (Hh <= 32) & (S > 90) & (V > 150) & (std < 26)
    mtn = ndi.gaussian_filter(rock.astype(np.float32) * 0.7 + snow.astype(np.float32), 6)
    elev = np.clip(mtn / max(np.percentile(mtn, 99.5), 1e-3), 0, 1)
    return dict(rock=rock, snow=snow, forest=forest, farm=farm, elev=elev, std=std)


def forest_mask(art, land):
    """Tree cover: dark, textured, green-ish pixels on land (works on the recoloured art)."""
    hsv = cv2.cvtColor(art, cv2.COLOR_BGR2HSV)
    Hh, S, V = [hsv[..., i].astype(np.float32) for i in range(3)]
    g = cv2.cvtColor(art, cv2.COLOR_BGR2GRAY).astype(np.float32)
    mu = cv2.blur(g, (7, 7))
    std = np.sqrt(np.maximum(cv2.blur(g * g, (7, 7)) - mu * mu, 0))
    f = (V < 110) & (std > 10) & (Hh >= 25) & (Hh <= 100) & (S > 28) & land
    f = cv2.morphologyEx(f.astype(np.uint8), cv2.MORPH_OPEN, np.ones((2, 2), np.uint8)).astype(bool)
    dens = ndi.gaussian_filter(f.astype(np.float32), 3)
    return (dens > 0.33) & land


def pole(mask, prefer=None):
    m = np.pad(mask.astype(np.uint8), 1)
    dt = cv2.distanceTransform(m, cv2.DIST_L2, 5)[1:-1, 1:-1]
    ys, xs = np.nonzero(mask)
    cy, cx = (ys.mean(), xs.mean()) if prefer is None else (prefer[1], prefer[0])
    score = dt - 0.04 * np.hypot(np.arange(mask.shape[1])[None, :] - cx, np.arange(mask.shape[0])[:, None] - cy)
    score[~mask] = -1e9
    y, x = np.unravel_index(np.argmax(score), score.shape)
    return x, y, dt


def catmull(pts, closed=False, tension=0.5):
    """Smooth path through points as cubic Bezier SVG commands."""
    P = [np.asarray(p, float) for p in pts]
    if len(P) == 2:
        return f'M{fmt(P[0][0])},{fmt(P[0][1])}L{fmt(P[1][0])},{fmt(P[1][1])}'
    out = [f'M{fmt(P[0][0])},{fmt(P[0][1])}']
    for i in range(len(P) - 1):
        p0 = P[i - 1] if i > 0 else P[i]
        p1, p2 = P[i], P[i + 1]
        p3 = P[i + 2] if i + 2 < len(P) else P[i + 1]
        c1 = p1 + (p2 - p0) * tension / 3
        c2 = p2 - (p3 - p1) * tension / 3
        out.append(f'C{fmt(c1[0])},{fmt(c1[1])} {fmt(c2[0])},{fmt(c2[1])} {fmt(p2[0])},{fmt(p2[1])}')
    return ''.join(out)


def bezier_sample(pts, tension=0.5, k=12):
    P = [np.asarray(p, float) for p in pts]
    out = [P[0]]
    for i in range(len(P) - 1):
        p0 = P[i - 1] if i > 0 else P[i]
        p1, p2 = P[i], P[i + 1]
        p3 = P[i + 2] if i + 2 < len(P) else P[i + 1]
        c1 = p1 + (p2 - p0) * tension / 3
        c2 = p2 - (p3 - p1) * tension / 3
        for t in np.linspace(0, 1, k)[1:]:
            out.append((1 - t) ** 3 * p1 + 3 * (1 - t) ** 2 * t * c1 + 3 * (1 - t) * t * t * c2 + t ** 3 * p2)
    return np.array(out)


# ---------------------------------------------------------------- regions
def build_regions(R, rk, is_isl, chains, blen, bch, feats, rmask, open_sea, K):
    n = len(rk)
    regs = []
    for r in range(n):
        m = R == r
        ys, xs = np.nonzero(m)
        area = int(m.sum())
        ring = cv2.dilate(m.astype(np.uint8), disk(3)).astype(bool) & ~m
        coastal = int((ring & open_sea).sum()) >= 12
        regs.append(dict(id=r, kingdom=rk[r], island=bool(is_isl[r]), area=area, coastal=coastal,
                         mx=float(xs.mean()), my=float(ys.mean()),
                         rock=float(feats['rock'][m].mean()), snow=float(feats['snow'][m].mean()),
                         forest=float(feats['forest'][m].mean()), farm=float(feats['farm'][m].mean()),
                         elevation=float(feats['elev'][m].mean()),
                         river=int((rmask & m).sum()) >= 25))
    adj = [set() for _ in range(n)]
    for (a, b), L in blen.items():
        if L >= 6 and not regs[a]['island'] and not regs[b]['island']:
            adj[a].add(b)
            adj[b].add(a)
    return regs, adj


# Terrain quotas per kingdom (fractions of mainland regions); the rest gets the kingdom default.
TERRAIN_QUOTA = {
    0: dict(mountains=0.25, forest=0.13, hills=0.37, default='plains'),
    1: dict(mountains=0.45, forest=0.27, hills=0.28, default='forest'),
    2: dict(mountains=0.62, forest=0.0, hills=0.38, default='hills'),
    3: dict(mountains=0.0, forest=0.75, hills=0.13, default='plains'),
    4: dict(mountains=0.0, forest=0.0, hills=0.14, plains=0.3, default='farmland'),
    5: dict(mountains=0.12, forest=0.0, hills=0.38, default='desert'),
}
DELTA = (1020, 760)   # river mouth of the gold kingdom -> marsh


def classify_terrain(regs, adj):
    for k in range(6):
        ks = [g for g in regs if g['kingdom'] == k and not g['island']]
        q = TERRAIN_QUOTA[k]
        n = len(ks)
        left = list(ks)
        if k == 4:
            cand = [g for g in left if not g.get('contains_capital')]
            mg = min(cand, key=lambda g: math.hypot(g['mx'] - DELTA[0], g['my'] - DELTA[1]))
            mg['terrain'] = 'marsh'
            left.remove(mg)
        mscore = lambda g: g['elevation'] + 2 * g['snow']
        nm = int(round(q['mountains'] * n))
        for g in sorted([g for g in left if not g.get('contains_capital')], key=mscore, reverse=True)[:nm]:
            g['terrain'] = 'mountains'
            left.remove(g)
        nf = int(round(q['forest'] * n))
        for g in sorted(left, key=lambda g: g['forest'], reverse=True)[:nf]:
            g['terrain'] = 'forest'
            left.remove(g)
        nh = int(round(q['hills'] * n))
        for g in sorted(left, key=mscore, reverse=True)[:nh]:
            g['terrain'] = 'hills'
            left.remove(g)
        if 'plains' in q:
            npl = int(round(q['plains'] * n))
            for g in sorted(left, key=lambda g: g['farm'])[:npl]:
                g['terrain'] = 'plains'
                left.remove(g)
        for g in left:
            g['terrain'] = q['default']
    for g in regs:
        if g['island']:
            g['terrain'] = 'hills' if g['elevation'] > 0.24 else ('forest' if g['forest'] > 0.3 else 'plains')
    return regs


def assign_types(regs, adj):
    n = len(regs)
    for g in regs:
        g['type'] = None
    for k in range(6):
        cap = CAPITALS[k]
        best = min((g for g in regs if g['kingdom'] == k and not g['island']),
                   key=lambda g: 0 if g.get('contains_capital') else 1e9 + (g['mx'] - cap[0]) ** 2 + (g['my'] - cap[1]) ** 2)
        best['type'] = 'capital'
    # ports
    for k in range(6):
        coast = [g for g in regs if g['kingdom'] == k and g['coastal'] and g['type'] is None]
        if not coast:
            continue
        scored = []
        for g in coast:
            d = min(math.hypot(g['cx'] - hx, g['cy'] - hy) for hx, hy in HARBOURS)
            scored.append((d - (40 if g['island'] and g['area'] > 8000 else 0), g))
        scored.sort(key=lambda t: t[0])
        nport = 1 if len(coast) <= 2 else (2 if len(coast) <= 5 else 3)
        picked = 0
        for d, g in scored:
            if picked >= nport:
                break
            if picked >= 1 and d > 90:
                break
            if any(regs[j]['type'] == 'port' for j in adj[g['id']]):
                continue
            g['type'] = 'port'
            picked += 1
    for k in range(6):
        ks = [g for g in regs if g['kingdom'] == k and not g['island']]
        free = lambda: [g for g in ks if g['type'] is None]
        # industrial: hilly, next to mountains
        cand = sorted([g for g in free() if g['terrain'] != 'marsh'],
                      key=lambda g: -(g['rock'] + 0.5 * g['elevation'] + 0.2 * (g['terrain'] == 'hills')
                                      - 0.6 * (g['terrain'] == 'mountains')))
        cand[0]['type'] = 'industrial'
        # mines: hills / mountains
        cand = sorted([g for g in free() if g['terrain'] != 'marsh'],
                      key=lambda g: -(g['rock'] + g['snow'] + 1.0 * (g['terrain'] in ('hills', 'mountains'))))
        nm = 2 if len(ks) >= 10 or k in (1, 2, 5) else 1
        for g in cand[:nm]:
            g['type'] = 'mine'
        # cities: big, non-mountain, away from capital
        capg = next(g for g in ks if g['type'] == 'capital')
        cand = sorted([g for g in free() if g['terrain'] != 'mountains'],
                      key=lambda g: -(g['area'] / 1000 + 0.06 * math.hypot(g['cx'] - capg['cx'], g['cy'] - capg['cy'])
                                     + 8 * g['river']))
        ncity = 2 if len(ks) >= 10 or not any(g['type'] == 'port' for g in regs if g['kingdom'] == k) else 1
        picked = []
        for g in cand:
            if len(picked) >= ncity:
                break
            if any(regs[j]['type'] in ('city', 'capital') for j in adj[g['id']]) and len(cand) > 4:
                continue
            g['type'] = 'city'
            picked.append(g)
        rest = free()
        rest.sort(key=lambda g: -(g['area'] + 4000 * g['river'] + 3000 * g['coastal'] - 5000 * (g['terrain'] == 'mountains')))
        for i, g in enumerate(rest):
            g['type'] = 'town' if i < (len(rest) + 1) // 2 else 'village'
    for g in regs:
        if g['type'] is None:
            g['type'] = 'village' if g['area'] < 6000 else 'town'
    return regs


def assign_names(regs):
    pools = {k: {key: list(v) if isinstance(v, list) else v for key, v in NAMES[k].items()} for k in NAMES}
    isl = list(ISLAND_NAMES)
    used = set()

    def take(lst):
        while lst:
            nm = lst.pop(0)
            if nm not in used:
                used.add(nm)
                return nm
        return None

    order = sorted(regs, key=lambda g: ['capital', 'port', 'mine', 'industrial', 'city', 'town', 'village'].index(g['type']))
    for g in order:
        k = g['kingdom']
        pl = pools[k]
        nm = None
        if g['type'] == 'capital':
            nm = pl['capital']; used.add(nm)
        elif g['island'] and g['type'] != 'port':
            nm = take(isl)
        elif g['type'] == 'port':
            nm = take(pl['port'])
        elif g['type'] == 'mine':
            nm = take(pl['mine'])
        if nm is None and g['terrain'] == 'mountains':
            nm = take(pl['mountain'])
        if nm is None and g['terrain'] == 'marsh' and 'Sazlıdelta' in pl['generic']:
            pl['generic'].remove('Sazlıdelta'); nm = 'Sazlıdelta'; used.add(nm)
        if nm is None:
            nm = take(pl['generic']) or take(pl['mountain']) or take(pl['port']) or take(pl['mine']) or take(isl)
        if nm is None:
            nm = f'Bölge {g["id"]}'
        g['name'] = nm
    return regs


def anchors(R, regs, rk):
    for g in regs:
        m = R == g['id']
        prefer = None
        if g.get('contains_capital'):
            prefer = CAPITALS[g['kingdom']]
        x, y, dt = pole(m, prefer)
        if prefer is not None:
            px, py = prefer
            if m[py, px] and dt[py, px] >= 10:
                x, y = px, py
        g['cx'], g['cy'] = float(x), float(y)
        g['dtmax'] = float(dt.max())
        # label: below the settlement if possible
        best = None
        ys, xs = np.nonzero(m & (dt >= 7))
        if len(xs) == 0:
            ys, xs = np.nonzero(m)
        dd = np.hypot(xs - x, ys - y)
        below = ys - y
        score = np.minimum(dt[ys, xs], 16) * 1.0 - np.abs(dd - 26) * 0.35 + np.clip(below, -10, 10) * 0.5
        score[dd < 18] -= 100
        i = int(np.argmax(score))
        g['x'], g['y'] = float(xs[i]), float(ys[i])
    return regs


def compute_edges(regs, adj, bch, feats, rdist):
    edges = []
    n = len(regs)
    for a in range(n):
        for b in sorted(adj[a]):
            if b <= a:
                continue
            cs = bch.get((a, b), [])
            pts_all = np.vstack([c['raw'] for c in cs])
            d = path_d([c['pts_s'] for c in cs], close=False)
            xi = np.clip(pts_all[:, 0].astype(int), 0, W - 1)
            yi = np.clip(pts_all[:, 1].astype(int), 0, H - 1)
            frac = float((rdist[yi, xi] <= 4).mean())
            ga, gb = regs[a], regs[b]
            t = np.linspace(0, 1, 60)
            sx = np.clip((ga['cx'] + (gb['cx'] - ga['cx']) * t).astype(int), 0, W - 1)
            sy = np.clip((ga['cy'] + (gb['cy'] - ga['cy']) * t).astype(int), 0, H - 1)
            cross = bool((rdist[sy, sx] <= 1.5).any())
            el = feats['elev'][yi, xi]
            edges.append(dict(a=a, b=b, d=d, river=bool(frac >= 0.3 or cross), bridge=False, pass_=False,
                              length=len(pts_all), elev=float(np.percentile(el, 25)), pts=pts_all))
    return edges


def pick_bridges_passes(regs, edges, adj):
    rank = dict(capital=4, city=3, port=2, industrial=2, town=2, mine=1, village=1)
    riv = [e for e in edges if e['river']]
    riv.sort(key=lambda e: -(rank[regs[e['a']]['type']] + rank[regs[e['b']]['type']] + 0.002 * e['length']))
    for e in riv[:max(1, (len(riv) + 1) // 2)]:
        e['bridge'] = True
    eidx = {}
    for e in edges:
        eidx.setdefault(e['a'], []).append(e)
        eidx.setdefault(e['b'], []).append(e)
    ismtn = lambda r: regs[r]['terrain'] == 'mountains'

    def npass(r):
        return sum(e['pass_'] for e in eidx.get(r, []))
    mtn = sorted([g for g in regs if ismtn(g['id']) and not g['island']], key=lambda g: -g['elevation'])
    for g in mtn:
        if npass(g['id']) >= 1:
            continue
        es = eidx.get(g['id'], [])
        if not es:
            continue
        oth = lambda e: e['b'] if e['a'] == g['id'] else e['a']
        es = sorted(es, key=lambda e: (ismtn(oth(e)) and npass(oth(e)) >= 2, e['elev']))
        es[0]['pass_'] = True
    return edges


def passable(e, regs):
    return not (regs[e['a']]['terrain'] == 'mountains' and regs[e['b']]['terrain'] == 'mountains' and not e['pass_'])


def ensure_mountain_connectivity(regs, edges):
    """Mountain-mountain borders without a pass block movement; add passes until the land graph is connected,
    then trim surplus passes so every mountain region keeps 1-2."""
    n = len(regs)

    def comps(skip=None):
        parent = list(range(n))

        def f(x):
            while parent[x] != x:
                parent[x] = parent[parent[x]]
                x = parent[x]
            return x
        for e in edges:
            if e is not skip and passable(e, regs):
                parent[f(e['a'])] = f(e['b'])
        return f

    def npass(r):
        return sum(e['pass_'] for e in edges if r in (e['a'], e['b']))
    ismtn = lambda r: regs[r]['terrain'] == 'mountains'
    while True:
        f = comps()
        blocked = [e for e in edges if not passable(e, regs) and f(e['a']) != f(e['b'])]
        if not blocked:
            break
        blocked.sort(key=lambda e: (max(npass(e['a']), npass(e['b'])) >= 2, e['elev']))
        blocked[0]['pass_'] = True
    base = len({comps()(i) for i in range(n)})
    changed = True
    while changed:
        changed = False
        for e in sorted([e for e in edges if e['pass_']], key=lambda e: -e['elev']):
            a, b = e['a'], e['b']
            if max(npass(a) if ismtn(a) else 0, npass(b) if ismtn(b) else 0) <= 2:
                continue
            if (ismtn(a) and npass(a) <= 1) or (ismtn(b) and npass(b) <= 1):
                continue
            e['pass_'] = False
            if len({comps()(i) for i in range(n)}) > base:
                e['pass_'] = True
                continue
            changed = True
    for g in regs:
        g['pass'] = g['terrain'] == 'mountains' and npass(g['id']) > 0


# ---------------------------------------------------------------- sea routes
def sea_routes(R, regs, adj, open_sea, off):
    f = 2
    h2, w2 = H // f, W // f
    water = open_sea & ~off
    w2m = cv2.resize(water.astype(np.uint8), (w2, h2), interpolation=cv2.INTER_NEAREST).astype(bool)
    WL2, _ = ndi.label(w2m, structure=np.ones((3, 3)))
    csz = np.bincount(WL2.ravel())
    csz[0] = 0
    w2m = np.isin(WL2, np.where(csz >= 1500)[0])
    main_water = np.zeros((H, W), bool)
    up = np.repeat(np.repeat(w2m, f, 0), f, 1)
    main_water[:up.shape[0], :up.shape[1]] = up
    water &= main_water
    land2 = ~w2m
    dland = ndi.distance_transform_edt(~land2)
    cost = np.where(w2m, 1.0 + 5.0 * np.exp(-dland / 5.0), np.inf).astype(float)
    cost[~w2m] = -1   # MCP treats negative as impassable
    coastal = [g for g in regs if g['coastal']]
    # harbour point for each coastal region: open water 7-12px off its coast, nearest to the settlement
    dist_land_full = ndi.distance_transform_edt(~(R >= 0))
    for g in coastal:
        m = R == g['id']
        near = cv2.dilate(m.astype(np.uint8), disk(14)).astype(bool) & water & (dist_land_full >= 6)
        ys, xs = np.nonzero(near)
        if len(xs) == 0:
            g['hp'] = None
            continue
        i = int(np.argmin(np.hypot(xs - g['cx'], ys - g['cy'])))
        g['hp'] = (int(xs[i]), int(ys[i]))
    coastal = [g for g in coastal if g['hp'] is not None]
    if DEBUG:
        v = np.zeros((H, W, 3), np.uint8)
        v[R >= 0] = (60, 120, 60)
        v[water] = (160, 90, 30)
        v[open_sea & ~water] = (80, 40, 10)
        for g in coastal:
            cv2.circle(v, g['hp'], 4, (0, 255, 255), -1)
            cv2.putText(v, str(g['id']), g['hp'], 0, 0.4, (255, 255, 255), 1)
        dbg('07_sea.png', v)
    mcp_cache = {}

    def route(ga, gb):
        key = ga['id']
        if key not in mcp_cache:
            mcp = MCP_Geometric(cost, fully_connected=True)
            sy, sx = ga['hp'][1] // f, ga['hp'][0] // f
            if not w2m[sy, sx]:
                ys, xs = np.nonzero(w2m)
                i = np.argmin((ys - sy) ** 2 + (xs - sx) ** 2); sy, sx = ys[i], xs[i]
            cum, _ = mcp.find_costs([(sy, sx)])
            mcp_cache[key] = (mcp, cum)
        mcp, cum = mcp_cache[key]
        ty, tx = gb['hp'][1] // f, gb['hp'][0] // f
        if not w2m[ty, tx]:
            ys, xs = np.nonzero(w2m)
            i = np.argmin((ys - ty) ** 2 + (xs - tx) ** 2); ty, tx = ys[i], xs[i]
        if not np.isfinite(cum[ty, tx]):
            return None, 1e9
        tb = mcp.traceback((ty, tx))
        pts = np.array([(x * f + 1, y * f + 1) for y, x in tb], float)[::-1]
        L = float(np.linalg.norm(np.diff(pts, axis=0), axis=1).sum())
        return pts, L

    links = {}

    def add(ga, gb):
        a, b = sorted((ga['id'], gb['id']))
        if (a, b) in links:
            return False
        pts, L = route(ga, gb)
        if pts is None:
            return False
        links[(a, b)] = (pts, L)
        return True

    # islands: link by real sailing distance (own kingdom & ports preferred), big islands get 2 links
    for g in coastal:
        if not g['island']:
            continue
        others = [o for o in coastal if o['id'] != g['id']]
        others.sort(key=lambda o: math.hypot(o['hp'][0] - g['hp'][0], o['hp'][1] - g['hp'][1]))
        sc = []
        for o in others[:10]:
            pts, L = route(g, o)
            if pts is None:
                continue
            sc.append((L * (0.8 if o['kingdom'] == g['kingdom'] else 1.0) * (0.75 if o['type'] in ('port', 'capital') else 1.0)
                       * (1.5 if o['island'] else 1.0), L, o, pts))
        sc.sort(key=lambda t: t[0])
        want = 2 if g['area'] > 8000 else 1
        got = 0
        for _, L, o, pts in sc:
            if got >= want:
                break
            if got >= 1 and L > 260:
                break
            a_, b_ = sorted((g['id'], o['id']))
            if (a_, b_) not in links:
                links[(a_, b_)] = (pts, L)
            got += 1
    # coastal routes: first between kingdoms (ports strongly preferred), then long same-kingdom shortcuts
    main_coast = list(coastal)
    deg = {}
    kpair = {}
    n_routes = 0

    def try_pairs(cands, maxL, limit):
        nonlocal n_routes
        cands.sort(key=lambda t: t[0])
        for _, ga, gb in cands:
            if n_routes >= limit:
                break
            if deg.get(ga['id'], 0) >= 2 or deg.get(gb['id'], 0) >= 2:
                continue
            kp = tuple(sorted((ga['kingdom'], gb['kingdom'])))
            if kpair.get(kp, 0) >= 2:
                continue
            a_, b_ = sorted((ga['id'], gb['id']))
            if (a_, b_) in links:
                continue
            pts, L = route(ga, gb)
            if pts is None or L > maxL:
                continue
            links[(a_, b_)] = (pts, L)
            deg[ga['id']] = deg.get(ga['id'], 0) + 1
            deg[gb['id']] = deg.get(gb['id'], 0) + 1
            kpair[kp] = kpair.get(kp, 0) + 1
            n_routes += 1

    cands = []
    for i, ga in enumerate(main_coast):
        for gb in main_coast[i + 1:]:
            if ga['kingdom'] == gb['kingdom']:
                continue
            d = math.hypot(ga['hp'][0] - gb['hp'][0], ga['hp'][1] - gb['hp'][1])
            if d > 330 or d < 60:
                continue
            np_ = (ga['type'] == 'port') + (gb['type'] == 'port')
            cands.append((d * (1.0, 0.6, 0.35)[np_] * (1.7 if gb['id'] in adj[ga['id']] else 1.0), ga, gb))
    try_pairs(cands, 430, 9)
    cands = []
    for i, ga in enumerate(main_coast):
        for gb in main_coast[i + 1:]:
            if ga['kingdom'] != gb['kingdom'] or gb['id'] in adj[ga['id']]:
                continue
            if 'port' not in (ga['type'], gb['type']) or ga['island'] or gb['island']:
                continue
            d = math.hypot(ga['hp'][0] - gb['hp'][0], ga['hp'][1] - gb['hp'][1])
            if d < 150 or d > 330:
                continue
            cands.append((d * (0.6 if ga['type'] == gb['type'] == 'port' else 1.0), ga, gb))
    try_pairs(cands, 340, 7)
    print('  coastal sea routes:', n_routes)
    out = []
    landm = R >= 0
    for (a, b), (pts, L) in sorted(links.items()):
        ga, gb = regs[a], regs[b]
        # full route: settlement-side harbour point -> water path -> other harbour point
        ha = np.array(regs[a]['hp'], float); hb = np.array(regs[b]['hp'], float)
        if np.linalg.norm(pts[0] - ha) > np.linalg.norm(pts[0] - hb):
            pts = pts[::-1]
        pts = np.vstack([ha, pts[1:-1], hb]) if len(pts) > 2 else np.vstack([ha, hb])
        d = None
        for eps in (6, 4, 2.5, 1.5):
            sp = dp_simplify(pts, eps)
            curve = bezier_sample(sp)
            xi = np.clip(curve[:, 0].astype(int), 0, W - 1)
            yi = np.clip(curve[:, 1].astype(int), 0, H - 1)
            if not landm[yi, xi].any():
                d = catmull(sp)
                break
        if d is None:
            d = 'M' + ' '.join(f'{fmt(x)},{fmt(y)}' for x, y in dp_simplify(pts, 1.0))
        out.append([a, b, d, L])
    return out


def roads(regs, edges):
    out = []
    for e in edges:
        if not passable(e, regs):
            continue
        ga, gb = regs[e['a']], regs[e['b']]
        A = np.array([ga['cx'], ga['cy']]); B = np.array([gb['cx'], gb['cy']])
        pts = e['pts']
        sc = np.linalg.norm(pts - A, axis=1) + np.linalg.norm(pts - B, axis=1)
        M = pts[int(np.argmin(sc))]
        out.append(dict(a=e['a'], b=e['b'], d=catmull([A, M, B], tension=0.6)))
    return out

# ---------------------------------------------------------------- terrain art
def label_mask(img):
    """Per-label masks of the baked crests and kingdom names (incl. their dark glow)."""
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    Hh, S, V = [hsv[..., i].astype(int) for i in range(3)]
    bright = ((V > 165) & (S < 140)) | ((Hh >= 12) & (Hh <= 35) & (S > 80) & (V > 140))
    masks = []
    for i, (cb, tb) in enumerate(zip(CREST_BOXES, TEXT_BOXES)):
        m = np.zeros((H, W), np.uint8)
        x0, y0, x1, y1 = cb
        sub = bright[y0:y1, x0:x1].astype(np.uint8)
        ys, xs = np.nonzero(sub)
        if len(xs) >= 20:
            hull = cv2.convexHull(np.stack([xs + x0, ys + y0], 1).astype(np.int32))
            cv2.fillPoly(m, [hull], 1)
        m = cv2.dilate(m, disk(12))
        masks.append((i, m.astype(bool)))
        m = np.zeros((H, W), np.uint8)
        x0, y0, x1, y1 = tb
        sub = bright[y0:y1, x0:x1].astype(np.uint8)
        sub = cv2.morphologyEx(sub, cv2.MORPH_CLOSE, disk(4))
        m[y0:y1, x0:x1] |= sub
        m = cv2.dilate(m, disk(12))
        m = cv2.morphologyEx(m, cv2.MORPH_CLOSE, disk(9))
        masks.append((i, m.astype(bool) & ~masks[-1][1]))
    return masks


def border_line_mask(img, K):
    """Painted kingdom border lines (gold line + coloured rims) along the edges of the painted bodies."""
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)
    Hh, S, V = [hsv[..., i].astype(int) for i in range(3)]
    gold = ((Hh >= 10) & (Hh <= 36) & (S > 60) & (V > 150)) | ((V > 195) & (S > 140))
    land = K >= 0
    P = kingdom_paint(cv2.cvtColor(cv2.GaussianBlur(img, (3, 3), 0), cv2.COLOR_BGR2HSV))
    bd = np.zeros((H, W), bool)
    for k in range(6):
        body = cv2.morphologyEx((P[k] & land).astype(np.uint8), cv2.MORPH_CLOSE, disk(5))
        body = cv2.morphologyEx(body, cv2.MORPH_OPEN, disk(4))
        body = ndi.binary_fill_holes(body)
        L, n = ndi.label(body)
        if n:
            sz = ndi.sum(body, L, range(1, n + 1))
            body = np.isin(L, 1 + np.where(sz >= 2500)[0])
        bd |= cv2.morphologyEx(body.astype(np.uint8), cv2.MORPH_GRADIENT, disk(1)).astype(bool)
    inner = cv2.erode((land | offmap_mask()).astype(np.uint8), disk(10)).astype(bool)
    bd &= inner
    dist = ndi.distance_transform_edt(~bd)
    band = dist <= 7
    ev = ndi.uniform_filter((gold & band).astype(np.float32), 21) / np.maximum(ndi.uniform_filter(band.astype(np.float32), 21), 1e-3)
    m = band & (ev > 0.08) & (dist <= 6)
    return m


def shifted_detail(img, mask, shifts=((15, 11), (-15, -11), (13, -14), (-13, 14))):
    """High-frequency detail for masked pixels, copied from an unmasked shifted neighbour."""
    f = img.astype(np.float32)
    hp = f - cv2.GaussianBlur(f, (0, 0), 3)
    out = np.zeros_like(hp)
    have = np.zeros((H, W), bool)
    for dx, dy in shifts:
        M = np.float32([[1, 0, dx], [0, 1, dy]])
        sh = cv2.warpAffine(hp, M, (W, H), borderMode=cv2.BORDER_REFLECT)
        shm = cv2.warpAffine(mask.astype(np.uint8), M, (W, H), borderValue=1).astype(bool)
        take = mask & ~have & ~shm
        out[take] = sh[take]
        have |= take
    return out


def clean_art(img, K):
    """Remove crests/labels (patch + Poisson clone) and painted border lines (inpaint + detail)."""
    out = img.copy()
    lms = label_mask(img)
    allm = np.zeros((H, W), bool)
    for _, m in lms:
        allm |= m
    rs = np.random.RandomState(SEED)
    bm0 = cv2.dilate(border_line_mask(img, K).astype(np.uint8), disk(4)).astype(bool)
    for i, m in lms:
        ys, xs = np.nonzero(m)
        y0, y1, x0, x1 = ys.min(), ys.max() + 1, xs.min(), xs.max() + 1
        hgt, wid = y1 - y0, x1 - x0
        k = KINGDOMS[i]['id']
        kmask = K == k
        best = None
        src_m = m[y0:y1, x0:x1]
        ring = cv2.dilate(m.astype(np.uint8), disk(40)).astype(bool) & ~cv2.dilate(m.astype(np.uint8), disk(14)).astype(bool) & ~allm & (K == k)
        ring_col = img[ring].astype(np.float32).mean(0)
        ring_std = img[ring].astype(np.float32).std()
        for _ in range(2500):
            dx = int(rs.randint(-320, 321)); dy = int(rs.randint(-240, 241))
            sy0, sx0 = y0 + dy, x0 + dx
            if sy0 < 0 or sx0 < 0 or sy0 + hgt > H or sx0 + wid > W or (abs(dx) < wid and abs(dy) < hgt):
                continue
            if allm[sy0:sy0 + hgt, sx0:sx0 + wid][src_m].any():
                continue
            if (K[sy0:sy0 + hgt, sx0:sx0 + wid][src_m] < 0).mean() > 0.01:
                continue
            ink = kmask[sy0:sy0 + hgt, sx0:sx0 + wid][src_m].mean()
            if ink < 0.5:
                continue
            patch = img[sy0:sy0 + hgt, sx0:sx0 + wid]
            pf = patch[src_m].astype(np.float32)
            cdiff = np.abs(pf.mean(0) - ring_col).sum()
            towns = (pf.max(-1) > 215).mean()
            lines = bm0[sy0:sy0 + hgt, sx0:sx0 + wid][src_m].mean()
            ph = cv2.cvtColor(patch, cv2.COLOR_BGR2HSV)[src_m]
            goldf = ((ph[:, 0] >= 12) & (ph[:, 0] <= 36) & (ph[:, 1] > 70) & (ph[:, 2] > 160)).mean() if k != 4 else 0
            sdiff = abs(pf.std() - ring_std)
            sc = cdiff + 1.5 * sdiff + 400 * towns + 4000 * lines + 2500 * goldf + 60 * (1 - ink)
            if best is None or sc < best[0]:
                best = (sc, sy0, sx0)
        if best is None:
            continue
        _, sy0, sx0 = best
        src = img[sy0:sy0 + hgt, sx0:sx0 + wid].copy()
        pm = (m[y0:y1, x0:x1].astype(np.uint8) * 255)
        pm = cv2.dilate(pm, disk(2))
        pad = 4
        srcp = cv2.copyMakeBorder(src, pad, pad, pad, pad, cv2.BORDER_REFLECT)
        pmp = cv2.copyMakeBorder(pm, pad, pad, pad, pad, cv2.BORDER_CONSTANT, value=0)
        center = (int(x0 + wid / 2), int(y0 + hgt / 2))
        try:
            out = cv2.seamlessClone(srcp, out, pmp, center, cv2.NORMAL_CLONE)
        except cv2.error:
            out[y0:y1, x0:x1][m[y0:y1, x0:x1]] = src[m[y0:y1, x0:x1]]
    # stray gold fragments (pieces of cloned border lines) around the removed labels
    hz = cv2.cvtColor(out, cv2.COLOR_BGR2HSV).astype(int)
    stray = (hz[..., 0] >= 12) & (hz[..., 0] <= 36) & (hz[..., 1] > 50) & (hz[..., 2] > 140) & (K != 4) & (K >= 0)
    stray |= (hz[..., 0] <= 36) & (hz[..., 1] > 150) & (hz[..., 2] > 175) & (K != 4) & (K >= 0)
    stray &= cv2.dilate(allm.astype(np.uint8), disk(6)).astype(bool)
    stray = cv2.dilate(stray.astype(np.uint8), disk(2))
    out = cv2.inpaint(out, stray * 255, 4, cv2.INPAINT_TELEA)
    bm = border_line_mask(out, K) & ~allm
    base = cv2.inpaint(out, bm.astype(np.uint8) * 255, 4, cv2.INPAINT_TELEA).astype(np.float32)
    det = shifted_detail(out, bm)
    soft = cv2.GaussianBlur(bm.astype(np.float32), (0, 0), 1.0)[..., None]
    filled = np.clip(base + det * 0.9, 0, 255)
    res = out.astype(np.float32) * (1 - soft) + filled * soft
    return np.clip(res, 0, 255).astype(np.uint8), allm | bm


# per kingdom: (source hue centre, hue band half-width, target hue, hue compression, sat scale, value scale)
RECOLOR = {
    0: (2, 14, 22, 0.30, 0.48, 0.97),     # kızıl -> sıcak zeytin / kahve-yeşil
    1: (112, 16, 62, 0.25, 0.17, 0.92),   # mavi -> serin arduvaz-yeşil
    2: (145, 22, 125, 0.25, 0.14, 1.05),  # mor -> gri / leylak-gri kaya
    3: (55, 30, 50, 0.85, 0.80, 1.00),    # yeşil kalır, biraz soluk
    4: (23, 10, 22, 0.90, 0.78, 0.98),    # altın tarla, biraz soluk
    5: (12, 9, 18, 0.50, 0.62, 1.00),     # bakır -> aşı boyası / kum
}


def recolor(img, K):
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV).astype(np.float32)
    Hh, S, V = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    out = img.astype(np.float32)
    # thin painted rims of every kingdom along the political borders (also on the neighbour's side)
    bd = np.zeros((H, W), bool)
    for dy, dx in ((0, 1), (1, 0)):
        a_ = K[:H - dy, :W - dx]; b_ = K[dy:, dx:]
        e = (a_ >= 0) & (b_ >= 0) & (a_ != b_)
        bd[:H - dy, :W - dx] |= e
    border_zone = ndi.gaussian_filter(cv2.dilate(bd.astype(np.uint8), disk(16)).astype(np.float32), 4)
    for k, (hc, hw, ht, comp, ss, vs) in RECOLOR.items():
        prox = ndi.gaussian_filter(cv2.dilate((K == k).astype(np.uint8), disk(14)).astype(np.float32), 7)
        if k in (0, 1, 2):
            prox = np.maximum(prox, border_zone * 0.9)
        dh = (Hh - hc + 90) % 180 - 90
        band = np.clip(1.0 - (np.abs(dh) - hw) / 8.0, 0, 1)
        satw = np.clip((S - 35) / 50.0, 0, 1)
        w = prox * band * satw
        nh = (ht + dh * comp) % 180
        ns = np.clip(S * ss, 0, 255)
        nv = np.clip(V * vs, 0, 255)
        new = cv2.cvtColor(np.stack([nh, ns, nv], -1).astype(np.uint8), cv2.COLOR_HSV2BGR).astype(np.float32)
        out = out * (1 - w[..., None]) + new * w[..., None]
    # painted gold roads / rims inside the highland kingdoms -> muted dirt tracks
    hsv2 = cv2.cvtColor(out.astype(np.uint8), cv2.COLOR_BGR2HSV).astype(np.float32)
    hl = ndi.gaussian_filter(((K == 1) | (K == 2) | (K == 0)).astype(np.float32), 6)
    warm = np.clip(1 - np.abs(hsv2[..., 0] - 17) / 10, 0, 1) * np.clip((hsv2[..., 1] - 60) / 60, 0, 1) * hl
    hsv2[..., 1] *= 1 - 0.55 * warm
    out = cv2.cvtColor(np.clip(hsv2, 0, 255).astype(np.uint8), cv2.COLOR_HSV2BGR).astype(np.float32)
    land = ndi.gaussian_filter((K >= 0).astype(np.float32), 3)[..., None]
    g = out.mean(-1, keepdims=True)
    graded = (out * 0.9 + g * 0.1) * np.array([0.97, 1.0, 1.02])
    out = out * (1 - land) + graded * land
    return np.clip(out, 0, 255).astype(np.uint8)


def write_art(img, art, K, R, regs, feats, sea_mask):
    os.makedirs(OUT_ASSETS, exist_ok=True)
    big = cv2.resize(art, (W * 2, H * 2), interpolation=cv2.INTER_LANCZOS4)
    blur = cv2.GaussianBlur(big, (0, 0), 1.6)
    big = cv2.addWeighted(big, 1.35, blur, -0.35, 0)
    cv2.imencode('.jpg', big, [cv2.IMWRITE_JPEG_QUALITY, 84, cv2.IMWRITE_JPEG_OPTIMIZE, 1, cv2.IMWRITE_JPEG_PROGRESSIVE, 1])[1].tofile(
        os.path.join(OUT_ASSETS, 'terrain.jpg'))
    cv2.imencode('.jpg', art, [cv2.IMWRITE_JPEG_QUALITY, 78, cv2.IMWRITE_JPEG_OPTIMIZE, 1])[1].tofile(
        os.path.join(OUT_ASSETS, 'terrain-small.jpg'))
    land = (R >= 0)
    landf = cv2.GaussianBlur(land.astype(np.float32), (0, 0), 0.8)
    # snow: high mountains strongly, hills lightly, lowlands a faint dusting
    terr = np.zeros((H, W), np.float32)
    for g in regs:
        terr[R == g['id']] = {'mountains': 1.0, 'hills': 0.5, 'forest': 0.16, 'desert': 0.06}.get(g['terrain'], 0.12)
    terr = ndi.gaussian_filter(terr, 6)
    rockpx = ndi.gaussian_filter((feats['rock'] | feats['snow']).astype(np.float32), 1.2)
    elev = np.clip(feats['elev'] * 1.5, 0, 1)
    a = terr * (0.22 + 0.78 * rockpx) * (0.35 + 0.65 * elev)
    a = np.clip(a * 1.15, 0, 0.92)
    # frame mountains outside the playable land also get snow
    a = np.maximum(a * landf, np.clip(rockpx * elev, 0, 0.85) * (1 - landf) * ~sea_mask)
    snow = np.dstack([np.full((H, W), 255, np.uint8)] * 3 + [(a * 255).astype(np.uint8)])
    cv2.imwrite(os.path.join(OUT_ASSETS, 'snow.png'), cv2.cvtColor(snow, cv2.COLOR_RGBA2BGRA))
    fo = ndi.gaussian_filter(feats['trees'].astype(np.float32), 1.5)
    fo = np.clip(fo * 1.6, 0, 1) * landf
    forest = np.dstack([np.full((H, W), 40, np.uint8), np.full((H, W), 110, np.uint8), np.full((H, W), 40, np.uint8),
                        (fo * 255).astype(np.uint8)])
    cv2.imwrite(os.path.join(OUT_ASSETS, 'forest.png'), cv2.cvtColor(forest, cv2.COLOR_RGBA2BGRA))
    landpng = np.dstack([np.full((H, W), 255, np.uint8)] * 3 + [(landf * 255).astype(np.uint8)])
    cv2.imwrite(os.path.join(OUT_ASSETS, 'land.png'), cv2.cvtColor(landpng, cv2.COLOR_RGBA2BGRA))
    return art


# ---------------------------------------------------------------- output
def write_js(regs, adj, edges, sea, coast_d, rivers, roads_, klabels):
    R_OUT = []
    for g in regs:
        R_OUT.append(dict(id=g['id'], name=g['name'], kingdom=g['kingdom'], type=g['type'], terrain=g['terrain'],
                          coastal=bool(g['coastal']), x=round(g['x'], 1), y=round(g['y'], 1),
                          cx=round(g['cx'], 1), cy=round(g['cy'], 1), d=g['d'], area=int(g['area']),
                          pop=int(g['pop']), fort=int(g['fort']), river=bool(g['river']), **{'pass': bool(g['pass'])},
                          elevation=round(g['elevation'], 2)))
    E_OUT = [dict(a=e['a'], b=e['b'], d=e['d'], river=e['river'], bridge=e['bridge'], **{'pass': e['pass_']})
             for e in edges]
    j = lambda o: json.dumps(o, ensure_ascii=False, separators=(',', ':'))
    lines = ['// Otomatik üretildi: tools/generate-map-v3.py — elle düzenlemeyin.',
             f'export const MAP_W = {W}, MAP_H = {H};',
             "export const MAP_IMAGE = { src: 'assets/map/terrain.jpg', small: 'assets/map/terrain-small.jpg', "
             "snow: 'assets/map/snow.png', forest: 'assets/map/forest.png' };",
             'export const REGIONS = [\n' + ',\n'.join(j(r) for r in R_OUT) + '\n];',
             'export const ADJ = ' + j([sorted(a) for a in adj]) + ';',
             'export const EDGES = [\n' + ',\n'.join(j(e) for e in E_OUT) + '\n];',
             'export const SEA_LINKS = [\n' + ',\n'.join(j(sl[:3]) for sl in sea) + '\n];',
             'export const COAST = ' + j(coast_d) + ';',
             'export const RIVERS = [\n' + ',\n'.join(j(r) for r in rivers) + '\n];',
             'export const ROADS = [\n' + ',\n'.join(j(r) for r in roads_) + '\n];',
             'export const KINGDOM_LABELS = ' + j(klabels) + ';',
             '']
    os.makedirs(os.path.dirname(OUT_JS), exist_ok=True)
    with open(OUT_JS, 'w', encoding='utf-8', newline='\n') as fh:
        fh.write('\n'.join(lines))


def svg_path_points(d):
    """Rough sampler for M/L/C/Z paths (preview only)."""
    import re
    toks = re.findall(r'[MLCZ]|-?\d+(?:\.\d+)?', d)
    polys, cur, i, cmd = [], [], 0, None
    nums = []
    while i < len(toks):
        t = toks[i]
        if t in 'MLCZ':
            cmd = t
            if t == 'M':
                if cur:
                    polys.append(cur)
                cur = []
            if t == 'Z':
                if cur:
                    cur.append(cur[0]); polys.append(cur); cur = []
            i += 1
            continue
        if cmd in ('M', 'L'):
            cur.append((float(toks[i]), float(toks[i + 1]))); i += 2
        elif cmd == 'C':
            c1 = (float(toks[i]), float(toks[i + 1])); c2 = (float(toks[i + 2]), float(toks[i + 3]))
            p2 = (float(toks[i + 4]), float(toks[i + 5])); i += 6
            p1 = cur[-1]
            for t_ in np.linspace(0, 1, 10)[1:]:
                cur.append(tuple((1 - t_) ** 3 * np.array(p1) + 3 * (1 - t_) ** 2 * t_ * np.array(c1)
                                 + 3 * (1 - t_) * t_ * t_ * np.array(c2) + t_ ** 3 * np.array(p2)))
        else:
            i += 1
    if cur:
        polys.append(cur)
    return [np.array(p) for p in polys if len(p) > 1]


def write_preview(art, regs, edges, sea, rivers, roads_, klabels):
    s_ = 1.0
    pv = art.copy()
    from PIL import Image, ImageDraw, ImageFont
    kc = [(200, 50, 50), (50, 90, 220), (150, 60, 190), (40, 150, 50), (220, 180, 30), (220, 110, 30)]
    im = Image.fromarray(cv2.cvtColor(pv, cv2.COLOR_BGR2RGB)).convert('RGBA')
    ov = Image.new('RGBA', im.size, (0, 0, 0, 0))
    dr = ImageDraw.Draw(ov)
    for g in regs:
        for poly in svg_path_points(g['d']):
            dr.polygon([tuple(p) for p in poly], fill=kc[g['kingdom']] + (70,))
    for r in rivers:
        for poly in svg_path_points(r['d']):
            dr.line([tuple(p) for p in poly], fill=(60, 170, 255, 255), width=r['w'])
    for rd in roads_:
        for poly in svg_path_points(rd['d']):
            dr.line([tuple(p) for p in poly], fill=(120, 80, 40, 150), width=1)
    for e in edges:
        col = (255, 255, 255, 255) if e['pass_'] else ((70, 160, 255, 255) if e['river'] else (20, 20, 20, 230))
        w = 3 if (e['pass_'] or e['river']) else 2
        for poly in svg_path_points(e['d']):
            dr.line([tuple(p) for p in poly], fill=col, width=w)
    for g in regs:
        for poly in svg_path_points(g['d']):
            if g['coastal']:
                pass
    for a, b, d, L in sea:
        for poly in svg_path_points(d):
            pts = [tuple(p) for p in poly]
            # dashed
            acc = 0
            for p0, p1 in zip(pts[:-1], pts[1:]):
                seg = math.hypot(p1[0] - p0[0], p1[1] - p0[1])
                if int(acc / 7) % 2 == 0:
                    dr.line([p0, p1], fill=(255, 255, 255, 230), width=2)
                acc += seg
    try:
        font = ImageFont.truetype('arial.ttf', 11)
        fontb = ImageFont.truetype('arialbd.ttf', 22)
    except Exception:
        font = fontb = ImageFont.load_default()
    for g in regs:
        cx, cy = g['cx'], g['cy']
        rad = {'capital': 6, 'city': 5, 'port': 4, 'industrial': 4}.get(g['type'], 3)
        fillc = {'capital': (255, 215, 0), 'city': (255, 255, 255), 'port': (80, 200, 255), 'industrial': (255, 120, 40),
                 'mine': (160, 160, 160), 'town': (230, 230, 200), 'village': (180, 160, 120)}[g['type']]
        dr.ellipse([cx - rad, cy - rad, cx + rad, cy + rad], fill=fillc + (255,), outline=(0, 0, 0, 255))
        txt = f"{g['id']} {g['name']}"
        tw = dr.textlength(txt, font=font)
        dr.text((g['x'] - tw / 2, g['y'] - 6), txt, font=font, fill=(255, 255, 255, 255), stroke_width=2,
                stroke_fill=(0, 0, 0, 255))
        sub = f"{g['type'][:4]}/{g['terrain'][:4]}"
        tw = dr.textlength(sub, font=font)
        dr.text((g['x'] - tw / 2, g['y'] + 6), sub, font=font, fill=(255, 230, 150, 255), stroke_width=2,
                stroke_fill=(0, 0, 0, 255))
    for kl in klabels:
        nm = KINGDOMS[kl['kingdom']]['name']
        tw = dr.textlength(nm, font=fontb)
        dr.text((kl['x'] - tw / 2, kl['y'] - 11), nm, font=fontb, fill=(255, 245, 220, 200), stroke_width=2,
                stroke_fill=(40, 20, 0, 200))
    out = Image.alpha_composite(im, ov).convert('RGB')
    out.save(OUT_PREVIEW)


def main():
    img = load_src()
    land, water, sea, off, hsv = build_masks(img)
    P = kingdom_paint(hsv)
    K, play, mainland, isl = assign_kingdoms(land, P)
    rivers_raw, rmask, lakes = extract_rivers(hsv, land, sea, K)
    K[lakes] = -1
    Hh, S, V = [hsv[..., i].astype(int) for i in range(3)]
    ridge = ndi.gaussian_filter(((V > 185) & (S < 45)).astype(np.float32), 2)
    rline = np.zeros((H, W), np.uint8)
    for r in rivers_raw:
        cv2.polylines(rline, [np.round(r['pts']).astype(np.int32).reshape(-1, 1, 2)], False, 1, 1)
    rline = rline.astype(bool)
    rim = cv2.dilate(rline.astype(np.uint8), disk(3)).astype(np.float32)
    cost = (1.0 + 2.4 * smooth_noise((H, W), 6, SEED) ** 2 + 1.6 * smooth_noise((H, W), 18, SEED + 1)
            + 5.0 * rim + 2.0 * np.clip(ridge * 2, 0, 1)).astype(np.float32)
    areas = np.array([(K[mainland] == k).sum() for k in range(6)], float)
    counts = [int(np.clip(round(a / areas.sum() * 56), 8, 14)) for a in areas]
    print('kingdom mainland areas', areas.astype(int).tolist(), '-> regions', counts, '+ islands', len(isl))
    fixed = {k: [CAPITALS[k]] for k in range(6)}
    R, rk = partition(K, isl, cost, counts, fixed)
    R = fix_fragments(R, rk)
    R = smooth_labels(R, len(rk))
    R = fix_fragments(R, rk)
    R, rk, is_isl = renumber(R, rk, isl)
    n = len(rk)
    chains, rrings, coast_rings, blen, bch = vectorize(R, n)

    # open sea = water connected to the map frame (lakes excluded)
    wat = R < 0
    WL, _ = ndi.label(wat)
    frame_ids = set(np.unique(np.concatenate([WL[0], WL[-1], WL[:, 0], WL[:, -1]]))) - {0}
    open_sea = np.isin(WL, list(frame_ids))
    clean, cm = clean_art(img, K)
    art = recolor(clean, K)
    dbg('10_mask.png', np.where(cm[..., None], np.array([0, 0, 255], np.uint8), img))
    feats = feature_maps(art, cv2.cvtColor(art, cv2.COLOR_BGR2HSV))
    feats['forest'] = feature_maps(clean, cv2.cvtColor(clean, cv2.COLOR_BGR2HSV))['forest']
    feats['trees'] = forest_mask(art, R >= 0) | feats['forest']
    rdist = ndi.distance_transform_edt(~rline)

    regs, adj = build_regions(R, rk, is_isl, chains, blen, bch, feats, rline, open_sea, K)
    for k in range(6):
        cx, cy = CAPITALS[k]
        rid = R[cy, cx]
        assert rid >= 0 and rk[rid] == k, ('capital not inside its kingdom', k, rid)
        regs[rid]['contains_capital'] = True
    regs = anchors(R, regs, rk)
    regs = classify_terrain(regs, adj)
    regs = assign_types(regs, adj)
    regs = assign_names(regs)
    rng = np.random.RandomState(SEED)
    for g in regs:
        lo, hi = TYPE_POP[g['type']]
        t = np.clip((g['area'] - 9000) / 16000, 0, 1) * 0.65 + rng.rand() * 0.35
        g['pop'] = int(round(lo + (hi - lo) * t))
        g['d'] = path_d(rrings[g['id']])
    for k in range(6):
        towns = [g for g in regs if g['kingdom'] == k and g['type'] == 'town']
        towns.sort(key=lambda g: -sum(1 for j in adj[g['id']] if regs[j]['kingdom'] != k))
        border = [g for g in towns if any(regs[j]['kingdom'] != k for j in adj[g['id']])]
        for g in regs:
            if g['kingdom'] != k:
                continue
            g['fort'] = {'capital': 3, 'city': 2, 'port': 1, 'industrial': 1}.get(g['type'], 0)
        for g in border[:2]:
            g['fort'] = 1
    edges = compute_edges(regs, adj, bch, feats, rdist)
    edges = pick_bridges_passes(regs, edges, adj)
    ensure_mountain_connectivity(regs, edges)
    sea_links = sea_routes(R, regs, adj, open_sea, off)
    roads_ = roads(regs, edges)
    rivers = []
    for r in rivers_raw:
        sp = dp_simplify(r['pts'], 1.0)
        rivers.append(dict(d=catmull(sp), w=r['w']))
    coast_d = path_d(coast_rings)
    klabels = []
    kar = np.array([(K == k).sum() for k in range(6)], float)
    for kd in KINGDOMS:
        k = kd['id']
        x, y = kd['label']
        if not (0 <= y < H and 0 <= x < W and K[y, x] == k):
            x, y, _ = pole(K == k)
        klabels.append(dict(kingdom=k, x=float(x), y=float(y), size=int(round(20 + 12 * math.sqrt(kar[k] / kar.max())))))

    if DEBUG:
        for g in regs:
            print(f"   r{g['id']:2d} k{g['kingdom']} {g['terrain']:9s} {g['type']:10s} rock={g['rock']:.2f} snow={g['snow']:.2f} "
                  f"forest={g['forest']:.2f} farm={g['farm']:.2f} elev={g['elevation']:.2f} coast={g['coastal']} {g['name']}")
    report(regs, adj, edges, sea_links, rivers)
    write_art(img, art, K, R, regs, feats, sea)
    write_js(regs, adj, edges, sea_links, coast_d, rivers, roads_, klabels)
    write_preview(art, regs, edges, sea_links, rivers, roads_, klabels)
    print('wrote', OUT_JS, 'and assets in', OUT_ASSETS)


def report(regs, adj, edges, sea, rivers):
    n = len(regs)
    print(f'\n== {n} bölge ==')
    for k in range(6):
        ks = [g for g in regs if g['kingdom'] == k]
        ty = {}
        te = {}
        for g in ks:
            ty[g['type']] = ty.get(g['type'], 0) + 1
            te[g['terrain']] = te.get(g['terrain'], 0) + 1
        print(f"  {k} {KINGDOMS[k]['name']}: {len(ks)} bölge  tipler={ty}  arazi={te}")
    deg = [len(a) for a in adj]
    print('  kara komşuluk derece min/max:', min(deg[i] for i in range(n) if not regs[i]['island']), max(deg))
    print('  kenar:', len(edges), ' nehir:', sum(e['river'] for e in edges), ' köprü:', sum(e['bridge'] for e in edges),
          ' geçit:', sum(e['pass_'] for e in edges))
    print('  deniz yolu:', len(sea), ' nehir hattı:', len(rivers))
    # validation
    for a in range(n):
        for b in adj[a]:
            assert a in adj[b]
    parent = list(range(n))

    def f(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x
    for e in edges:
        parent[f(e['a'])] = f(e['b'])
    for a, b, d, L in sea:
        parent[f(a)] = f(b)
    comps = len({f(i) for i in range(n)})
    print('  bağlı bileşen (kara+deniz):', comps)
    assert comps == 1, 'graph not connected'
    for g in regs:
        if g['island']:
            assert any(g['id'] in (a, b) for a, b, _, _ in sea), ('island without sea link', g['id'])
    names = [g['name'] for g in regs]
    assert len(set(names)) == len(names), 'duplicate names'
    for k in range(6):
        ks = [g for g in regs if g['kingdom'] == k]
        assert sum(g['type'] == 'capital' for g in ks) == 1
        assert sum(g['type'] == 'industrial' for g in ks) == 1
        assert any(g['type'] == 'mine' for g in ks)
        assert any(g['type'] in ('port', 'city') for g in ks)
    for g in regs:
        dd = math.hypot(g['x'] - g['cx'], g['y'] - g['cy'])
        if dd < 18:
            print('  UYARI etiket/yerleşim yakın', g['id'], round(dd, 1))
        if g['dtmax'] < 14:
            print('  not: dar bölge', g['id'], g['name'], 'dt', round(g['dtmax'], 1))
    for g in regs:
        if g['type'] == 'port':
            assert g['coastal']
    print('  sea route lengths:', sorted(int(L) for _, _, _, L in sea))


if __name__ == '__main__':
    main()
