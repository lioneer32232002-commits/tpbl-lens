# build.py
import os, shutil, glob

TEMPLATES = "templates"
PAGES     = "pages"
JS_DIR    = "js"
DATA_DIR  = "data"
DIST      = "dist"

TEAM_PAGES = [
    {"slug": "formosa", "name": "福爾摩沙夢想家", "title": "夢想家 2025-26 賽季分析｜TPBL-Lens"},
    {"slug": "lions",   "name": "新竹御嵿攻城獅",  "title": "攻城獅 2025-26 賽季分析｜TPBL-Lens"},
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

    dist_js = os.path.join(DIST, "js")
    if os.path.exists(dist_js):
        shutil.rmtree(dist_js)
    if os.path.exists(JS_DIR):
        shutil.copytree(JS_DIR, dist_js)

    dist_data = os.path.join(DIST, "data")
    os.makedirs(dist_data, exist_ok=True)
    for jf in glob.glob(os.path.join(DATA_DIR, "*.json")):
        shutil.copy2(jf, dist_data)

    print("[build] dist/ updated")

if __name__ == "__main__":
    build()
