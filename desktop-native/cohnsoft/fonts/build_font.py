#!/usr/bin/env python3
"""Cohn Sans: an original typeface for Cohnsoft, drawn here as stroke skeletons and expanded to outlines.

Design brief: the clean, open, neutral feel of a modern system sans, combined with the reading aids of dyslexia-friendly
faces: letters that are hard to confuse (b d p q, I l 1, O 0), heavier bottoms so each letter sits on the line, open
apertures, round friendly terminals and generous spacing. Nothing is traced or copied from another typeface.

  PYTHONPATH=<fonttools> python3 brand/cohnsoft/fonts/build_font.py
Writes CohnSans-Regular/Bold .ttf and .woff2, and wordmark outlines (JSON) for the logo artwork.
"""
import json, math, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
HERE = HERE
UPM, XH, CAP, ASC, DESC = 1000, 545, 725, 775, -235


def deg(a): return math.radians(a)
def arc(cx, cy, rx, ry, a0, a1, step=5):
    n = max(2, int(abs(a1 - a0) / step) + 1)
    return [(cx + rx * math.cos(deg(a0 + (a1 - a0) * i / n)), cy + ry * math.sin(deg(a0 + (a1 - a0) * i / n))) for i in range(n + 1)]
def line(p, q, step=28):
    n = max(1, int(math.hypot(q[0] - p[0], q[1] - p[1]) / step))
    return [(p[0] + (q[0] - p[0]) * i / n, p[1] + (q[1] - p[1]) * i / n) for i in range(n + 1)]
def bez(p0, p1, p2, n=12):
    return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0], (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]) for t in [i / n for i in range(n + 1)]]
def poly(*pts):
    out = []
    for a, b in zip(pts, pts[1:]): out += line(a, b)[(1 if out else 0):]
    return out
def cat(*paths):
    out = []
    for p in paths: out += p[(1 if out and out[-1] == p[0] else 0):]
    return out


class Style:
    def __init__(self, name, w0, grow, bw):
        self.name, self.w0, self.grow, self.bw = name, w0, grow, bw   # base stroke, width added to letters, bottom weighting
    def w(self, y):
        t = 0.45 if y < 0 else max(0.0, min(1.0, y / 620.0))
        return self.w0 * (1 + self.bw * (1 - t))


def circle_poly(c, r, n=18):
    return [(c[0] + r * math.cos(2 * math.pi * i / n), c[1] + r * math.sin(2 * math.pi * i / n)) for i in range(n)]
def stroke_polys(pts, st, scale=1.0):
    """A variable-width round-capped stroke along pts, as overlapping convex pieces (merged later)."""
    out = []
    ws = [st.w(p[1]) * scale for p in pts]
    for i, p in enumerate(pts):
        out.append(circle_poly(p, ws[i] / 2))
        if i + 1 < len(pts):
            q = pts[i + 1]; dx, dy = q[0] - p[0], q[1] - p[1]; L = math.hypot(dx, dy)
            if L < 1e-6: continue
            nx, ny = -dy / L, dx / L
            out.append([(p[0] + nx * ws[i] / 2, p[1] + ny * ws[i] / 2), (q[0] + nx * ws[i + 1] / 2, q[1] + ny * ws[i + 1] / 2), (q[0] - nx * ws[i + 1] / 2, q[1] - ny * ws[i + 1] / 2), (p[0] - nx * ws[i] / 2, p[1] - ny * ws[i] / 2)])
    return out


