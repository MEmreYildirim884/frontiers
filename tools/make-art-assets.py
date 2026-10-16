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


if __name__ == '__main__':
    make_flags()
    make_portraits()
