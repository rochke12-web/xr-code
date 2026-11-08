"""Light mode -> strict white & black monochrome (dark OLED+silver untouched)."""
import os

OUT = '/home/z/my-project/download/xr-code.html'
html = open(OUT).read()

old = '''  --bg:#f2edf9;
  --bg-marble:
    radial-gradient(1000px 460px at 50% -14%, rgba(255,255,255,.9), transparent 60%),
    radial-gradient(760px 380px at 90% 112%, rgba(151,120,255,.12), transparent 60%),
    linear-gradient(180deg,#f6f2fc 0%, #ece5f7 100%);
  --bg2:#ffffff;
  --panel:rgba(255,255,255,.72);
  --panel-2:rgba(255,255,255,.95);
  --text:#241d3a;
  --muted:#6f6885;
  --accent:#6d4dff;
  --accent-2:#9d7bff;
  --accent-ink:#ffffff;
  --line:rgba(80,55,160,.16);
  --line-soft:rgba(80,55,160,.09);
  --col-a:rgba(122,92,222,.14);
  --col-b:rgba(122,92,222,.03);
  --col-line:rgba(122,92,222,.22);
  --danger:#d64550;
  --ok:#1d9e5b;
  --shadow:0 18px 44px rgba(90,60,180,.16);'''

new = '''  --bg:#f7f7f8;
  --bg-marble:
    radial-gradient(1000px 460px at 50% -14%, rgba(255,255,255,.95), transparent 60%),
    radial-gradient(760px 380px at 90% 112%, rgba(0,0,0,.045), transparent 60%),
    linear-gradient(180deg,#ffffff 0%, #f2f2f4 100%);
  --bg2:#ffffff;
  --panel:rgba(255,255,255,.82);
  --panel-2:rgba(255,255,255,.97);
  --text:#0b0b0d;
  --muted:#6d7076;
  --accent:#101216;
  --accent-2:#3f434b;
  --accent-ink:#ffffff;
  --line:rgba(0,0,0,.13);
  --line-soft:rgba(0,0,0,.07);
  --col-a:rgba(0,0,0,.10);
  --col-b:rgba(0,0,0,.02);
  --col-line:rgba(0,0,0,.18);
  --danger:#d64550;
  --ok:#1d9e5b;
  --shadow:0 18px 44px rgba(0,0,0,.14);'''

assert html.count(old) == 1, 'light palette block not found'
html = html.replace(old, new)

open(OUT, 'w').write(html)
print('light mode -> white & black, size:', os.path.getsize(OUT)//1024, 'KB')
