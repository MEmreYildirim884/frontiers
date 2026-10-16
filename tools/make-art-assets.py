"""Generate FRONTIERS flag + portrait JPGs from the reference images.

Usage:  python tools/make-art-assets.py   (run from the FRONTIERS project root or anywhere)
Inputs: ../referans gorseller/*.png   Outputs: public/game/assets/img/{flags,portraits}/
"""
import os, glob, sys
import numpy as np
from PIL import Image, ImageFilter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = os.path.join(os.path.dirname(ROOT), 'referans gorseller')
OUT_FLAGS = os.path.join(ROOT, 'public', 'game', 'assets', 'img', 'flags')
OUT_PORT = os.path.join(ROOT, 'public', 'game', 'assets', 'img', 'portraits')


def ref(suffix):
    m = [f for f in glob.glob(os.path.join(REF, '*.png')) if f.endswith(suffix)]
    if not m:
        sys.exit('reference not found: ' + suffix)
    return Image.open(m[0]).convert('RGB')


# ---------------------------------------------------------------- flags
FLAG_FILES = ['-1.png', '-2.png', '-3.png', '-4.png', '-5.png', '-6.png']
# extra inset (fraction of bbox) to cut the wavy grey edges; per flag (l, t, r, b)
FLAG_INSET = [(0.012, 0.03, 0.012, 0.035)] * 6
FLAG_INSET[2] = (0.012, 0.11, 0.012, 0.035)


def flag_bbox(im):
    a = np.asarray(im).astype(int)
    bg = np.median(np.concatenate([a[:8].reshape(-1, 3), a[-8:].reshape(-1, 3),
                                   a[:, :8].reshape(-1, 3), a[:, -8:].reshape(-1, 3)]), 0)
    diff = np.abs(a - bg).sum(2)
    mask = diff > 60
    cols = np.where(mask.mean(0) > 0.35)[0]
    rows = np.where(mask.mean(1) > 0.35)[0]
    return cols[0], rows[0], cols[-1], rows[-1]


def make_flags():
    os.makedirs(OUT_FLAGS, exist_ok=True)
    for k, suf in enumerate(FLAG_FILES):
        im = ref(suf)
        x0, y0, x1, y1 = flag_bbox(im)
        w, h = x1 - x0, y1 - y0
        il, it, ir, ib = FLAG_INSET[k]
        box = [x0 + w * il, y0 + h * it, x1 - w * ir, y1 - h * ib]
        # force 3:2 aspect by trimming the longer side symmetrically
        bw, bh = box[2] - box[0], box[3] - box[1]
        if bw / bh > 1.5:
            d = (bw - bh * 1.5) / 2; box[0] += d; box[2] -= d
        else:
            d = (bh - bw / 1.5) / 2; box[1] += d; box[3] -= d
        c = im.crop(tuple(int(round(v)) for v in box))
        c.resize((360, 240), Image.LANCZOS).save(os.path.join(OUT_FLAGS, f'{k}.jpg'), quality=85)
        c.resize((96, 64), Image.LANCZOS).filter(ImageFilter.UnsharpMask(1, 60, 2)).save(
            os.path.join(OUT_FLAGS, f'{k}-s.jpg'), quality=85)
        print('flag', k, [int(v) for v in box])


# ---------------------------------------------------------------- portraits
# split images: (file, kingdom_left, kingdom_right); divider at x~720..726
SPLITS = [('-7.png', 0, 1), ('-8.png', 2, 3), ('-9.png', 4, 5)]
SCENE_BOX = {'L': (0, 3, 718, 1080), 'R': (728, 3, 1448, 1083)}
# crop boxes (x, y, w) in source pixels; h = w * 1.25 (320x400 aspect)
CROPS = {
    0: {'soldier': (10, 335, 290), 'rider': (225, 262, 400), 'commander': (497, 515, 221), 'cannon': (120, 560, 400)},
    1: {'soldier': (740, 352, 270), 'rider': (1010, 262, 390), 'commander': (1218, 552, 230), 'cannon': (820, 560, 400)},
    2: {'soldier': (0, 238, 285), 'rider': (240, 188, 400), 'commander': (490, 488, 228), 'cannon': (115, 540, 400)},
    3: {'soldier': (735, 296, 272), 'rider': (920, 236, 370), 'commander': (1198, 448, 250), 'cannon': (760, 500, 420)},
    4: {'soldier': (0, 236, 262), 'rider': (170, 178, 420), 'commander': (566, 526, 152), 'cannon': (190, 470, 400)},
    5: {'soldier': (728, 352, 262), 'rider': (900, 232, 350), 'commander': (1225, 438, 223), 'cannon': (900, 520, 400)},
}


