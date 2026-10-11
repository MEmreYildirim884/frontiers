"""FRONTIERS harita üreteci.

Organik sınırlı bölgeleri (Voronoi + tutarlı kenar gürültüsü) üretir ve
public/game/js/data/map.js dosyasını yazar.
Çalıştırma (FRONTIERS klasöründe): python tools/generate-map.py [önizleme.png]
Gerekenler: numpy, scipy, shapely (önizleme için Pillow).
"""
import json, math, random, sys
from collections import deque
import numpy as np
from scipy.spatial import Voronoi
from shapely.geometry import Polygon, MultiPolygon, Point
from shapely.ops import unary_union, polylabel

W, H = 1000, 660
rnd = random.Random(1453)


def noisy_ring(points, rough, depth, seed):
    r = random.Random(seed)
    pts = list(points)
    for _ in range(depth):
        out = []
        for i in range(len(pts)):
            a, b = pts[i], pts[(i + 1) % len(pts)]
            mx, my = (a[0] + b[0]) / 2, (a[1] + b[1]) / 2
            dx, dy = b[0] - a[0], b[1] - a[1]
            L = math.hypot(dx, dy) or 1
            off = r.uniform(-rough, rough) * L
            out += [a, (mx - dy / L * off, my + dx / L * off)]
        pts = out
    return pts


def ellipse(cx, cy, rx, ry, n=10):
    return [(cx + rx * math.cos(t), cy + ry * math.sin(t)) for t in np.linspace(0, 2 * math.pi, n, endpoint=False)]


# Ana kıta (kaba kontrol noktaları) + körfezler + iki ada
CONTINENT = [(70, 120), (150, 70), (300, 75), (420, 45), (560, 55), (700, 50), (850, 70), (935, 140),
             (945, 270), (905, 330), (950, 420), (930, 560), (820, 590), (660, 585), (540, 610),
             (400, 590), (260, 605), (130, 575), (60, 480), (95, 400), (45, 320), (60, 220)]
land = Polygon(noisy_ring(CONTINENT, 0.22, 4, 7)).buffer(0)
for (cx, cy, rx, ry, s) in [(505, 330, 62, 38, 3), (975, 360, 50, 70, 5), (300, 650, 60, 45, 9), (20, 270, 45, 55, 11), (700, 10, 55, 40, 13)]:
    land = land.difference(Polygon(noisy_ring(ellipse(cx, cy, rx, ry), 0.25, 3, s)))
if isinstance(land, MultiPolygon):
    land = max(land.geoms, key=lambda g: g.area)
isle_se = Polygon(noisy_ring(ellipse(835, 628, 62, 20, 9), 0.18, 3, 21)).difference(land.buffer(16))
isle_nw = Polygon(noisy_ring(ellipse(120, 28, 52, 22, 9), 0.18, 3, 22)).difference(land.buffer(16))
isle_se = max(isle_se.geoms, key=lambda g: g.area) if isinstance(isle_se, MultiPolygon) else isle_se
isle_nw = max(isle_nw.geoms, key=lambda g: g.area) if isinstance(isle_nw, MultiPolygon) else isle_nw
landmass = unary_union([land, isle_se, isle_nw])

# Tohumlar (krallık başına 5–6 bölge). Sıra NAMES ile eşleşir.
SEEDS = {
    0: [(205, 160), (300, 120), (140, 135), (215, 265), (120, 28)],               # Kızıl Aslan
    1: [(540, 130), (640, 95), (440, 110), (450, 235), (735, 120), (330, 230)],   # Mavi Kartal
    2: [(830, 200), (900, 120), (740, 230), (880, 300), (810, 355)],              # Mor Taç
    3: [(200, 440), (130, 330), (110, 470), (260, 350), (205, 545)],              # Yeşil Meşe
    4: [(520, 470), (410, 395), (630, 410), (375, 520), (490, 560), (610, 530)],  # Altın Güneş
    5: [(820, 455), (720, 400), (835, 628), (900, 500), (725, 520)],              # Bakır Kılıç
}
NAMES = [
    'Aslan Kalesi', 'Kızıl Vadi', 'Kuzey Ovası', 'Kor Tepeler', 'Sis Adası',
    'Kartal Yuvası', 'Buzul Kıyısı', 'Gök Ovası', 'Mavi Göl', 'Fırtına Burnu', 'Demir Geçit',
    'Taç Şehri', 'Kuzgun Kayalığı', 'Mor Bağlar', 'Doğu Dağları', 'Gümüş Koy',
    'Meşe Sarayı', 'Batı Limanı', 'Kara Orman', 'Çayır Köyü', 'Yaşlı Söğüt',
    'Güneş Hisarı', 'Altın Tarlalar', 'Çöl Kapısı', 'Kum Limanı', 'Bakır Madeni', 'Güney Burnu',
    'Kılıç Kalesi', 'Kızıl Kanyon', 'Fener Adası', 'Yanık Bozkır', 'Demirci Köyü',
]
TYPES = {
    'Aslan Kalesi': 'capital', 'Kor Tepeler': 'mine', 'Sis Adası': 'port',
    'Kartal Yuvası': 'capital', 'Buzul Kıyısı': 'mine', 'Fırtına Burnu': 'port',
    'Taç Şehri': 'capital', 'Doğu Dağları': 'mine', 'Gümüş Koy': 'port',
    'Meşe Sarayı': 'capital', 'Kara Orman': 'mine', 'Batı Limanı': 'port',
    'Güneş Hisarı': 'capital', 'Bakır Madeni': 'mine', 'Kum Limanı': 'port',
    'Kılıç Kalesi': 'capital', 'Kızıl Kanyon': 'mine', 'Fener Adası': 'port',
}
GOLD = {'capital': 3, 'mine': 3, 'port': 2, 'plain': 1}
# Deniz geçişleri (kesikli çizgiyle gösterilir)
# (a, b, kavis): kavis, yolun denize doğru ne kadar büküleceğini belirler.
SEA = [('Sis Adası', 'Kuzey Ovası', 0), ('Sis Adası', 'Kızıl Vadi', 0), ('Sis Adası', 'Gök Ovası', -0.18),
       ('Fener Adası', 'Demirci Köyü', 0), ('Fener Adası', 'Güney Burnu', 0.2),
       ('Mavi Göl', 'Altın Tarlalar', 0), ('Gümüş Koy', 'Yanık Bozkır', 0), ('Batı Limanı', 'Kor Tepeler', 0)]

