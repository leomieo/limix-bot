"""Limix Bot mascot face: two glowing pill eyes behind a dark visor (owner's reference picture, 2026-11-12).

Builds the 25 expressions the avatar engine morphs between (2 eye rings x 48 points each, face space 0..228.541,
centre 120,122.5) and the visor they sit in. Pure and deterministic: rebrand.py writes its output into
src/components/cursor-face-data.ts, so the generated file is the same on every run.
"""
import math

CENTRE = (120.0, 122.5)
EYE_GAP = 26.0          # each eye centre sits this far left/right of the face centre
POINTS = 48
VISOR = {"w": 128.0, "h": 72.0, "r": 36.0}


def _pill(cx, cy, w, h, angle=0.0):
    """Stadium (fully rounded ends along the long side), rotated by angle degrees."""
    r = min(w, h) / 2
    pts = []
    if h >= w:  # vertical pill: caps at top and bottom
        half = h / 2 - r
        for i in range(40):
            t = math.pi + math.pi * i / 39          # top cap, left to right
            pts.append((r * math.cos(t), -half + r * math.sin(t)))
        for i in range(40):
            t = math.pi * i / 39                    # bottom cap, right to left
            pts.append((r * math.cos(t), half + r * math.sin(t)))
    else:       # horizontal dash
        half = w / 2 - r
        for i in range(40):
            t = -math.pi / 2 + math.pi * i / 39     # right cap
            pts.append((half + r * math.cos(t), r * math.sin(t)))
        for i in range(40):
            t = math.pi / 2 + math.pi * i / 39      # left cap
            pts.append((-half + r * math.cos(t), r * math.sin(t)))
    a = math.radians(angle)
    ca, sa = math.cos(a), math.sin(a)
    return [(cx + x * ca - y * sa, cy + x * sa + y * ca) for x, y in pts]


def _arc(cx, cy, w, h, thick, up=True):
    """A thick curved stroke: "^" closed happy eye when up, "u" sleeping eye when down."""
    sign = -1 if up else 1
    rx, ry = w / 2, h
    centre = []
    for i in range(41):
        t = math.pi * i / 40
        centre.append((cx - rx * math.cos(t), cy + sign * (ry * math.sin(t) - ry / 2)))
    def normal(i):
        a = centre[max(i - 1, 0)]
        b = centre[min(i + 1, len(centre) - 1)]
        dx, dy = b[0] - a[0], b[1] - a[1]
        n = math.hypot(dx, dy) or 1
        return (-dy / n, dx / n)
    half = thick / 2
    outer = [(p[0] + normal(i)[0] * half, p[1] + normal(i)[1] * half) for i, p in enumerate(centre)]
    inner = [(p[0] - normal(i)[0] * half, p[1] - normal(i)[1] * half) for i, p in enumerate(centre)]
    def cap(p, i, start):
        n = normal(i)
        base = math.atan2(n[1], n[0])
        out = []
        for k in range(1, 12):
            t = base + (math.pi * k / 12) * (1 if start else -1)
            out.append((p[0] + math.cos(t) * half, p[1] + math.sin(t) * half))
        return out
    ring = outer + cap(centre[-1], len(centre) - 1, False)[::-1] + inner[::-1] + cap(centre[0], 0, True)
    return ring


def _resample(poly, n=POINTS):
    """n points evenly spaced by arc length, clockwise on screen, starting at the topmost point."""
    area = sum(poly[i][0] * poly[(i + 1) % len(poly)][1] - poly[(i + 1) % len(poly)][0] * poly[i][1] for i in range(len(poly)))
    if area < 0:  # y points down, so a positive shoelace sum is clockwise on screen
        poly = poly[::-1]
    cx = sum(p[0] for p in poly) / len(poly)
    start = min(range(len(poly)), key=lambda i: (round(poly[i][1], 3), abs(poly[i][0] - cx)))
    poly = poly[start:] + poly[:start]
    closed = poly + [poly[0]]
    seg = [math.dist(closed[i], closed[i + 1]) for i in range(len(poly))]
    total = sum(seg)
    out, acc, j = [], 0.0, 0
    for k in range(n):
        target = total * k / n
        while acc + seg[j] < target:
            acc += seg[j]
            j += 1
        f = (target - acc) / seg[j] if seg[j] else 0
        a, b = closed[j], closed[j + 1]
        out.append((a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f))
    return out


