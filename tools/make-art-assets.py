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
    1: ((36, 138), (520, 612, 708, 795, 898, 1000), (155, 263), (520, 616, 703, 808, 934, 1012)),
    2: ((36, 138), (1035, 1136, 1205, 1305, 1395, 1510), (155, 263), (1030, 1122, 1205, 1310, 1425, 1515)),
    3: ((332, 435), (5, 95, 188, 275, 390, 505), (450, 561), (5, 97, 187, 285, 400, 505)),
    4: ((332, 435), (515, 605, 700, 805, 900, 1010), (450, 561), (515, 608, 700, 803, 932, 1010)),
    5: ((332, 435), (1030, 1115, 1203, 1300, 1403, 1515), (450, 561), (1030, 1115, 1210, 1312, 1432, 1515)),
}
UNIT_FIX = {}  # (k, type) -> dict of cutout kwargs overrides (box, drop, ...)


def make_units(only=None):
    for k, (iy, ib, cy, cb) in UNIT_CELLS.items():
        for row, ys, bs in ((UNIT_ORDER_INF, iy, ib), (UNIT_ORDER_CAV, cy, cb)):
            for i, t in enumerate(row):
                if only and (k, t) not in only:
                    continue
                kw = dict(UNIT_FIX.get((k, t), {}))
                box = kw.pop('box', (bs[i], ys[0], bs[i + 1], ys[1]))
                im = cutout(3, box, **kw)
                save_sprite(im, os.path.join(IMG, 'units', f'{k}-{t}.png'), 2 / 3)
        print('units', k)


if __name__ == '__main__':
    args = sys.argv[1:]
    if not args or 'flags' in args:
        make_flags()
        make_portraits()
    if not args or 'units' in args:
        make_units()