def make_portraits():
    os.makedirs(OUT_PORT, exist_ok=True)
    for suf, kl, kr in SPLITS:
        im = ref(suf)
        for side, k in (('L', kl), ('R', kr)):
            im.crop(SCENE_BOX[side]).resize((560, 840), Image.LANCZOS).save(
                os.path.join(OUT_PORT, f'{k}-scene.jpg'), quality=82)
            for part, (x, y, w) in CROPS[k].items():
                h = round(w * 1.25)
                lim = (0, 718) if side == 'L' else (728, 1448)
                x = max(lim[0], min(x, lim[1] - w))
                y = max(0, min(y, im.height - h))
                c = im.crop((x, y, x + w, y + h)).resize((320, 400), Image.LANCZOS)
                c.save(os.path.join(OUT_PORT, f'{k}-{part}.jpg'), quality=82)
    print('portraits done')


# =================================================================== section 2: atlas sprites
# Source atlases are copied to tools/ref-atlas/atlas{1..4}.png (1536x1024).
# Background removal uses rembg (u2net):  pip install rembg onnxruntime
#   (optional: FRONTIERS_PYLIB=<dir> adds a pip --target dir to sys.path; U2NET_HOME caches the model)
ATLAS_DIR = os.path.join(ROOT, 'tools', 'ref-atlas')
IMG = os.path.join(ROOT, 'public', 'game', 'assets', 'img')
_atl, _sess = {}, {}


def atlas(n):
    if n not in _atl:
        _atl[n] = Image.open(os.path.join(ATLAS_DIR, f'atlas{n}.png')).convert('RGB')
    return _atl[n]


def _session():
    if 'u' not in _sess:
        if os.environ.get('FRONTIERS_PYLIB'):
            sys.path.insert(0, os.environ['FRONTIERS_PYLIB'])
        from rembg import new_session
        _sess['u'] = new_session('u2net')
    return _sess['u']


def cutout(n, box, up=3, minfrac=0.1, keep_bottom=0.5, edge_drop=0.35, thr=0.1, drop=()):
    """Crop box from atlas n, remove background, keep the main figure group, trim. Returns RGBA at `up`x."""
    import cv2
    sess = _session()
    from rembg import remove
    x0, y0, x1, y1 = box
    c = atlas(n).crop(box)
    for (a, b, cc, d) in drop:  # paint-out rects (atlas coords) e.g. neighbour weapons
        Image.Image.paste(c, (0, 0, 0), (a - x0, b - y0, cc - x0, d - y0))
    c = c.resize((c.width * up, c.height * up), Image.LANCZOS)
    r = remove(c, session=sess)
    a = np.asarray(r.split()[3]).astype(np.float32) / 255
    a[a < thr] = 0
    m = (a > 0.5).astype(np.uint8)
    h, w = m.shape
    num, lab, st, _ = cv2.connectedComponentsWithStats(m, 8)
    if num > 1:
        areas = st[1:, cv2.CC_STAT_AREA]
        big = areas.max()
        keep = np.zeros(num, bool)
        for i in range(1, num):
            ar = st[i, cv2.CC_STAT_AREA]
            L, T, W_, H_ = st[i, 0], st[i, 1], st[i, 2], st[i, 3]
            touches = L <= 1 or T <= 1 or L + W_ >= w - 1
            if ar == big:
                keep[i] = True
            elif ar >= big * minfrac and (T + H_) >= h * keep_bottom and not (touches and ar < big * edge_drop):
                keep[i] = True
        km = keep[lab].astype(np.uint8)
        km = cv2.dilate(km, np.ones((5, 5), np.uint8))  # keep soft edges around kept parts
        a = a * km
    rgb = np.asarray(r.convert('RGB'))
    edge = {'L': int((a[:, :2] > 0.5).sum()), 'R': int((a[:, -2:] > 0.5).sum()), 'T': int((a[:2] > 0.5).sum()), 'B': int((a[-2:] > 0.5).sum())}
    cutout.last_edges = {k_: v for k_, v in edge.items() if v > 6 * up}
    out = np.dstack([rgb, (a * 255).astype(np.uint8)])
    ys, xs = np.where(out[:, :, 3] > 6)
    out = out[ys.min():ys.max() + 1, xs.min():xs.max() + 1]
    return Image.fromarray(out, 'RGBA')