def _pair(gx=0.0, gy=0.0, left=None, right=None):
    """left/right are (kind, kwargs) relative to their eye centre."""
    rings = []
    for side, spec in ((-1, left), (1, right)):
        kind, kw = spec
        cx = CENTRE[0] + side * EYE_GAP + gx
        cy = CENTRE[1] + gy + kw.pop("dy", 0.0)
        if kind == "pill":
            angle = kw.pop("tilt", 0.0) * side
            poly = _pill(cx, cy, kw["w"], kw["h"], angle)
        else:
            poly = _arc(cx, cy, kw["w"], kw["h"], kw["t"], up=(kind == "happy"))
        rings.append(_resample(poly))
    return rings


def P(w=20, h=38, **kw):
    return ("pill", dict(w=w, h=h, **kw))


def HAPPY(w=26, h=12, t=8, **kw):
    return ("happy", dict(w=w, h=h, t=t, **kw))


def SLEEP(w=24, h=8, t=7, **kw):
    return ("sleep", dict(w=w, h=h, t=t, **kw))


def expressions():
    """Index order is the engine's: each index serves the states listed beside it."""
    return [
        _pair(0, 0, P(), P()),                                   # 0 idle, curious
        _pair(5, -2, P(21, 40), P(21, 40)),                      # 1 listening
        _pair(0, -2, HAPPY(), HAPPY()),                          # 2 happy, laughing, proud
        _pair(0, -1, P(26, 44), P(26, 44)),                      # 3 surprised, searching, alert
        _pair(0, 5, P(24, 7), P(24, 7)),                         # 4 sleeping, bored, sad
        _pair(6, -5, P(20, 22, dy=4), P(20, 38)),                # 5 thinking, suspicious
        _pair(-5, 0, P(20, 37), P(20, 37)),                      # 6 idle, looking left
        _pair(0, 2, P(20, 32, tilt=-14), P(20, 32, tilt=-14)),   # 7 working, focused
        _pair(-6, -5, P(20, 38), P(20, 38)),                     # 8 idle, looking up
        _pair(0, 6, P(20, 33), P(20, 33)),                       # 9 writing, looking down
        _pair(6, 0, P(20, 38), P(20, 38)),                       # 10 listening, working
        _pair(0, -3, HAPPY(24, 10, 7), HAPPY(24, 10, 7)),        # 11 cheerful
        _pair(-9, 0, P(19, 36), P(19, 36)),                      # 12 searching left
        _pair(0, 6, P(22, 15, dy=4), P(22, 15, dy=4)),           # 13 drowsy, waking
        _pair(-6, -4, P(21, 20), P(21, 20)),                     # 14 squinting, suspicious
        _pair(0, -7, P(21, 40), P(21, 40)),                      # 15 curious, proud, up
        _pair(0, 2, P(20, 30, tilt=-20), P(20, 30, tilt=-20)),   # 16 cross, concentrating
        _pair(0, -3, HAPPY(30, 14, 9), HAPPY(30, 14, 9)),        # 17 laughing, delighted
        _pair(9, 0, P(19, 36), P(19, 36)),                       # 18 searching right
        _pair(0, -2, P(26, 30), P(26, 30)),                      # 19 soft, receiving
        _pair(-7, 5, P(19, 34), P(19, 34)),                      # 20 searching down-left
        _pair(0, -2, P(30, 46), P(30, 46)),                      # 21 excited, scared
        _pair(0, 3, SLEEP(), SLEEP()),                           # 22 asleep
        _pair(4, 0, P(22, 14, dy=-4), P(20, 32)),                # 23 suspicious
        _pair(-5, 6, P(17, 26), P(17, 26)),                      # 24 shy
    ]


