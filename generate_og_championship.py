# generate_og_championship.py — OG image for championship page
# Requires: pip install Pillow
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter

W, H = 1200, 630

BG     = (15,  25,  35)
HEADER = (17,  30,  43)
CYAN   = (0,   229, 255)
GOLD   = (255, 215, 0)
WHITE  = (255, 255, 255)
TEXT1  = (232, 237, 242)
TEXT2  = (143, 163, 184)


def _blend(fg, alpha, bg=BG):
    a = alpha / 255.0
    return tuple(int(f * a + b * (1 - a)) for f, b in zip(fg, bg))


CYAN_FILL = _blend(CYAN, 50)
GOLD_FILL = _blend(GOLD, 50)
TBD_FILL  = _blend(WHITE, 12)

SERIES_GAMES = [
    {'label': 'G1', 'date': '5/24', 'home': 'f', 'tbd': False},
    {'label': 'G2', 'date': '5/26', 'home': 'f', 'tbd': False},
    {'label': 'G3', 'date': '5/29', 'home': 'o', 'tbd': False},
    {'label': 'G4', 'date': '5/31', 'home': 'o', 'tbd': False},
    {'label': 'G5', 'date': '待定',  'home': 'f', 'tbd': True},
    {'label': 'G6', 'date': '待定',  'home': 'o', 'tbd': True},
    {'label': 'G7', 'date': '待定',  'home': 'f', 'tbd': True},
]


def _find_font(bold=False):
    candidates = ([
        'C:/Windows/Fonts/msjhbd.ttc',
        'C:/Windows/Fonts/arialbd.ttf',
        '/System/Library/Fonts/PingFang.ttc',
    ] if bold else [
        'C:/Windows/Fonts/msjh.ttc',
        'C:/Windows/Fonts/mingliu.ttc',
        '/System/Library/Fonts/PingFang.ttc',
        '/usr/share/fonts/truetype/noto/NotoSansCJKtc-Regular.otf',
    ])
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


def _dashed_ellipse(draw, bbox, color, width=1, segments=16):
    for i in range(segments):
        start = i * 360.0 / segments
        end   = start + 360.0 / segments * 0.45
        draw.arc(bbox, start=start, end=end, fill=color, width=width)