def save_sprite(im, path, scale, pad=4):
    """im at some resolution; scale relative to atlas native = (target/native)."""
    from PIL import ImageFilter
    im = im.resize((max(1, round(im.width * scale)), max(1, round(im.height * scale))), Image.LANCZOS)
    r, g, b, a = im.split()
    rgb = Image.merge('RGB', (r, g, b)).filter(ImageFilter.UnsharpMask(1.0, 60, 2))
    im = Image.merge('RGBA', (*rgb.split(), a))
    out = Image.new('RGBA', (im.width + 2 * pad, im.height + 2 * pad), (0, 0, 0, 0))
    out.paste(im, (pad, pad))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    out.save(path, optimize=True)


UNIT_ORDER_INF = ['militia', 'line', 'light', 'grenadier', 'guard']
UNIT_ORDER_CAV = ['hussar', 'cuirassier', 'field', 'siege', 'sapper']
# atlas3: per kingdom (inf_y, inf_bounds, cav_y, cav_bounds); bounds = 6 x-borders for 5 cells
UNIT_CELLS = {
    0: ((36, 138), (5, 92, 185, 268, 380, 505), (155, 263), (5, 93, 178, 280, 392, 505)),
    1: ((36, 138), (520, 612, 708, 795, 898, 1012), (155, 263), (520, 616, 703, 801, 927, 1012)),
    2: ((36, 138), (1035, 1136, 1205, 1305, 1395, 1525), (155, 263), (1030, 1122, 1205, 1310, 1425, 1515)),
    3: ((332, 435), (5, 95, 188, 275, 390, 505), (450, 561), (5, 97, 187, 285, 400, 505)),
    4: ((332, 435), (515, 605, 700, 805, 900, 1010), (450, 561), (515, 607, 697, 813, 934, 1010)),
    5: ((332, 435), (1030, 1115, 1203, 1300, 1403, 1515), (450, 561), (1030, 1118, 1199, 1312, 1432, 1515)),
}
UNIT_FIX = {
    (4, 'siege'): dict(box=(807, 450, 934, 561), drop=((807, 490, 814, 520),)),
    (3, 'siege'): dict(box=(285, 450, 409, 561)),
    (0, 'grenadier'): dict(box=(268, 24, 380, 138)),
    (3, 'grenadier'): dict(box=(275, 318, 390, 435)),
    (4, 'grenadier'): dict(box=(805, 318, 900, 435)),
    (1, 'siege'): dict(box=(801, 155, 927, 263), drop=((801, 195, 806, 220),)),
    (4, 'cuirassier'): dict(box=(604, 450, 697, 561), drop=((604, 470, 611, 503),)),
    (4, 'hussar'): dict(box=(515, 450, 610, 561), drop=((605, 503, 610, 561),)),
}  # (k, type) -> dict of cutout kwargs overrides (box, drop, ...)


def make_units(only=None):
    for k, (iy, ib, cy, cb) in UNIT_CELLS.items():
        for row, ys, bs in ((UNIT_ORDER_INF, iy, ib), (UNIT_ORDER_CAV, cy, cb)):
            for i, t in enumerate(row):
                if only and (k, t) not in only:
                    continue
                kw = dict(UNIT_FIX.get((k, t), {}))
                box = kw.pop('box', (bs[i], ys[0], bs[i + 1], ys[1]))
                im = cutout(3, box, **kw)
                if cutout.last_edges:
                    print('  edge-touch', k, t, cutout.last_edges)
                save_sprite(im, os.path.join(IMG, 'units', f'{k}-{t}.png'), 2 / 3)
        print('units', k)