def encoded():
    lines = []
    for rings in expressions():
        lines.append("|".join(" ".join(f"{round(x, 2):g},{round(y, 2):g}" for x, y in ring) for ring in rings))
    return lines


def face_data_block():
    body = ",\n".join(f'  "{line}"' for line in encoded())
    return f"const ENCODED: string[] = [\n{body}\n]"


MOUTHS_BLOCK = "export const MOUTHS: number[][] = [\n" + ",\n".join("  [0,0,-14,0]" for _ in range(25)) + ",\n]"

VISOR_TS = (
    "\n/** Limix Bot: the dark visor the eyes glow behind, in face space; the eyes are clipped to it. */\n"
    f"export const VISOR = {{ x: {CENTRE[0] - VISOR['w'] / 2:g}, y: {CENTRE[1] - VISOR['h'] / 2:g}, "
    f"w: {VISOR['w']:g}, h: {VISOR['h']:g}, r: {VISOR['r']:g} }}\n"
)


def visor_outline(step=4.0):
    """Points on the visor edge, for the face-fit solver."""
    x0, y0 = CENTRE[0] - VISOR["w"] / 2, CENTRE[1] - VISOR["h"] / 2
    return _pill(CENTRE[0], CENTRE[1], VISOR["w"], VISOR["h"])


def puffy_star(cx=100.0, cy=104.0, outer=98.0, inner_ratio=0.6, tip=26.0, notch=14.0, points=5):
    """A chubby five-point star with round tips and soft notches, as one cubic-only path (the body flattener reads
    M, C and Z). Each corner is replaced by a circular fillet approximated with cubics."""
    verts = []
    for i in range(points * 2):
        r = outer if i % 2 == 0 else outer * inner_ratio
        a = -math.pi / 2 + math.pi * i / points
        verts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    n = len(verts)
    corners = []
    for i in range(n):
        p0, p1, p2 = verts[i - 1], verts[i], verts[(i + 1) % n]
        rad = tip if i % 2 == 0 else notch
        v1 = (p0[0] - p1[0], p0[1] - p1[1])
        v2 = (p2[0] - p1[0], p2[1] - p1[1])
        l1, l2 = math.hypot(*v1), math.hypot(*v2)
        u1 = (v1[0] / l1, v1[1] / l1)
        u2 = (v2[0] / l2, v2[1] / l2)
        cos_t = max(-1.0, min(1.0, u1[0] * u2[0] + u1[1] * u2[1]))
        theta = math.acos(cos_t)
        d = rad / math.tan(theta / 2)
        a = (p1[0] + u1[0] * d, p1[1] + u1[1] * d)
        b = (p1[0] + u2[0] * d, p1[1] + u2[1] * d)
        sweep = math.pi - theta
        k = 4 / 3 * math.tan(sweep / 4) * rad
        c1 = (a[0] - u1[0] * k, a[1] - u1[1] * k)
        c2 = (b[0] - u2[0] * k, b[1] - u2[1] * k)
        corners.append((a, c1, c2, b))
    f = lambda v: f"{round(v, 2):g}"
    out = [f"M{f(corners[0][3][0])} {f(corners[0][3][1])}"]
    for i in range(1, n + 1):
        a, c1, c2, b = corners[i % n]
        prev = corners[i - 1][3]
        # straight edge as a cubic, then the fillet
        out.append(f"C{f(prev[0] + (a[0] - prev[0]) / 3)} {f(prev[1] + (a[1] - prev[1]) / 3)} "
                   f"{f(prev[0] + 2 * (a[0] - prev[0]) / 3)} {f(prev[1] + 2 * (a[1] - prev[1]) / 3)} {f(a[0])} {f(a[1])}")
        out.append(f"C{f(c1[0])} {f(c1[1])} {f(c2[0])} {f(c2[1])} {f(b[0])} {f(b[1])}")
    return "".join(out) + "Z"


if __name__ == "__main__":
    print(puffy_star())
    print(face_data_block()[:300])
