# generate_og_championship.py — OG image for championship page
# Requires: pip install Pillow
import json, os, random
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

# ── 固定賽程框架（主場標記）──
_SCHED_TEMPLATE = [
    {'label': 'G1', 'date': '5/24', 'home': 'f'},
    {'label': 'G2', 'date': '5/26', 'home': 'f'},
    {'label': 'G3', 'date': '5/29', 'home': 'o'},
    {'label': 'G4', 'date': '5/31', 'home': 'o'},
    {'label': 'G5', 'date': '6/2',  'home': 'f'},
    {'label': 'G6', 'date': '6/4',  'home': 'o'},
    {'label': 'G7', 'date': '6/6',  'home': 'f'},
]

# ── 讀取 championship_2526.json 動態資料 ──
def _load_series_data(base_dir):
    path = os.path.join(base_dir, 'data', 'championship_2526.json')
    try:
        with open(path, encoding='utf-8') as f:
            d = json.load(f)
    except Exception:
        return [], None, None
    opp_key = d.get('active_opponent', 'kings')
    played  = [g for g in (d.get('championship_series') or [])
               if g.get('opp_key') == opp_key]
    fm_champ  = d.get('formosa_champ')
    opp_champ = d.get(opp_key + '_champ')
    fm_reg    = d.get('formosa', {})
    opp_reg   = d.get(opp_key, {})
    return played, (fm_champ or fm_reg), (opp_champ or opp_reg)

# ── 相同機率模型（與 championship.js 一致）──
_SCHED_HOME = [g['home'] for g in _SCHED_TEMPLATE]  # ['f','f','o','o','f','o','f']

def _sim_series(p_home, p_away, sched, f_need, k_need, n=300_000):
    rng = random.Random(42)
    f_wins = 0
    for _ in range(n):
        fn, kn = f_need, k_need
        for side in sched:
            p = p_home if side == 'f' else p_away
            if rng.random() < p:
                fn -= 1
            else:
                kn -= 1
            if fn == 0:
                f_wins += 1
                break
            if kn == 0:
                break
    return f_wins / n

def _calc_prob(played, fm, opp):
    h2h_key   = 'h2h_kings'  # always kings for now
    h2h       = []            # not needed for accuracy
    n_played  = len(played)
    f_w = sum(1 for g in played if g.get('won'))
    k_w = n_played - f_w
    # 系列賽已分勝負：直接回傳確定機率（_sim_series 對 need=0 的 edge case 會失準）
    if f_w >= 4:
        return 1.0
    if k_w >= 4:
        return 0.0
    # formWinRate
    if n_played > 0:
        form_wr = f_w / n_played
    else:
        form_wr = 0.5  # fallback
    net_diff  = (fm.get('netrtg') or 0) - (opp.get('netrtg') or 0)
    net_prob  = min(0.82, max(0.18, 0.5 + net_diff * 0.025))
    game_prob = min(0.78, max(0.22, net_prob * 0.6 + form_wr * 0.4))
    HOME_BOOST = 0.10
    p_home = min(0.82, game_prob + HOME_BOOST)
    p_away = max(0.18, game_prob - HOME_BOOST)
    remain_sched = _SCHED_HOME[n_played:]
    f_need = 4 - f_w
    k_need = 4 - k_w
    return _sim_series(p_home, p_away, remain_sched, f_need, k_need)

def _build_series_games(played):
    """合併固定框架與已打結果，回傳 display 用 list。"""
    played_map = {g['game']: g for g in played}
    games = []
    for t in _SCHED_TEMPLATE:
        lbl = t['label']
        p   = played_map.get(lbl)
        if p:
            games.append({
                'label': lbl,
                'date':  str(p['date'])[4:6].lstrip('0') + '/' + str(p['date'])[6:8].lstrip('0'),
                'home':  t['home'],
                'tbd':   False,
                'won':   p.get('won'),          # True=夢贏 False=王贏
                'done':  True,
            })
        else:
            games.append({
                'label': lbl,
                'date':  t['date'],
                'home':  t['home'],
                'tbd':   True,
                'done':  False,
            })
    return games


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