# atlas2: fort levels + damage stages (boxes exclude captions)
FORT_BOXES = {1: (12, 255, 172, 384), 2: (175, 255, 345, 384), 3: (346, 236, 566, 384), 4: (566, 236, 784, 387), 5: (776, 226, 1024, 391)}
FORT_DMG_BOXES = {1: (1026, 258, 1190, 383), 2: (1191, 258, 1356, 382), 3: (1356, 276, 1530, 380)}
# atlas2 row3 (market has no sprite: buildingSprite('market') reuses 'town')
BUILDING_BOXES = {
    'village': (4, 436, 101, 525), 'town': (101, 436, 197, 525), 'capital': (196, 430, 307, 526), 'barracks': (306, 440, 410, 525),
    'stable': (406, 430, 503, 525), 'foundry': (503, 414, 618, 525), 'academy': (620, 412, 772, 528), 'mine': (763, 416, 879, 529),
    'factory': (872, 412, 1007, 530), 'port': (1006, 414, 1158, 529), 'depot': (1150, 432, 1262, 528), 'railway': (1261, 416, 1406, 529),
    'sapperSchool': (1398, 418, 1534, 525),
}
BUILDING_FIX = {
    'factory': dict(drop=((872, 470, 879, 530),)),
    'railway': dict(drop=((1399, 416, 1406, 505),)),
    'sapperSchool': dict(drop=((1398, 503, 1410, 529),)),
}
# atlas2 row4: 4 portrait tiles per kingdom (x0, x1), y 610..708
GENERAL_TILES = {
    0: ((10, 82), (85, 145), (148, 203), (205, 260)), 1: ((270, 340), (343, 400), (401, 457), (458, 515)),
    2: ((520, 590), (591, 647), (648, 705), (706, 762)), 3: ((770, 842), (845, 900), (902, 957), (960, 1012)),
    4: ((1020, 1095), (1099, 1155), (1157, 1212), (1215, 1272)), 5: ((1280, 1360), (1362, 1417), (1420, 1472), (1475, 1527)),
}
GENERAL_Y = (611, 707)
# atlas4 section 4: ruler frames (outer gold frame boxes); cropped 5px inside
RULER_FRAMES = [(12, 550, 115, 700), (122, 550, 225, 700), (232, 550, 334, 700), (342, 550, 444, 700), (452, 550, 555, 700), (562, 550, 665, 700)]
# atlas2 bottom-right event scenes (inside frame)
EVENT_BOXES = {'victory': (1161, 893, 1271, 989), 'defeat': (1284, 893, 1394, 989), 'peace': (1411, 893, 1522, 989)}
# atlas4 round icons: centres (x, y), radius ~20
ICON_IDS = [['infantry', 'cavalry', 'artillery', 'engineer', 'fort'], ['gold', 'food', 'population', 'morale', 'diplomacy'],
            ['trade', 'mine', 'build', 'siege', 'war']]
ICON_CX = (1265, 1325, 1385, 1445, 1505)
ICON_CY = (571, 634, 696)
ICON_R = 20.5
ICON_SIZE = 64


def make_props():
    for lv, box in FORT_BOXES.items():
        save_sprite(cutout(2, box, minfrac=0.03, keep_bottom=0.3), os.path.join(IMG, 'forts', f'{lv}.png'), 1 / 3 * 1.5)
        if cutout.last_edges: print('  edge-touch fort', lv, cutout.last_edges)
    for st, box in FORT_DMG_BOXES.items():
        save_sprite(cutout(2, box, minfrac=0.03, keep_bottom=0.3), os.path.join(IMG, 'forts', f'dmg-{st}.png'), 1 / 3 * 1.5)
        if cutout.last_edges: print('  edge-touch dmg', st, cutout.last_edges)
    for bid, box in BUILDING_BOXES.items():
        kw = BUILDING_FIX.get(bid, {})
        save_sprite(cutout(2, box, minfrac=0.03, keep_bottom=0.3, **kw), os.path.join(IMG, 'buildings', f'{bid}.png'), 1 / 3 * 1.6)
        if cutout.last_edges: print('  edge-touch bld', bid, cutout.last_edges)
    print('forts/buildings done')


