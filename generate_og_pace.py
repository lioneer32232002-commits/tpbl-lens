# generate_og_pace.py
# Requires: pip install Pillow
import json, os, math
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630

BG     = (15, 25, 35)
BG2    = (26, 42, 58)
HEADER = (20, 32, 46)
CYAN   = (0, 229, 255)
PINK   = (240, 98, 146)
TEXT1  = (232, 237, 242)
TEXT2  = (143, 163, 184)
BORDER_CYAN = (35, 60, 80)
BORDER_PINK = (70, 40, 60)

TEAM_EN = {
    '福爾摩沙夢想家':  'Dreamers',
    '新竹御嵿攻城獅':  'Lioneers',
    '高雄全家海神':    'Aquas',
    '桃園台啤永豐雲豹': 'Leopards',
    '新北中信特攻':    'Braves',
    '新北國王':        'Kings',
    '臺北台新戰神':    'Warriors',
}


def _short(name):
    return TEAM_EN.get(name, name)


def _find_font(bold=False):
    bold_candidates = [
        "C:/Windows/Fonts/msjhbd.ttc",
        "C:/Windows/Fonts/arialbd.ttf",
        "/System/Library/Fonts/PingFang.ttc",
    ]
    regular_candidates = [
        "C:/Windows/Fonts/msjh.ttc",
        "C:/Windows/Fonts/mingliu.ttc",
        "/System/Library/Fonts/PingFang.ttc",
        "/usr/share/fonts/truetype/noto/NotoSansCJKtc-Regular.otf",
    ]
    candidates = bold_candidates if bold else regular_candidates
    for p in candidates:
        if os.path.exists(p):
            return p
    return None


def _font(path, size):
    if path:
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            pass
    return ImageFont.load_default()


def _dashed_line(draw, x1, y1, x2, y2, color, width=1, seg=5, gap=4):
    total = math.hypot(x2 - x1, y2 - y1)
    if total == 0:
        return
    dx, dy = (x2 - x1) / total, (y2 - y1) / total
    pos = 0.0
    on = True
    while pos < total:
        end = min(pos + (seg if on else gap), total)
        if on:
            sx, sy = x1 + dx * pos,  y1 + dy * pos
            ex, ey = x1 + dx * end,  y1 + dy * end
            draw.line([(sx, sy), (ex, ey)], fill=color, width=width)
        pos = end
        on = not on


def _sparkline(draw, data, y_min, y_max, league_avg, color, x, y, w, h):
    if not data or len(data) < 2:
        return
    xs = [p["x"] for p in data]
    ys = [p["y"] for p in data]
    x_min, x_max = min(xs), max(xs)
    y_range = y_max - y_min if y_max != y_min else 1

    def px(v):
        return x + (v - x_min) / (x_max - x_min) * w if x_max != x_min else x + w / 2
    def py(v):
        return y + h - (v - y_min) / y_range * h

    pts = [(px(p["x"]), py(p["y"])) for p in data]

    # league avg dashed guide
    avg_y = py(league_avg)
    _dashed_line(draw, x, avg_y, x + w, avg_y, (60, 80, 100), width=1, seg=5, gap=4)

    # trend line
    draw.line(pts, fill=color, width=2)

    # dots
    for px_v, py_v in pts:
        r = 2.5
        draw.ellipse([px_v - r, py_v - r, px_v + r, py_v + r], fill=color)


def _section_divider(draw, label, color, font, y, line_color):
    cx = W // 2
    draw.text((cx, y + 2), label, fill=color, font=font, anchor="mt")
    tw = draw.textlength(label, font=font)
    half_gap = tw / 2 + 20
    draw.line([(64, y + 10), (cx - half_gap, y + 10)], fill=line_color, width=1)
    draw.line([(cx + half_gap, y + 10), (W - 64, y + 10)], fill=line_color, width=1)