seeds, owner = [], []
for k, pts in SEEDS.items():
    for p in pts:
        seeds.append((p[0] + rnd.uniform(-6, 6), p[1] + rnd.uniform(-6, 6)))
        owner.append(k)
N = len(seeds)
assert N == len(NAMES)
dummies = [(x, y) for x in range(-600, 1700, 300) for y in (-700, 1400)] + [(x, y) for x in (-700, 1700) for y in range(-400, 1200, 300)]
vor = Voronoi(np.array(seeds + dummies))

edge_cache = {}


def noisy_edge(i, j):
    key = (min(i, j), max(i, j))
    if key not in edge_cache:
        a, b = vor.vertices[key[0]], vor.vertices[key[1]]
        r = random.Random(key[0] * 7919 + key[1])
        pts = [tuple(a), tuple(b)]
        for _ in range(3):
            out = []
            for q in range(len(pts) - 1):
                p0, p1 = pts[q], pts[q + 1]
                mx, my = (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2
                dx, dy = p1[0] - p0[0], p1[1] - p0[1]
                L = math.hypot(dx, dy) or 1
                off = r.uniform(-0.16, 0.16) * L
                out += [p0, (mx - dy / L * off, my + dx / L * off)]
            out.append(pts[-1])
            pts = out
        edge_cache[key] = pts
    pts = edge_cache[key]
    return pts if i == key[0] else list(reversed(pts))


regions = []
for s in range(N):
    reg = vor.regions[vor.point_region[s]]
    assert reg and -1 not in reg
    ring = []
    for q in range(len(reg)):
        ring += noisy_edge(reg[q], reg[(q + 1) % len(reg)])[:-1]
    g = Polygon(ring).buffer(0).intersection(landmass)
    if isinstance(g, MultiPolygon):
        g = sorted(g.geoms, key=lambda p: p.distance(Point(seeds[s])))[0]
    regions.append(g)

# Hiçbir bölgeye düşmeyen kara parçalarını en uzun sınırı paylaştığı bölgeye kat.
leftover = landmass.difference(unary_union(regions))
pieces = leftover.geoms if hasattr(leftover, 'geoms') else [leftover]
for piece in pieces:
    if piece.is_empty or piece.area < 0.5 or piece.geom_type != 'Polygon':
        continue
    best = max(range(N), key=lambda i: (piece.buffer(0.6).intersection(regions[i]).area, -piece.distance(regions[i])))
    merged = unary_union([regions[best], piece.buffer(0.01)]).buffer(0)
    if isinstance(merged, MultiPolygon):
        merged = max(merged.geoms, key=lambda q: q.area)
    regions[best] = merged


def fmt(v):
    return f"{v:.1f}".rstrip('0').rstrip('.')


def ring_path(coords):
    return 'M' + ' '.join(f"{fmt(x)},{fmt(y)}" for x, y in list(coords)[:-1]) + 'Z'


def path_of(poly):
    # Delikler (iç göller) de yazılır; SVG'de fill-rule="evenodd" ile çizilir.
    polys = poly.geoms if isinstance(poly, MultiPolygon) else [poly]
    return ''.join(ring_path(p.exterior.coords) + ''.join(ring_path(h.coords) for h in p.interiors) for p in polys)


adj, edges = set(), []
for a in range(N):
    for b in range(a + 1, N):
        inter = regions[a].boundary.intersection(regions[b].boundary)
        if inter.is_empty or inter.length <= 6:
            continue
        adj.add((a, b))
        lines = inter.geoms if hasattr(inter, 'geoms') else [inter]
        d = ''.join('M' + ' '.join(f"{fmt(x)},{fmt(y)}" for x, y in ln.coords) for ln in lines if ln.geom_type == 'LineString')
        edges.append(dict(a=a, b=b, d=d))

idx = {n: i for i, n in enumerate(NAMES)}
from shapely.ops import nearest_points
sea_links = []
for a, b, bend in SEA:
    ia, ib = idx[a], idx[b]
    if (min(ia, ib), max(ia, ib)) in adj:
        continue
    pa, pb = nearest_points(regions[ia], regions[ib])
    dx, dy = pb.x - pa.x, pb.y - pa.y
    L = math.hypot(dx, dy) or 1
    # Uçları kıyıdan biraz içeri al, ortayı kavisle
    ax, ay = pa.x - dx / L * 6, pa.y - dy / L * 6
    bx, by = pb.x + dx / L * 6, pb.y + dy / L * 6
    cx, cy = (ax + bx) / 2 - dy * bend, (ay + by) / 2 + dx * bend
    sea_links.append([ia, ib, f"M{fmt(ax)},{fmt(ay)} Q{fmt(cx)},{fmt(cy)} {fmt(bx)},{fmt(by)}"])
adj_list = [[] for _ in range(N)]
for a, b in list(adj) + [(x[0], x[1]) for x in sea_links]:
    adj_list[a].append(b)
    adj_list[b].append(a)
for l in adj_list:
    l.sort()

out = []
for i in range(N):
    g = regions[i]
    lab = polylabel(g, 0.5)
    shared = sum(g.boundary.intersection(regions[j].boundary).length for j in adj_list[i] if (min(i, j), max(i, j)) in adj)
    t = TYPES.get(NAMES[i], 'plain')
    out.append(dict(id=i, name=NAMES[i], kingdom=owner[i], type=t, gold=GOLD[t], coastal=bool(g.exterior.length - shared > 15),
                    x=round(lab.x, 1), y=round(lab.y, 1), d=path_of(g)))

js = '// Otomatik üretildi: tools/generate-map.py — elle düzenlemeyin.\n'
js += f'export const MAP_W={W},MAP_H={H};\n'
js += 'export const REGIONS=' + json.dumps(out, ensure_ascii=False) + ';\n'
js += 'export const ADJ=' + json.dumps(adj_list) + ';\n'
js += 'export const SEA_LINKS=' + json.dumps(sea_links) + ';\n'
js += 'export const EDGES=' + json.dumps(edges) + ';\n'
js += 'export const COAST=' + json.dumps(path_of(landmass)) + ';\n'
with open('public/game/js/data/map.js', 'w', encoding='utf-8', newline='\n') as f:
    f.write(js)


def connected(ids):
    ids = set(ids)
    start = next(iter(ids))
    seen, q = {start}, deque([start])
    while q:
        u = q.popleft()
        for v in adj_list[u]:
            if v in ids and v not in seen:
                seen.add(v)
                q.append(v)
    return seen == ids


print('bölge', N, 'kara kenarı', len(adj), 'deniz', len(sea_links), 'tüm harita bağlı', connected(range(N)))
for k in range(6):
    ids = [i for i in range(N) if owner[i] == k]
    print('krallık', k, len(ids), 'bitişik', connected(ids), [(i, NAMES[i], len(adj_list[i])) for i in ids])

if len(sys.argv) > 1 and sys.argv[1].endswith('.png'):
    from PIL import Image, ImageDraw
    COL = ['#b3261e', '#2f5fb3', '#7b3fa0', '#2e7d32', '#d4a017', '#d2691e']
    im = Image.new('RGB', (W, H), (30, 50, 70))
    d = ImageDraw.Draw(im)
    for r in out:
        d.polygon(list(regions[r['id']].exterior.coords), fill=COL[r['kingdom']], outline='black')
    for a, b, _ in sea_links:
        d.line([(out[a]['x'], out[a]['y']), (out[b]['x'], out[b]['y'])], fill='white', width=1)
    for a, b in adj:
        d.line([(out[a]['x'], out[a]['y']), (out[b]['x'], out[b]['y'])], fill=(255, 255, 255, 60), width=1)
    for r in out:
        d.text((r['x'] - 25, r['y'] - 5), f"{r['id']} {r['name'][:11]}", fill='white')
    im.save(sys.argv[1])

if '--debug' in sys.argv:
    print('land', round(landmass.area), 'sum', round(sum(r.area for r in regions)), 'leftover', round(landmass.difference(unary_union(regions)).area, 1))
    for i, r in enumerate(regions):
        print(i, round(r.area), len(r.exterior.coords), r.is_valid, len(r.interiors))
