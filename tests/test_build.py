# tests/test_build.py
import importlib, os, sys, pytest

def _setup(tmp_path):
    (tmp_path / "templates").mkdir()
    (tmp_path / "templates" / "_head.html").write_text("<head>", encoding="utf-8")
    (tmp_path / "templates" / "_nav.html").write_text("<nav>", encoding="utf-8")
    (tmp_path / "templates" / "_footer.html").write_text("<footer>", encoding="utf-8")
    (tmp_path / "pages").mkdir()
    (tmp_path / "pages" / "index.html").write_text("{{HEAD}}{{NAV}}idx{{FOOTER}}", encoding="utf-8")
    (tmp_path / "pages" / "team.html").write_text("{{HEAD}}{{TEAM_SLUG}}|{{TEAM_NAME}}|{{TEAM_TITLE}}{{FOOTER}}", encoding="utf-8")
    (tmp_path / "js").mkdir()
    (tmp_path / "js" / "league.js").write_text("// league", encoding="utf-8")
    (tmp_path / "data").mkdir()
    (tmp_path / "data" / "league_2526.json").write_text("{}", encoding="utf-8")

def _build(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    if "build" in sys.modules:
        del sys.modules["build"]
    import build as b
    b.build()
    return b

def test_inject_replaces_all_placeholders():
    sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent.parent))
    if "build" in sys.modules: del sys.modules["build"]
    import build as b
    result = b.inject_partials("{{HEAD}} {{NAV}} {{FOOTER}}", "H", "N", "F")
    assert result == "H N F"
    assert "{{" not in result

def test_build_creates_index(tmp_path, monkeypatch):
    _setup(tmp_path)
    _build(tmp_path, monkeypatch)
    assert (tmp_path / "dist" / "index.html").exists()

def test_build_injects_partials_into_index(tmp_path, monkeypatch):
    _setup(tmp_path)
    _build(tmp_path, monkeypatch)
    content = (tmp_path / "dist" / "index.html").read_text(encoding="utf-8")
    assert "<head>" in content and "<nav>" in content and "<footer>" in content
    assert "{{HEAD}}" not in content

def test_build_creates_team_pages(tmp_path, monkeypatch):
    _setup(tmp_path)
    _build(tmp_path, monkeypatch)
    assert (tmp_path / "dist" / "formosa" / "index.html").exists()
    assert (tmp_path / "dist" / "lions" / "index.html").exists()

def test_build_substitutes_team_slug(tmp_path, monkeypatch):
    _setup(tmp_path)
    _build(tmp_path, monkeypatch)
    c = (tmp_path / "dist" / "formosa" / "index.html").read_text(encoding="utf-8")
    assert "formosa" in c
    assert "{{TEAM_SLUG}}" not in c

def test_build_copies_js(tmp_path, monkeypatch):
    _setup(tmp_path)
    _build(tmp_path, monkeypatch)
    assert (tmp_path / "dist" / "js" / "league.js").exists()

def test_build_copies_data_json(tmp_path, monkeypatch):
    _setup(tmp_path)
    _build(tmp_path, monkeypatch)
    assert (tmp_path / "dist" / "data" / "league_2526.json").exists()