def _cards_row(draw, teams, y, card_w, card_h, color, border_color,
               y_min, y_max, league_avg,
               font_name, font_avg):
    n = len(teams)
    if n == 0:
        return
    gap = 16
    total_w = n * card_w + (n - 1) * gap
    x0 = (W - total_w) // 2

    for i, t in enumerate(teams):
        cx = x0 + i * (card_w + gap)

        # card bg + border
        draw.rounded_rectangle([cx, y, cx + card_w, y + card_h],
                                radius=10, fill=BG2, outline=border_color, width=1)

        # team name
        draw.text((cx + card_w // 2, y + 14), _short(t["name"]),
                  fill=TEXT1, font=font_name, anchor="mt")

        # avg pace (large, colored)
        draw.text((cx + card_w // 2, y + 44), f"{t['avg']:.1f}",
                  fill=color, font=font_avg, anchor="mt")

        # sparkline
        spark_pad = 14
        spark_h = card_h - 106
        _sparkline(draw, t.get("data", []),
                   y_min, y_max, league_avg, color,
                   cx + spark_pad, y + 96,
                   card_w - spark_pad * 2, spark_h)


def generate_og_pace(base_dir=None):
    if base_dir is None:
        base_dir = os.path.dirname(os.path.abspath(__file__))

    data_path = os.path.join(base_dir, "data", "league_2526.json")
    if not os.path.exists(data_path):
        print("[og] league_2526.json not found — skip")
        return

    with open(data_path, encoding="utf-8") as f:
        league = json.load(f)

    trend = league.get("pace_trend", [])
    if not trend:
        print("[og] no pace_trend data — skip")
        return

    all_y = [p["y"] for t in trend for p in t.get("data", [])
              if isinstance(p.get("y"), (int, float))]
    if not all_y:
        return

    league_avg = sum(all_y) / len(all_y)
    y_min = math.floor(min(all_y) - 1)
    y_max = math.ceil(max(all_y) + 1)

    enriched = []
    for t in trend:
        ys = [p["y"] for p in t.get("data", []) if isinstance(p.get("y"), (int, float))]
        avg = sum(ys) / len(ys) if ys else 0
        enriched.append({**t, "avg": avg})
    enriched.sort(key=lambda x: -x["avg"])

    above = [t for t in enriched if t["avg"] >= league_avg]
    below = [t for t in enriched if t["avg"] < league_avg]

    fp      = _find_font(bold=False)
    fp_bold = _find_font(bold=True)
    f_title  = _font(fp_bold, 22)
    f_sub    = _font(fp, 15)
    f_label  = _font(fp, 13)
    f_name   = _font(fp_bold, 20)
    f_avg    = _font(fp_bold, 42)

    img  = Image.new("RGB", (W, H), BG)
    draw = ImageDraw.Draw(img)

    # header band — single title line, no bottom border
    draw.rectangle([0, 0, W, 52], fill=HEADER)

    draw.text((W // 2, 14), f"TPBL 2025–26  ·  Avg. Possessions per Game",
              fill=TEXT1, font=f_title, anchor="mt")

    card_w = 230
    card_h = 175

    # vertical centering of the content block below header
    block_h = 32 + card_h + 22 + 32 + card_h + 38
    v_off   = 52 + (H - 52 - block_h) // 2

    # above section
    above_label_y = v_off
    _section_divider(draw, "▲  Above League Avg", CYAN, f_label, above_label_y,
                     line_color=(35, 60, 80))
    above_y = above_label_y + 32
    _cards_row(draw, above, above_y, card_w, card_h, CYAN, BORDER_CYAN,
               y_min, y_max, league_avg, f_name, f_avg)

    # below section
    below_label_y = above_y + card_h + 22
    _section_divider(draw, "▼  Below League Avg", PINK, f_label, below_label_y,
                     line_color=(70, 40, 60))
    below_y = below_label_y + 32
    _cards_row(draw, below, below_y, card_w, card_h, PINK, BORDER_PINK,
               y_min, y_max, league_avg, f_name, f_avg)

    # bottom branding
    brand_y = below_y + card_h + 12
    draw.text((W // 2, brand_y), "tpbl-lens.pages.dev",
              fill=TEXT2, font=f_sub, anchor="mt")

    out_dir  = os.path.join(base_dir, "dist", "og")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "pace-trend.png")
    img.save(out_path, "PNG", optimize=True)
    print(f"[og] {out_path}")


if __name__ == "__main__":
    generate_og_pace()