# ------------------------------------------------------------------------------------------------ glyph skeletons
# Each function returns (paths, dots, width). Paths are centrelines; dots are (x, y, radius multiplier). x runs 0..W from the
# glyph's left edge. hw = half the base stroke, so ends land on the outer edge.
def make_glyphs(st):
    hw = st.w0 / 2 * 1.0
    g = st.grow
    G = {}
    def ell(W, y0, y1): return W / 2, (y0 + y1) / 2, (W - 2 * hw) / 2, (y1 - y0 - 2 * hw) / 2
    ov = 12  # round letters overshoot the flat ones slightly

    def reg(ch, W, paths, dots=()): G[ch] = (paths, list(dots), W)

    # ---- lowercase
    Wo = 520 + g
    cx, cy, rx, ry = ell(Wo, -ov, XH + ov)
    reg('o', Wo, [arc(cx, cy, rx, ry, 90, 450)])
    reg('c', 470 + g, [arc(*ell(470 + g, -ov, XH + ov), 38, 322)])
    # e: bar, then an almost-closed bowl
    Wc = 500 + g; ex, ey, erx, ery = ell(Wc, -ov, XH + ov)
    reg('e', Wc, [cat(line((hw, XH * 0.5), (Wc - hw, XH * 0.5)), arc(ex, ey, erx, ery, 0, 322))])
    reg('a', Wo, [arc(cx, cy, rx, ry, 90, 450), line((Wo - hw, XH - hw), (Wo - hw, hw))])
    reg('b', Wo, [arc(cx, cy, rx, ry, 90, 450), line((hw, ASC - hw), (hw, hw))])
    reg('d', Wo + 60, [arc(cx, cy, rx, ry, 90, 450), cat(line((Wo - hw, ASC - hw), (Wo - hw, 150)), bez((Wo - hw, 150), (Wo - hw, hw + 4), (Wo + 55, hw)))])
    reg('p', Wo, [arc(cx, cy, rx, ry, 90, 450), line((hw, XH - hw), (hw, DESC + hw))])
    reg('q', Wo + 60, [arc(cx, cy, rx, ry, 90, 450), cat(line((Wo - hw, XH - hw), (Wo - hw, DESC + 150)), bez((Wo - hw, DESC + 150), (Wo - hw, DESC + hw + 4), (Wo + 55, DESC + hw)))])
    reg('g', Wo, [arc(cx, cy, rx, ry, 90, 450), cat(line((Wo - hw, XH - hw), (Wo - hw, -40)), arc(Wo - hw - 165, -40, 165, 130 + hw, 0, -150))])
    Wn = 480 + g; nx0, nx1 = hw, Wn - hw; ncx = (nx0 + nx1) / 2
    arch = arc(ncx, XH * 0.52, (nx1 - nx0) / 2, XH * 0.48 - hw, 180, 0)
    reg('n', Wn, [line((nx0, XH - hw), (nx0, hw)), cat(arch, line((nx1, XH * 0.52), (nx1, hw)))])
    reg('h', Wn, [line((nx0, ASC - hw), (nx0, hw)), cat(arch, line((nx1, XH * 0.52), (nx1, hw)))])
    reg('u', Wn, [line((nx0, XH - hw), (nx0, XH * 0.48)), cat(arc(ncx, XH * 0.48, (nx1 - nx0) / 2, XH * 0.48 - hw, 180, 360)), line((nx1, XH - hw), (nx1, hw))])
    Wm = 760 + g; m1 = hw + (Wm - 2 * hw) / 2
    ar1 = arc((hw + m1) / 2, XH * 0.52, (m1 - hw) / 2, XH * 0.48 - hw, 180, 0); ar2 = arc((m1 + Wm - hw) / 2, XH * 0.52, (Wm - hw - m1) / 2, XH * 0.48 - hw, 180, 0)
    reg('m', Wm, [line((hw, XH - hw), (hw, hw)), cat(ar1, line((m1, XH * 0.52), (m1, hw))), cat(ar2, line((Wm - hw, XH * 0.52), (Wm - hw, hw)))])
    reg('r', 340 + g / 2, [line((hw, XH - hw), (hw, hw)), cat(arc(hw + 150, XH * 0.52, 150, XH * 0.48 - hw, 180, 60))])
    Ws = 440 + g; sry = (XH - 2 * hw) / 4; sx = Ws / 2; srx = (Ws - 2 * hw) / 2
    up = arc(sx, XH - hw - sry, srx, sry, 28, 270); lo = arc(sx, hw + sry, srx, sry, 90, -152)
    reg('s', Ws, [cat(up, lo)])
    reg('t', 360 + g / 2, [cat(line((130, 650), (130, 175)), bez((130, 175), (130, hw + 6), (330, hw))), line((hw, XH - hw), (330, XH - hw))])
    reg('f', 350 + g / 2, [cat(line((130, hw), (130, 620)), bez((130, 620), (130, ASC - hw), (330, ASC - hw))), line((hw, XH - hw), (320, XH - hw))])
    reg('i', 2 * hw + 6, [line((hw + 3, XH - hw), (hw + 3, hw))], [(hw + 3, 675, 0.78)])
    reg('j', 250, [cat(line((150, XH - hw), (150, -20)), arc(150 - 130, -20, 130, 150, 0, -140))], [(150, 675, 0.78)])
    reg('l', 330, [cat(line((hw, ASC - hw), (hw, 190)), bez((hw, 190), (hw, hw + 4), (250, hw)))])
    reg('k', 470 + g, [line((hw, ASC - hw), (hw, hw)), line((460 + g - hw, XH - hw), (hw + 20, 205)), line((140, 300), (460 + g - hw, hw))])
    reg('v', 500 + g, [poly((hw, XH - hw), ((500 + g) / 2, hw), (500 + g - hw, XH - hw))])
    reg('w', 760 + g, [poly((hw, XH - hw), (200 + g / 4, hw), ((760 + g) / 2, XH * 0.6), (560 + g * 0.75, hw), (760 + g - hw, XH - hw))])
    reg('x', 480 + g, [line((hw, XH - hw), (480 + g - hw, hw)), line((hw, hw), (480 + g - hw, XH - hw))])
    reg('y', 500 + g, [line((hw, XH - hw), ((500 + g) / 2 + 30, hw + 30)), cat(line((500 + g - hw, XH - hw), (170, DESC + 120)), bez((170, DESC + 120), (140, DESC + hw), (60, DESC + hw)))])
    reg('z', 440 + g, [poly((hw, XH - hw), (440 + g - hw, XH - hw), (hw, hw), (440 + g - hw, hw))])
    # ---- capitals (a slab-serifed I and L-foot keep I, l and 1 apart)
    Wp = 560 + g
    def bowl(top, mid, xl, W):
        ry_ = (top - hw - mid) / 2
        return arc(xl, mid + ry_, W - hw - xl, ry_, 90, -90)
    ym = CAP * 0.52
    reg('A', 640 + g, [line((hw, hw), ((640 + g) / 2, CAP - hw)), line(((640 + g) / 2, CAP - hw), (640 + g - hw, hw)), line((hw + 120 + g / 12, CAP * 0.3), (640 + g - hw - 120 - g / 12, CAP * 0.3))])
    Wb = 560 + g; xu, xl2 = Wb * 0.58, Wb * 0.6
    reg('B', Wb, [line((hw, hw), (hw, CAP - hw)), cat(line((hw, CAP - hw), (xu, CAP - hw)), bowl(CAP, ym, xu, Wb - 30), line((xu, ym), (hw, ym))), cat(line((hw, ym), (xl2, ym)), arc(xl2, (ym + hw) / 2 + 0, Wb - hw - xl2, (ym - hw) / 2, 90, -90), line((xl2, hw), (hw, hw)))])
    reg('C', 600 + g, [arc(*ell(600 + g, -ov, CAP + ov), 40, 320)])
    Wd = 600 + g
    reg('D', Wd, [line((hw, hw), (hw, CAP - hw)), cat(line((hw, CAP - hw), (Wd * 0.45, CAP - hw)), arc(Wd * 0.45, CAP / 2, Wd - hw - Wd * 0.45, CAP / 2 - hw, 90, -90), line((Wd * 0.45, hw), (hw, hw)))])
    We = 500 + g
    reg('E', We, [line((hw, hw), (hw, CAP - hw)), line((hw, CAP - hw), (We - hw, CAP - hw)), line((hw, CAP * 0.5), (We - hw - 50, CAP * 0.5)), line((hw, hw), (We - hw, hw))])
    reg('F', 480 + g, [line((hw, hw), (hw, CAP - hw)), line((hw, CAP - hw), (480 + g - hw, CAP - hw)), line((hw, CAP * 0.5), (480 + g - hw - 60, CAP * 0.5))])
    Wg = 640 + g
    reg('G', Wg, [cat(arc(*ell(Wg, -ov, CAP + ov), 40, 360), line((Wg - hw, CAP / 2), (Wg * 0.52, CAP / 2)))])
    reg('H', 620 + g, [line((hw, hw), (hw, CAP - hw)), line((620 + g - hw, hw), (620 + g - hw, CAP - hw)), line((hw, CAP * 0.5), (620 + g - hw, CAP * 0.5))])
    Wi = 300 + g / 2
    reg('I', Wi, [line((Wi / 2, hw), (Wi / 2, CAP - hw)), line((hw, CAP - hw), (Wi - hw, CAP - hw)), line((hw, hw), (Wi - hw, hw))])
    reg('J', 420 + g / 2, [cat(line((420 + g / 2 - hw, CAP - hw), (420 + g / 2 - hw, 240)), arc(420 + g / 2 - hw - 150, 240, 150, 240 - hw + 6, 0, -165))])
    reg('K', 560 + g, [line((hw, hw), (hw, CAP - hw)), line((560 + g - hw, CAP - hw), (hw + 10, CAP * 0.38)), line((190, CAP * 0.5), (560 + g - hw, hw))])
    reg('L', 470 + g, [cat(line((hw, CAP - hw), (hw, hw)), line((hw, hw), (470 + g - hw, hw)))])
    reg('M', 760 + g, [poly((hw, hw), (hw, CAP - hw), ((760 + g) / 2, 190), (760 + g - hw, CAP - hw), (760 + g - hw, hw))])
    reg('N', 640 + g, [poly((hw, hw), (hw, CAP - hw), (640 + g - hw, hw), (640 + g - hw, CAP - hw))])
    reg('O', 700 + g, [arc(*ell(700 + g, -ov, CAP + ov), 90, 450)])
    reg('P', 540 + g, [line((hw, hw), (hw, CAP - hw)), cat(line((hw, CAP - hw), (540 + g * 0.5 - 220, CAP - hw)), arc(540 + g * 0.5 - 220, (CAP + CAP * 0.38) / 2 - hw / 2 + hw, 220 - hw + g * 0.5 - g * 0.5, (CAP - CAP * 0.38) / 2 - hw / 2 - 0, 90, -90), line((540 + g * 0.5 - 220, CAP * 0.38 + hw / 2), (hw, CAP * 0.38 + hw / 2)))])
    reg('Q', 700 + g, [arc(*ell(700 + g, -ov, CAP + ov), 90, 450), line(((700 + g) * 0.6, 200), (700 + g - hw * 0.4, -70))])
    Wr = 560 + g
    reg('R', Wr, [line((hw, hw), (hw, CAP - hw)), cat(line((hw, CAP - hw), (Wr - 240, CAP - hw)), arc(Wr - 240, (CAP + ym) / 2, 240 - hw, (CAP - ym) / 2 - hw, 90, -90), line((Wr - 240, ym), (hw, ym))), line((Wr * 0.42, ym), (Wr - hw, hw))])
    Wss = 520 + g; cap_ry = (CAP - 2 * hw) / 4; cs = Wss / 2; csr = (Wss - 2 * hw) / 2
    reg('S', Wss, [cat(arc(cs, CAP - hw - cap_ry, csr, cap_ry, 28, 270), arc(cs, hw + cap_ry, csr, cap_ry, 90, -152))])
    reg('T', 580 + g, [line((hw, CAP - hw), (580 + g - hw, CAP - hw)), line(((580 + g) / 2, CAP - hw), ((580 + g) / 2, hw))])
    Wu = 620 + g
    reg('U', Wu, [cat(line((hw, CAP - hw), (hw, (Wu - 2 * hw) / 2 + hw)), arc(Wu / 2, (Wu - 2 * hw) / 2 + hw, (Wu - 2 * hw) / 2, (Wu - 2 * hw) / 2, 180, 360), line((Wu - hw, (Wu - 2 * hw) / 2 + hw), (Wu - hw, CAP - hw)))])
    reg('V', 640 + g, [poly((hw, CAP - hw), ((640 + g) / 2, hw), (640 + g - hw, CAP - hw))])
    reg('W', 920 + g, [poly((hw, CAP - hw), (250 + g / 4, hw), ((920 + g) / 2, CAP * 0.55), (670 + g * 0.75, hw), (920 + g - hw, CAP - hw))])
    reg('X', 620 + g, [line((hw, CAP - hw), (620 + g - hw, hw)), line((hw, hw), (620 + g - hw, CAP - hw))])
    reg('Y', 620 + g, [poly((hw, CAP - hw), ((620 + g) / 2, CAP * 0.45), (620 + g - hw, CAP - hw)), line(((620 + g) / 2, CAP * 0.45), ((620 + g) / 2, hw))])
    reg('Z', 540 + g, [poly((hw, CAP - hw), (540 + g - hw, CAP - hw), (hw, hw), (540 + g - hw, hw))])
    # ---- figures (the zero carries a dot, the one a base and a flag)
    N = 560 + g
    reg('0', N, [arc(*ell(N, -ov, CAP + ov), 90, 450)], [(N / 2, CAP / 2, 0.7)])
    reg('1', 400 + g / 2, [cat(line((hw, CAP * 0.78), (190, CAP - hw)), line((190, CAP - hw), (190, hw))), line((hw, hw), (360 + g / 2 - hw, hw))])
    reg('2', N, [cat(arc(N / 2, CAP - hw - (N - 2 * hw) * 0.46, (N - 2 * hw) / 2, (N - 2 * hw) * 0.46, 165, -20), line((N * 0.8, CAP * 0.45 - 20), (hw, hw)), line((hw, hw), (N - hw, hw)))])
    reg('3', N, [cat(arc(N / 2 - 10, CAP - hw - 170, (N - 2 * hw) / 2 - 20, 170, 150, -90), arc(N / 2, hw + 190, (N - 2 * hw) / 2, 190, 90, -150))])
    reg('4', N, [poly((N - 160, hw), (N - 160, CAP - hw), (hw, 215), (N - hw, 215))])
    reg('5', N, [cat(poly((N - hw - 30, CAP - hw), (hw + 30, CAP - hw), (hw + 10, CAP * 0.46)), arc(N / 2 - 4, hw + 235, (N - 2 * hw) / 2 - 4, 235, 128, -150))])
    reg('6', N, [cat(arc(N / 2, hw + 235, (N - 2 * hw) / 2, 235, 90, 450)), cat(bez((hw, 235 + hw), (hw + 8, CAP * 0.82), (N * 0.6, CAP - hw)), bez((N * 0.6, CAP - hw), (N - 130, CAP - hw + 4), (N - 70, CAP - 120)))])
    reg('7', N, [poly((hw, CAP - hw), (N - hw, CAP - hw), (200, hw))])
    reg('8', N, [arc(N / 2, CAP - hw - 165, (N - 2 * hw) / 2 - 35, 165, 90, 450), arc(N / 2, hw + 205, (N - 2 * hw) / 2, 205, 90, 450)])
    reg('9', N, [cat(arc(N / 2, CAP - hw - 235, (N - 2 * hw) / 2, 235, 90, 450)), cat(bez((N - hw, CAP - hw - 235), (N - hw - 8, CAP * 0.18), (N * 0.4, hw)), bez((N * 0.4, hw), (130, hw - 4), (70, 120)))])
    # ---- punctuation
    reg(' ', 250, [])
    reg('.', 2 * hw + 50, [], [(hw + 25, hw, 0.95)])
    reg(',', 2 * hw + 50, [bez((hw + 25, hw), (hw + 25, -60), (hw - 20, -150))], [(hw + 25, hw, 0.95)])
    reg(':', 2 * hw + 50, [], [(hw + 25, hw, 0.95), (hw + 25, XH - hw, 0.95)])
    reg(';', 2 * hw + 50, [bez((hw + 25, hw), (hw + 25, -60), (hw - 20, -150))], [(hw + 25, XH - hw, 0.95)])
    reg('!', 2 * hw + 50, [line((hw + 25, CAP - hw), (hw + 25, 250))], [(hw + 25, hw, 0.95)])
    reg('?', 440, [cat(arc(220, CAP - hw - 190, 220 - hw, 190, 160, -40), bez((220 + 150, CAP - hw - 190 - 120), (220, 330), (220, 250)))], [(220, hw, 0.95)])
    reg('-', 340, [line((hw, XH * 0.46), (340 - hw, XH * 0.46))])
    reg('–', 520, [line((hw, XH * 0.46), (520 - hw, XH * 0.46))])
    reg('—', 860, [line((hw, XH * 0.46), (860 - hw, XH * 0.46))])
    reg("'", 2 * hw + 20, [line((hw + 10, CAP - hw), (hw + 10, CAP - 190))])
    reg('"', 2 * hw + 190, [line((hw + 10, CAP - hw), (hw + 10, CAP - 190)), line((hw + 170, CAP - hw), (hw + 170, CAP - 190))])
    reg('’', 2 * hw + 20, [bez((hw + 10, CAP - hw), (hw + 10, CAP - 140), (hw - 20, CAP - 190))])
    reg('(', 300, [arc(330, CAP * 0.5 - 30, 260, 400, 128, 232)])
    reg(')', 300, [arc(-30, CAP * 0.5 - 30, 260, 400, 52, -52)])
    reg('[', 300, [poly((270 - hw, CAP + 40 - hw), (hw, CAP + 40 - hw), (hw, DESC + 40 + hw), (270 - hw, DESC + 40 + hw))])
    reg(']', 300, [poly((hw, CAP + 40 - hw), (270 - hw, CAP + 40 - hw), (270 - hw, DESC + 40 + hw), (hw, DESC + 40 + hw))])
    reg('/', 400, [line((hw, DESC + 60), (400 - hw, CAP + 20))])
    reg('\\', 400, [line((hw, CAP + 20), (400 - hw, DESC + 60))])
    reg('|', 2 * hw, [line((hw, DESC + hw), (hw, CAP + 40))])
    reg('+', 480, [line((hw, CAP * 0.38), (480 - hw, CAP * 0.38)), line((240, CAP * 0.38 - 200), (240, CAP * 0.38 + 200))])
    reg('=', 480, [line((hw, CAP * 0.3), (480 - hw, CAP * 0.3)), line((hw, CAP * 0.5), (480 - hw, CAP * 0.5))])
    reg('_', 560, [line((hw, DESC + hw), (560 - hw, DESC + hw))])
    reg('*', 380, [line((190, CAP - hw), (190, CAP - 240)), line((30 + hw / 2, CAP - 80), (350 - hw / 2, CAP - 190)), line((30 + hw / 2, CAP - 190), (350 - hw / 2, CAP - 80))])
    reg('#', 600, [line((200, hw), (250, CAP - hw)), line((380, hw), (430, CAP - hw)), line((hw, 240), (600 - hw, 240)), line((hw, 470), (600 - hw, 470))])
    reg('%', 760, [arc(190, CAP - 140, 130 - hw / 2, 130 - hw / 2, 90, 450), arc(570, 140, 130 - hw / 2, 130 - hw / 2, 90, 450), line((hw, hw), (760 - hw, CAP - hw))])
    reg('&', 640, [cat(arc(215, CAP - 130, 140, 130 - hw, 270, -30 - 360 + 360), bez((270, CAP - 250), (60, 330), (130, 90)), arc(250, 140, 190 - 60, 140 - hw, 180, 360 + 0)), line((120, hw + 20), (600, 360))])
    reg('@', 840, [arc(420, 260, 400 - hw, 330, 90, 450), arc(430, 260, 130, 140, 90, 450), cat(line((560, 400), (560, 150)), bez((560, 150), (560, 90), (680, 130)), bez((680, 130), (770, 180), (780, 330)))])
    reg('$', 520, [cat(arc(260, CAP - hw - 150, 220 - hw, 150, 28, 270), arc(260, hw + 170, 240 - hw, 170, 90, -152)), line((260, CAP + 60), (260, DESC + 60))])
    reg('<', 440, [poly((440 - hw, CAP * 0.62), (hw, CAP * 0.38), (440 - hw, CAP * 0.14))])
    reg('>', 440, [poly((hw, CAP * 0.62), (440 - hw, CAP * 0.38), (hw, CAP * 0.14))])
    reg('~', 520, [cat(arc(130, CAP * 0.36, 130 - hw, 90, 180, 90 - 0), arc(390, CAP * 0.36 + 0, 130 - hw, 90, -90, 0))])
    reg('^', 440, [poly((hw, CAP * 0.42), (220, CAP - hw), (440 - hw, CAP * 0.42))])
    reg('`', 300, [line((hw + 30, CAP - hw), (190, CAP - 160))])
    reg('{', 320, [cat(bez((250, CAP + 30), (130, CAP + 30), (130, CAP * 0.78)), line((130, CAP * 0.78), (130, CAP * 0.5 + 40)), bez((130, CAP * 0.5 + 40), (130, CAP * 0.4), (hw, CAP * 0.36)), bez((hw, CAP * 0.36), (130, CAP * 0.32), (130, CAP * 0.22)), line((130, CAP * 0.22), (130, 0)), bez((130, 0), (130, -90), (250, -90)))])
    reg('}', 320, [cat(bez((hw, CAP + 30), (120, CAP + 30), (120, CAP * 0.78)), line((120, CAP * 0.78), (120, CAP * 0.5 + 40)), bez((120, CAP * 0.5 + 40), (120, CAP * 0.4), (250, CAP * 0.36)), bez((250, CAP * 0.36), (120, CAP * 0.32), (120, CAP * 0.22)), line((120, CAP * 0.22), (120, 0)), bez((120, 0), (120, -90), (hw, -90)))])
    return G