def generate_og_championship(base_dir=None):
    if base_dir is None:
        base_dir = os.path.dirname(os.path.abspath(__file__))

    fp_b = _find_font(bold=True)
    fp_r = _find_font(bold=False)

    f_hdr  = _font(fp_b, 20)
    f_brd  = _font(fp_r, 14)
    f_dlbl = _font(fp_b, 15)
    f_ddt  = _font(fp_r, 11)
    f_sht  = _font(fp_b, 30)
    f_ful  = _font(fp_r, 17)
    f_pct  = _font(fp_b, 86)

    img  = Image.new('RGB', (W, H), BG)
    draw = ImageDraw.Draw(img)

    # ── Header bar ──────────────────────────────────────────────────
    draw.rectangle([0, 0, W, 52], fill=HEADER)
    draw.text((W // 2, 14), 'TPBL 2025–26  冠軍戰', fill=TEXT1, font=f_hdr, anchor='mt')
    draw.text((W - 24,  38), 'tpbl-lens.pages.dev', fill=TEXT2, font=f_brd, anchor='rs')

    # Thin separator line
    draw.rectangle([0, 52, W, 53], fill=_blend(CYAN, 40))

    # ── Game dots ───────────────────────────────────────────────────
    DOT_D   = 62
    DOT_GAP = 14
    n       = len(SERIES_GAMES)
    total_w = n * DOT_D + (n - 1) * DOT_GAP
    dot_x0  = (W - total_w) // 2
    dot_cy  = 172

    for i, g in enumerate(SERIES_GAMES):
        cx   = dot_x0 + i * (DOT_D + DOT_GAP) + DOT_D // 2
        bbox = [cx - DOT_D // 2, dot_cy - DOT_D // 2,
                cx + DOT_D // 2, dot_cy + DOT_D // 2]

        if g['tbd']:
            draw.ellipse(bbox, fill=TBD_FILL)
            _dashed_ellipse(draw, bbox, TEXT2, width=1)
            lbl_color = TEXT2
        elif g['home'] == 'f':
            draw.ellipse(bbox, fill=CYAN_FILL, outline=CYAN, width=2)
            lbl_color = CYAN
        else:
            draw.ellipse(bbox, fill=GOLD_FILL, outline=GOLD, width=2)
            lbl_color = GOLD

        draw.text((cx, dot_cy - 12), g['label'], fill=lbl_color, font=f_dlbl, anchor='mt')
        draw.text((cx, dot_cy + 6),  g['date'],  fill=TEXT2,     font=f_ddt,  anchor='mt')

    # ── Bar geometry (defines left/right team centers) ───────────────
    BAR_X  = 80
    BAR_W  = W - BAR_X * 2   # 1040
    BAR_H  = 30
    BAR_R  = BAR_H // 2      # 15
    F_PROB = 0.30
    split  = BAR_X + int(BAR_W * F_PROB)  # 392
    BAR_Y  = 468

    F_CX = 300   # visually balanced left-team center
    O_CX = 900   # visually balanced right-team center

    # ── Team short names ─────────────────────────────────────────────
    SHT_Y = 248
    FUL_Y = 288

    draw.text((F_CX, SHT_Y), '夢想家',        fill=CYAN,  font=f_sht, anchor='mt')
    draw.text((F_CX, FUL_Y), '福爾摩沙夢想家', fill=TEXT2, font=f_ful,  anchor='mt')
    draw.text((O_CX, SHT_Y), '國王',          fill=GOLD,  font=f_sht, anchor='mt')
    draw.text((O_CX, FUL_Y), '新北國王',      fill=TEXT2, font=f_ful,  anchor='mt')

    # ── Percentage numbers ───────────────────────────────────────────
    PCT_Y = 322
    draw.text((F_CX, PCT_Y), '30%', fill=CYAN, font=f_pct, anchor='mt')
    draw.text((O_CX, PCT_Y), '70%', fill=GOLD, font=f_pct, anchor='mt')

    # ── Opposition bar ───────────────────────────────────────────────
    # Full bar in gold (gives rounded right end)
    draw.rounded_rectangle(
        [BAR_X, BAR_Y, BAR_X + BAR_W, BAR_Y + BAR_H],
        radius=BAR_R, fill=GOLD,
    )
    # Overwrite left portion with cyan (left rounded end + body)
    draw.ellipse([BAR_X, BAR_Y, BAR_X + BAR_H, BAR_Y + BAR_H], fill=CYAN)
    draw.rectangle([BAR_X + BAR_R, BAR_Y, split, BAR_Y + BAR_H], fill=CYAN)

    # Glow divider at split point
    glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    gd   = ImageDraw.Draw(glow)
    gd.rectangle([split - 3, BAR_Y - 8, split + 3, BAR_Y + BAR_H + 8],
                 fill=(255, 255, 255, 180))
    glow = glow.filter(ImageFilter.GaussianBlur(radius=10))
    img_rgba = img.convert('RGBA')
    img_rgba = Image.alpha_composite(img_rgba, glow)
    # Sharp white line on top
    sharp = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    sd    = ImageDraw.Draw(sharp)
    sd.rectangle([split - 1, BAR_Y - 8, split + 1, BAR_Y + BAR_H + 8],
                 fill=(255, 255, 255, 230))
    img_rgba = Image.alpha_composite(img_rgba, sharp)
    img  = img_rgba.convert('RGB')
    draw = ImageDraw.Draw(img)

    # ── Bottom branding ──────────────────────────────────────────────
    draw.text((W // 2, 592), 'tpbl-lens.pages.dev', fill=TEXT2, font=f_brd, anchor='mt')

    out_dir  = os.path.join(base_dir, 'dist', 'og')
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, 'championship.png')
    img.save(out_path, 'PNG', optimize=True)
    print(f'[og] {out_path}')


if __name__ == '__main__':
    generate_og_championship()