def _photo(n, box, size, path, q=88):
    from PIL import ImageFilter
    c = atlas(n).crop(box)
    c = c.resize(size, Image.LANCZOS).filter(ImageFilter.UnsharpMask(1.0, 50, 2))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    c.save(path, quality=q, optimize=True)


def make_photos():
    for k, (x0, y0, x1, y1) in enumerate(RULER_FRAMES):
        b = (x0 + 8, y0 + 8, x1 - 8, y1 - 8)
        _photo(4, b, ((b[2] - b[0]) * 2, (b[3] - b[1]) * 2), os.path.join(IMG, 'portraits', f'ruler-{k}.jpg'))
    for k, tiles in GENERAL_TILES.items():
        for i, (x0, x1) in enumerate(tiles):
            b = (x0 + 3, GENERAL_Y[0], x1 - 3, GENERAL_Y[1])
            _photo(2, b, ((b[2] - b[0]) * 2, (b[3] - b[1]) * 2), os.path.join(IMG, 'portraits', f'generals-{k}-{i}.jpg'))
    for eid, b in EVENT_BOXES.items():
        _photo(2, b, ((b[2] - b[0]) * 2, (b[3] - b[1]) * 2), os.path.join(IMG, 'events', f'{eid}.jpg'))
    print('photos done')


def make_icons():
    import cv2
    from PIL import ImageDraw, ImageFilter
    A = atlas(4)
    g = cv2.cvtColor(np.asarray(A), cv2.COLOR_RGB2GRAY)
    os.makedirs(os.path.join(IMG, 'icons'), exist_ok=True)
    for r, row in enumerate(ICON_IDS):
        for c, iid in enumerate(row):
            cx, cy, R = ICON_CX[c], ICON_CY[r], ICON_R
            win = g[int(cy - 30):int(cy + 30), int(cx - 30):int(cx + 30)]
            circ = cv2.HoughCircles(cv2.GaussianBlur(win, (3, 3), 0), cv2.HOUGH_GRADIENT, 1, 40, param1=80, param2=18, minRadius=17, maxRadius=24)
            if circ is not None:
                x, y, rr = circ[0][0]
                if abs(x - 30) < 5 and abs(y - 30) < 5:
                    cx, cy, R = cx - 30 + x, cy - 30 + y, max(R, min(rr + 0.8, 22.5))
            S = 8
            box = (int(cx - R - 2), int(cy - R - 2), int(cx + R + 3), int(cy + R + 3))
            big = A.crop(box).resize(((box[2] - box[0]) * S, (box[3] - box[1]) * S), Image.LANCZOS)
            m = Image.new('L', big.size, 0)
            ox, oy = (cx - box[0]) * S, (cy - box[1]) * S
            ImageDraw.Draw(m).ellipse((ox - R * S, oy - R * S, ox + R * S, oy + R * S), fill=255)
            big.putalpha(m)
            bb = (int(ox - R * S), int(oy - R * S), int(ox + R * S), int(oy + R * S))
            ic = big.crop(bb).resize((ICON_SIZE, ICON_SIZE), Image.LANCZOS)
            rgb = ic.convert('RGB').filter(ImageFilter.UnsharpMask(1.0, 60, 2))
            rgb.putalpha(ic.split()[3])
            rgb.save(os.path.join(IMG, 'icons', f'{iid}.png'), optimize=True)
    print('icons done')


if __name__ == '__main__':
    args = sys.argv[1:]
    if not args or 'flags' in args:
        make_flags()
        make_portraits()
    if not args or 'units' in args:
        make_units()
    if not args or 'props' in args:
        make_props()
    if not args or 'photos' in args:
        make_photos()
    if not args or 'icons' in args:
        make_icons()
