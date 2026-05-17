# build.py
import os, shutil, glob, importlib.util

TEMPLATES = "templates"
PAGES     = "pages"
JS_DIR    = "js"
DATA_DIR  = "data"
DIST      = "dist"

TEAM_PAGES = [
    {"slug": "formosa",  "name": "福爾摩沙夢想家",   "title": "夢想家 2025-26 賽季分析｜TPBL-Lens"},
    {"slug": "lions",    "name": "新竹御嵿攻城獅",    "title": "攻城獅 2025-26 賽季分析｜TPBL-Lens"},
    {"slug": "aquas",    "name": "高雄全家海神",       "title": "海神 2025-26 賽季分析｜TPBL-Lens"},
    {"slug": "leopards", "name": "桃園台啤永豐雲豹",   "title": "雲豹 2025-26 賽季分析｜TPBL-Lens"},
    {"slug": "braves",   "name": "新北中信特攻",       "title": "特攻 2025-26 賽季分析｜TPBL-Lens"},
    {"slug": "kings",    "name": "新北國王",           "title": "國王 2025-26 賽季分析｜TPBL-Lens"},
    {"slug": "warriors", "name": "臺北台新戰神",       "title": "戰神 2025-26 賽季分析｜TPBL-Lens"},
]

CHAMP_PAGES = [
    {"slug": "championship", "title": "夢想家冠軍戰分析 2025-26｜TPBL-Lens"},
]

CAL_PAGES = [
    {"slug": "formosa", "name": "福爾摩沙夢想家", "title": "夢想家預測校準紀錄｜TPBL-Lens"},
    {"slug": "lions",   "name": "新竹御嵿攻城獅", "title": "攻城獅預測校準紀錄｜TPBL-Lens"},
]

def _read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()

def _write(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)

def inject_partials(content, head, nav, footer):
    content = content.replace("{{HEAD}}", head)
    content = content.replace("{{NAV}}", nav)
    content = content.replace("{{FOOTER}}", footer)
    return content

def build():
    head   = _read(os.path.join(TEMPLATES, "_head.html"))
    nav    = _read(os.path.join(TEMPLATES, "_nav.html"))
    footer = _read(os.path.join(TEMPLATES, "_footer.html"))

    index_src = _read(os.path.join(PAGES, "index.html"))
    _write(os.path.join(DIST, "index.html"),
           inject_partials(index_src, head, nav, footer))

    team_src = _read(os.path.join(PAGES, "team.html"))
    for t in TEAM_PAGES:
        content = inject_partials(team_src, head, nav, footer)
        content = content.replace("{{TEAM_SLUG}}", t["slug"])
        content = content.replace("{{TEAM_NAME}}", t["name"])
        content = content.replace("{{TEAM_TITLE}}", t["title"])
        _write(os.path.join(DIST, t["slug"], "index.html"), content)

    champ_src = _read(os.path.join(PAGES, "championship.html"))
    for t in CHAMP_PAGES:
        content = inject_partials(champ_src, head, nav, footer)
        content = content.replace("{{TEAM_SLUG}}", t["slug"])
        _write(os.path.join(DIST, t["slug"], "index.html"), content)

    cal_src = _read(os.path.join(PAGES, "calibration.html"))
    for t in CAL_PAGES:
        content = inject_partials(cal_src, head, nav, footer)
        content = content.replace("{{TEAM_SLUG}}", t["slug"])
        content = content.replace("{{TEAM_NAME}}", t["name"])
        content = content.replace("{{TEAM_TITLE}}", t["title"])
        _write(os.path.join(DIST, t["slug"], "calibration", "index.html"), content)

    dist_js = os.path.join(DIST, "js")
    if os.path.exists(dist_js):
        shutil.rmtree(dist_js)
    if os.path.exists(JS_DIR):
        shutil.copytree(JS_DIR, dist_js)

    dist_data = os.path.join(DIST, "data")
    os.makedirs(dist_data, exist_ok=True)
    for jf in glob.glob(os.path.join(DATA_DIR, "*.json")):
        shutil.copy2(jf, dist_data)

    if os.path.exists("favicon.svg"):
        shutil.copy2("favicon.svg", os.path.join(DIST, "favicon.svg"))

    _build_robots()
    _build_sitemap()
    _build_og_images()

    print("[build] dist/ updated")


BASE_URL = "https://tpbl-lens.pages.dev"


def _build_robots():
    lines = [
        "User-agent: *",
        "Allow: /",
        "Disallow: /*/calibration/",
        "",
        f"Sitemap: {BASE_URL}/sitemap.xml",
    ]
    _write(os.path.join(DIST, "robots.txt"), "\n".join(lines) + "\n")


def _build_sitemap():
    urls = [{"loc": f"{BASE_URL}/", "priority": "1.0"}]
    for t in TEAM_PAGES:
        urls.append({"loc": f"{BASE_URL}/{t['slug']}/", "priority": "0.8"})

    items = ""
    for u in urls:
        items += (
            f"  <url>\n"
            f"    <loc>{u['loc']}</loc>\n"
            f"    <changefreq>daily</changefreq>\n"
            f"    <priority>{u['priority']}</priority>\n"
            f"  </url>\n"
        )

    xml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + items
        + "</urlset>\n"
    )
    _write(os.path.join(DIST, "sitemap.xml"), xml)

def _build_og_images():
    try:
        from generate_og_pace import generate_og_pace
        generate_og_pace()
    except ImportError:
        print("[build] Pillow not installed — skipping OG image (pip install Pillow)")
    except Exception as e:
        print(f"[build] OG image generation failed: {e}")


if __name__ == "__main__":
    build()