def build_outlines(st, sb):
    G = make_glyphs(st)
    out = {}
    for ch, (paths, dots, W) in G.items():
        polys = []
        for p in paths: polys += stroke_polys(p, st)
        for (x, y, k) in dots: polys.append(circle_poly((x, y), st.w(y) / 2 * k * 1.12, 22))
        if not polys: out[ch] = ([], int(W)); continue
        xs = [x for pl in polys for x, _ in pl]
        x0, x1 = min(xs), max(xs)
        shift = sb - x0
        polys = [[(x + shift, y) for x, y in pl] for pl in polys]
        out[ch] = (polys, int(round(x1 - x0 + 2 * sb)))
    return out


def area(pl): return sum(pl[i][0] * pl[(i + 1) % len(pl)][1] - pl[(i + 1) % len(pl)][0] * pl[i][1] for i in range(len(pl))) / 2


def make_font(st, sb, family, style_name, weight):
    from fontTools.fontBuilder import FontBuilder
    from fontTools.pens.ttGlyphPen import TTGlyphPen
    from fontTools.ttLib.removeOverlaps import removeOverlaps
    outlines = build_outlines(st, sb)
    names = ['.notdef'] + [('uni%04X' % ord(c)) for c in outlines]
    fb = FontBuilder(UPM, isTTF=True)
    fb.setupGlyphOrder(names)
    fb.setupCharacterMap({ord(c): ('uni%04X' % ord(c)) for c in outlines})
    glyphs, metrics = {}, {}
    pen = TTGlyphPen(None)
    # .notdef: an open box
    for (x0, y0, x1, y1) in [(80, 0, 480, 725)]:
        pen.moveTo((x0, y0)); pen.lineTo((x0, y1)); pen.lineTo((x1, y1)); pen.lineTo((x1, y0)); pen.closePath()
        pen.moveTo((x0 + 70, y0 + 70)); pen.lineTo((x1 - 70, y0 + 70)); pen.lineTo((x1 - 70, y1 - 70)); pen.lineTo((x0 + 70, y1 - 70)); pen.closePath()
    glyphs['.notdef'] = pen.glyph(); metrics['.notdef'] = (560, 80)
    for c, (polys, adv) in outlines.items():
        pen = TTGlyphPen(None)
        for pl in polys:
            pts = [(int(round(x)), int(round(y))) for x, y in pl]
            if area(pts) > 0: pts = pts[::-1]            # TrueType: outer contours run clockwise; every piece the same way so they union
            pen.moveTo(pts[0])
            for p in pts[1:]: pen.lineTo(p)
            pen.closePath()
        glyphs['uni%04X' % ord(c)] = pen.glyph()
        metrics['uni%04X' % ord(c)] = (adv, sb if polys else 0)
    fb.setupGlyf(glyphs)
    fb.setupHorizontalMetrics(metrics)
    fb.setupHorizontalHeader(ascent=ASC + 60, descent=DESC - 20, lineGap=0)
    fb.setupNameTable({'familyName': family, 'styleName': style_name, 'uniqueFontIdentifier': family + ' ' + style_name + ' 1.0', 'fullName': family + ' ' + style_name, 'psName': (family + '-' + style_name).replace(' ', ''), 'version': 'Version 1.000',
                       'copyright': 'Copyright 2026 Cohnsoft. Original typeface.', 'licenseDescription': 'SIL Open Font License 1.1', 'manufacturer': 'Cohnsoft', 'designer': 'Cohnsoft'})
    fb.setupOS2(sTypoAscender=ASC + 60, sTypoDescender=DESC - 20, sTypoLineGap=0, usWinAscent=ASC + 80, usWinDescent=abs(DESC) + 40, sxHeight=XH, sCapHeight=CAP, usWeightClass=weight, fsType=0)
    fb.setupPost(); fb.setupDummyDSIG = None
    font = fb.font
    try: removeOverlaps(font)
    except Exception as e: print('overlaps kept (skia-pathops missing?):', e)
    return font, outlines