def _draw_crown(draw, cx, cy, w, color):
    """簡易皇冠（純色多邊形，避免 emoji 在 PIL 字型缺字）。"""
    h = w * 0.62
    left, right = cx - w / 2, cx + w / 2
    top, bot = cy - h / 2, cy + h / 2
    band_h = h * 0.26
    q1, q3 = left + w / 4, right - w / 4
    pts = [
        (left, bot - band_h),
        (left, top + h * 0.15),
        (q1, top + h * 0.58),
        (cx, top),
        (q3, top + h * 0.58),
        (right, top + h * 0.15),
        (right, bot - band_h),
    ]
    draw.polygon(pts, fill=color)
    draw.rectangle([int(left), int(bot - band_h), int(right), int(bot)], fill=color)
    r = max(3, w / 22)
    for (x, y) in [(left, top + h * 0.15), (cx, top), (right, top + h * 0.15)]:
        draw.ellipse([x - r, y - r, x + r, y + r], fill=color)


def generate_og_championship(base_dir=None):
    if base_dir is None:
        base_dir = os.path.dirname(os.path.abspath(__file__))

    # ── 動態資料 ──────────────────────────────────────────────────────
    played, fm, opp = _load_series_data(base_dir)
    series_games    = _build_series_games(played)
    f_prob          = _calc_prob(played, fm or {}, opp or {})
    f_pct_int       = round(f_prob * 100)
    o_pct_int       = 100 - f_pct_int

    f_w_done = sum(1 for g in played if g.get('won'))
    k_w_done = len(played) - f_w_done
    clinched = f_w_done >= 4 or k_w_done >= 4

    fp_b = _find_font(bold=True)
    fp_r = _find_font(bold=False)

    f_hdr  = _font(fp_b, 20)
    f_brd  = _font(fp_r, 14)
    f_dlbl = _font(fp_b, 15)
    f_ddt  = _font(fp_r, 11)
    f_sht  = _font(fp_b, 30)
    f_ful  = _font(fp_r, 17)
    f_pct  = _font(fp_b, 86)
    f_sub  = _font(fp_b, 13)

    img  = Image.new('RGB', (W, H), BG)
    draw = ImageDraw.Draw(img)

    # ── Header bar ──────────────────────────────────────────────────
    draw.rectangle([0, 0, W, 52], fill=HEADER)
    draw.text((W // 2, 14), 'TPBL 2025–26  冠軍賽', fill=TEXT1, font=f_hdr, anchor='mt')
    draw.text((W - 24,  38), 'tpbl-lens.pages.dev', fill=TEXT2, font=f_brd, anchor='rs')

    # Thin separator line
    draw.rectangle([0, 52, W, 53], fill=_blend(CYAN, 40))

    # ── Game dots ───────────────────────────────────────────────────
    DOT_D   = 62
    DOT_GAP = 14
    n       = len(series_games)
    total_w = n * DOT_D + (n - 1) * DOT_GAP
    dot_x0  = (W - total_w) // 2
    dot_cy  = 172

    for i, g in enumerate(series_games):
        cx   = dot_x0 + i * (DOT_D + DOT_GAP) + DOT_D // 2
        bbox = [cx - DOT_D // 2, dot_cy - DOT_D // 2,
                cx + DOT_D // 2, dot_cy + DOT_D // 2]

        if g['tbd']:
            draw.ellipse(bbox, fill=TBD_FILL)
            _dashed_ellipse(draw, bbox, TEXT2, width=1)
            lbl_color = TEXT2
            sub_text  = g['date']
        elif g['home'] == 'f':
            draw.ellipse(bbox, fill=CYAN_FILL, outline=CYAN, width=2)
            lbl_color = CYAN
            sub_text  = 'D' if g.get('won') else 'K'
        else:
            draw.ellipse(bbox, fill=GOLD_FILL, outline=GOLD, width=2)
            lbl_color = GOLD
            sub_text  = 'D' if g.get('won') else 'K'

        draw.text((cx, dot_cy - 12), g['label'], fill=lbl_color, font=f_dlbl, anchor='mt')
        draw.text((cx, dot_cy + 6),  sub_text,   fill=TEXT2,     font=f_ddt,  anchor='mt')

    # ── Series score subtitle (進行中才顯示；冠軍版面有自己的系列賽列) ──
    if played and not clinched:
        f_w = sum(1 for g in played if g.get('won'))
        k_w = len(played) - f_w
        score_txt = f'夢想家 {f_w}  –  {k_w} 國王'
        draw.text((W // 2, dot_cy + DOT_D // 2 + 8), score_txt,
                  fill=TEXT2, font=f_sub, anchor='mt')

    if clinched:
        # ── 冠軍慶祝版面 ──────────────────────────────────────────────
        champ_fm    = f_w_done >= 4
        champ_full  = '福爾摩沙夢想家' if champ_fm else '新北國王'
        champ_color = CYAN if champ_fm else GOLD
        beaten      = '國王' if champ_fm else '夢想家'
        hi, lo      = max(f_w_done, k_w_done), min(f_w_done, k_w_done)

        f_champ_name = _font(fp_b, 66)
        f_champ_sub  = _font(fp_b, 30)
        f_champ_ser  = _font(fp_r, 24)

        _draw_crown(draw, W // 2, 258, 116, GOLD)
        draw.text((W // 2, 300), champ_full, fill=champ_color, font=f_champ_name, anchor='mt')
        draw.text((W // 2, 392), '2025–26 TPBL 年度總冠軍', fill=GOLD, font=f_champ_sub, anchor='mt')
        draw.text((W // 2, 448), f'系列賽 {hi} – {lo} 擊敗 {beaten}',
                  fill=TEXT2, font=f_champ_ser, anchor='mt')
    else:
        # ── Bar geometry ────────────────────────────────────────────────
        BAR_X  = 80
        BAR_W  = W - BAR_X * 2   # 1040
        BAR_H  = 30
        BAR_R  = BAR_H // 2
        split  = BAR_X + int(BAR_W * f_prob)
        BAR_Y  = 468

        F_CX = 300
        O_CX = 900

        # ── Team short names ─────────────────────────────────────────────
        SHT_Y = 248
        FUL_Y = 288

        draw.text((F_CX, SHT_Y), '夢想家',        fill=CYAN,  font=f_sht, anchor='mt')
        draw.text((F_CX, FUL_Y), '福爾摩沙夢想家', fill=TEXT2, font=f_ful,  anchor='mt')
        draw.text((O_CX, SHT_Y), '國王',          fill=GOLD,  font=f_sht, anchor='mt')
        draw.text((O_CX, FUL_Y), '新北國王',      fill=TEXT2, font=f_ful,  anchor='mt')

        # ── Percentage numbers ───────────────────────────────────────────
        PCT_Y = 322
        draw.text((F_CX, PCT_Y), f'{f_pct_int}%', fill=CYAN, font=f_pct, anchor='mt')
        draw.text((O_CX, PCT_Y), f'{o_pct_int}%', fill=GOLD, font=f_pct, anchor='mt')

        # ── Opposition bar ───────────────────────────────────────────────
        draw.rounded_rectangle(
            [BAR_X, BAR_Y, BAR_X + BAR_W, BAR_Y + BAR_H],
            radius=BAR_R, fill=GOLD,
        )
        draw.ellipse([BAR_X, BAR_Y, BAR_X + BAR_H, BAR_Y + BAR_H], fill=CYAN)
        draw.rectangle([BAR_X + BAR_R, BAR_Y, split, BAR_Y + BAR_H], fill=CYAN)

        # Glow divider
        glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        gd   = ImageDraw.Draw(glow)
        gd.rectangle([split - 3, BAR_Y - 8, split + 3, BAR_Y + BAR_H + 8],
                     fill=(255, 255, 255, 180))
        glow = glow.filter(ImageFilter.GaussianBlur(radius=10))
        img_rgba = img.convert('RGBA')
        img_rgba = Image.alpha_composite(img_rgba, glow)
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