HERE = os.path.dirname(os.path.abspath(__file__))


def main():
    reg = Style('Regular', 86, 0, 0.26)
    bold = Style('Bold', 134, 40, 0.22)
    for st, weight in ((reg, 400), (bold, 700)):
        font, outlines = make_font(st, 64 if st is reg else 60, 'Cohn Sans', st.name, weight)
        base = os.path.join(HERE, 'CohnSans-' + st.name)
        font.save(base + '.ttf')
        try:
            font.flavor = 'woff2'; font.save(base + '.woff2')
        except Exception as e: print('woff2 skipped:', e)
        print('wrote', base + '.ttf', len(outlines), 'glyphs')
    # wordmark outlines for the logo artwork: "cohnsoft" in Bold, as contours in font units (y up)
    font = None
    from fontTools.ttLib import TTFont
    from fontTools.pens.recordingPen import DecomposingRecordingPen
    f = TTFont(os.path.join(HERE, 'CohnSans-Bold.ttf')); gs = f.getGlyphSet(); cmap = f.getBestCmap(); hmtx = f['hmtx']
    x = 0; contours = []; letters = []
    for ch in 'cohnsoft':
        name = cmap[ord(ch)]; pen = DecomposingRecordingPen(gs); gs[name].draw(pen); cur = []; first = len(contours)
        for op, args in pen.value:
            if op == 'moveTo': cur = [(args[0][0] + x, args[0][1])]
            elif op == 'lineTo': cur.append((args[0][0] + x, args[0][1]))
            elif op in ('closePath', 'endPath'):
                if cur: contours.append(cur)
                cur = []
        letters.append({'ch': ch, 'contours': contours[first:]})
        x += hmtx[name][0]
    json.dump({'unitsPerEm': UPM, 'width': x, 'ascender': ASC, 'descender': DESC, 'xHeight': XH, 'letters': letters}, open(os.path.join(HERE, 'wordmark-outlines.json'), 'w'))


if __name__ == '__main__':
    main()
