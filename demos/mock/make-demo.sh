#!/bin/bash
# Regenerates mta-mock-tour.gif / mta-mock-tour.webm from ui-mockup/index.html.
# Every scene carries a caption overlay naming the screen and what to notice.
# Requirements: google-chrome (headless), python3 + Pillow, ffmpeg, Red Hat fonts
# (/usr/share/fonts/redhat). Run from any directory; writes frames to /tmp.
set -euo pipefail
OUT="$(cd "$(dirname "$0")" && pwd)"   # demos/mock/
cd "$(dirname "$0")/../../deliverables/ui-mockup"   # read index.html + write nothing here
WORK=/tmp/opencode/demo-run
mkdir -p "$WORK/frames"

# 1. working copy + welcome-skip for all personas (skips the welcome overlay)
python3 - "$WORK" <<'PYEOF'
import sys
work = sys.argv[1]
s = open('index.html', encoding='utf-8').read()
inject = """<script>
try { ["architect","pgm","pm","migrator","padmin"].forEach(function(p){
        localStorage.setItem("mta.welcome."+p,"1"); }); } catch(e) {}
/* demo driver: fx=<px> scrolls the main pane after render; click=<selector>
   drops a click marker on that element (skipped when hidden or occluded) */
window.addEventListener('load', function(){
  var m = location.hash.match(/fx=(\\d+)/);
  if (m) setTimeout(function(){
    var el = document.querySelector('.pf-v6-c-page__main');
    if (el) el.scrollTop = parseInt(m[1], 10);
  }, 350);
  var c = location.hash.match(/click=([^&]+)/);
  if (c) setTimeout(function(){
    var el = document.querySelector(decodeURIComponent(c[1]));
    if (!el) return;
    var r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    var cx = r.left + r.width/2, cy = r.top + r.height/2;
    if (cx < 8 || cy < 8 || cx > window.innerWidth - 8 || cy > window.innerHeight - 8) return;
    var hit = document.elementFromPoint(cx, cy);
    if (!hit || !(hit === el || el.contains(hit) || hit.contains(el))) return;
    var d = document.createElement('div');
    d.id = 'demoClick';
    d.style.left = cx + 'px';
    d.style.top = cy + 'px';
    document.body.appendChild(d);
    /* speech bubble with the explanatory text, next to the click marker */
    var b = location.hash.match(/bubble=([^&]+)/);
    if (!b) return;
    var bub = document.createElement('div');
    bub.id = 'demoBubble';
    /* the Clippy avatar: a paperclip with eyes, pupils looking toward the click */
    bub.innerHTML = '<svg viewBox="0 0 44 60" width="52" height="72" aria-hidden="true">'
      + '<g fill="none" stroke="#0066cc" stroke-width="3.6" stroke-linecap="round">'
      + '<path d="M13 7 L13 43 A9 9 0 0 0 31 43 L31 15 A6.5 6.5 0 0 0 18 15 L18 40 A3 3 0 0 0 24 40 L24 21"/></g>'
      + '<ellipse cx="19.5" cy="20" rx="5.4" ry="6.8" fill="#fff" stroke="#151515" stroke-width="1.4"/>'
      + '<ellipse cx="30.5" cy="20" rx="5.4" ry="6.8" fill="#fff" stroke="#151515" stroke-width="1.4"/>'
      + '<circle cx="21" cy="21.5" r="2" fill="#151515"/><circle cx="32" cy="21.5" r="2" fill="#151515"/></svg>';
    var sp = document.createElement('span');
    sp.textContent = decodeURIComponent(b[1]);
    bub.appendChild(sp);
    document.body.appendChild(bub);
    var bw = bub.offsetWidth, bh = bub.offsetHeight, gap = 28;
    var right = cx + gap < window.innerWidth - bw - 12;
    var left = right ? cx + gap : cx - gap - bw;
    var top = Math.max(12, Math.min(cy - bh/2, window.innerHeight - 12 - bh));
    var tail;
    if (cy < top + 16) tail = 'b-top';
    else if (cy > top + bh - 16) tail = 'b-bottom';
    else tail = right ? 'b-left' : 'b-right';
    bub.className = tail;
    bub.style.left = left + 'px';
    bub.style.top = top + 'px';
  }, 500);
});
</script>
<style>
#demoClick{position:fixed;width:34px;height:34px;margin:-17px 0 0 -17px;border-radius:50%;
  border:3px solid #0066cc;background:rgba(0,102,204,.18);z-index:2147483000;pointer-events:none;
  box-shadow:0 0 0 4px rgba(255,255,255,.85),0 0 18px rgba(0,102,204,.8);}
#demoClick:after{content:'';position:absolute;left:50%;top:50%;width:10px;height:10px;margin:-5px 0 0 -5px;
  border-radius:50%;background:#0066cc;box-shadow:0 0 0 2px #fff;}
#demoBubble{position:fixed;z-index:2147483001;pointer-events:none;max-width:400px;
  background:#fff;color:#151515;border:2px solid #0066cc;border-radius:12px;
  padding:10px 16px 10px 12px;font:500 23px/1.4 "Red Hat Text",Helvetica,Arial,sans-serif;
  box-shadow:0 0 0 4px rgba(255,255,255,.85),0 6px 16px rgba(0,0,0,.28);
  display:flex;gap:10px;align-items:center;}
#demoBubble svg{flex:none;}
#demoBubble:after{content:'';position:absolute;width:14px;height:14px;background:#fff;}
#demoBubble.b-left:after{left:-8px;top:50%;margin-top:-7px;border-left:2px solid #0066cc;border-bottom:2px solid #0066cc;transform:rotate(45deg);}
#demoBubble.b-right:after{right:-8px;top:50%;margin-top:-7px;border-right:2px solid #0066cc;border-top:2px solid #0066cc;transform:rotate(45deg);}
#demoBubble.b-top:after{top:-8px;left:28px;border-left:2px solid #0066cc;border-top:2px solid #0066cc;transform:rotate(45deg);}
#demoBubble.b-bottom:after{bottom:-8px;left:28px;border-right:2px solid #0066cc;border-bottom:2px solid #0066cc;transform:rotate(45deg);}
</style></body>"""
assert s.count('</body>') == 1
open(work + '/mock-demo.html', 'w', encoding='utf-8').write(s.replace('</body>', inject))
PYEOF

# 2. capture manifest: scene|hash&fx=<scroll-px>|click-selector-or-empty|bubble-text
#    the click selector is URL-encoded and appended to the LAST step's hash,
#    so the marker appears at "click time" (final motion frame + hold); the
#    speech bubble (bubble=, url-encoded) rides along and carries the short
#    explanation of the click next to the marker (the long prose stays in the
#    caption bar)
#    persona tour: Northwind org — architect, then migrator, pm, pgm (3 scenes each,
#    following each persona's in-mock guided tour)
scenes=(
  "arch-home|scr=home&persona=architect&org=nwf|||0 200 400 600 800"
  "arch-inventory|scr=inventory&persona=architect&org=nwf|%5Bdata-screen%3D%22inventory%22%5D|Opens the application inventory — the single store of record.|0 130 260 390 520 650"
  "arch-waves|scr=waves&persona=architect&org=nwf|%5Bdata-screen%3D%22waves%22%5D|Opens Migration waves — composition, gates and the planned-vs-actual timeline.|0 130 260 390 520 650 780"
  "mig-home|scr=home&persona=migrator&org=nwf|%23personaBtn|Switches to the migrator — scope pins to the Claims team.|0 200 400 600 800"
  "mig-incidents|scr=incidents&persona=migrator&org=nwf|%5Bdata-screen%3D%22incidents%22%5D|Opens the triage queue — the migrator’s daily work surface.|0 130 260 390 520 640"
  "mig-modal|scr=incidents&persona=migrator&org=nwf&drawer=incident|||0 0 0 0"
  "pm-home|scr=home&persona=pm&org=nwf|%23personaBtn|Switches to the project manager — read-only and team-locked.|0 200 400 600 800"
  "pm-waves|scr=waves&persona=pm&org=nwf|%5Bdata-screen%3D%22waves%22%5D|Opens Migration waves — the numbers to bring to the program review.|0 130 260 390 520 650"
  "pm-reports|scr=reports&persona=pm&org=nwf|%5Bdata-screen%3D%22reports%22%5D|Opens Reports — effort and progress rollups, scoped to the team.|0 130 260 390 520 640"
  "pgm-home|scr=home&persona=pgm&org=nwf|%23personaBtn|Switches to the program manager — org-wide scope.|0 200 400 600 800"
  "pgm-waves|scr=waves&persona=pgm&org=nwf|%5Bdata-screen%3D%22waves%22%5D|Opens the cross-team composition card — waves spanning more than one team.|0 130 260 390 520 650 780"
  "pgm-tasks|scr=tasks&persona=pgm&org=nwf|%5Bdata-screen%3D%22tasks%22%5D|Opens the task manager — the escalation surface for shared platform work.|0 130 260 390 520 640"
)
: > "$WORK/manifest.txt"
for s in "${scenes[@]}"; do
  name="${s%%|*}"; rest="${s#*|}"; hash="${rest%%|*}"; rest="${rest#*|}"; click="${rest%%|*}"; rest="${rest#*|}"; bubble="${rest%%|*}"; steps="${rest#*|}"
  i=0; n=$(wc -w <<< "$steps")
  for fx in $steps; do
    h="${hash}&fx=${fx}"
    if [ $((i+1)) -eq "$n" ] && [ -n "$click" ]; then
      bub=$(python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$bubble")
      h="${h}&click=${click}&bubble=${bub}"
    fi
    echo "${name}_$(printf %02d $i)|${h}" >> "$WORK/manifest.txt"
    i=$((i+1))
  done
done

# 3. capture (4 parallel headless-Chrome instances)
cat > "$WORK/cap.sh" <<'EOF'
#!/bin/bash
e="${1%%|*}"; h="${1#*|}"
google-chrome --headless=new --disable-gpu --no-sandbox --window-size=1920,1080 \
  --screenshot="/tmp/opencode/demo-run/frames/$e.png" --virtual-time-budget=9000 \
  "file:///tmp/opencode/demo-run/mock-demo.html#$h" 2>/dev/null >/dev/null
EOF
chmod +x "$WORK/cap.sh"
xargs -P 4 -I{} "$WORK/cap.sh" {} < "$WORK/manifest.txt"

# 4. captions, title/outro cards (brand fonts) + assembly
python3 - "$OUT" <<'PYEOF'
import sys
from PIL import Image, ImageDraw, ImageFont
out, work = sys.argv[1], '/tmp/opencode/demo-run'
W, H = 1920, 1080
f1  = ImageFont.truetype("/usr/share/fonts/redhat/RedHatDisplay-Bold.otf", 88)
f2  = ImageFont.truetype("/usr/share/fonts/redhat/RedHatDisplay-Regular.otf", 44)
f3  = ImageFont.truetype("/usr/share/fonts/redhat/RedHatText-Regular.otf", 30)
f4  = ImageFont.truetype("/usr/share/fonts/redhat/RedHatText-Bold.otf", 34)
f5  = ImageFont.truetype("/usr/share/fonts/redhat/RedHatText-Regular.otf", 34)
BLUE, GRAY, WHITE = (0,102,204), (170,170,170), (255,255,255)

def caption(im, label, text, badge=None):
    d = ImageDraw.Draw(im, "RGBA")
    bh = 152
    d.rectangle([0, H-bh, W, H], fill=(21,21,21,232))
    d.rectangle([0, H-bh, 10, H], fill=BLUE+(255,))
    x = 40
    # line 1: persona badge + scene label
    if badge:
        bw = d.textlength(badge, font=f4) + 28
        d.rounded_rectangle([x, H-bh+22, x+bw, H-bh+66], 8, fill=(45,46,110,255))
        d.text((x+14, H-bh+27), badge, font=f4, fill=WHITE)
        x += bw + 24
    d.text((x, H-bh+26), label, font=f4, fill=(140,175,255))
    # line 2: explanation, wrapped to fit
    maxw = W - 80
    words, line, lines_out = text.split(), "", []
    for wd in words:
        t = (line + " " + wd).strip()
        if d.textlength(t, font=f3) <= maxw:
            line = t
        else:
            lines_out.append(line); line = wd
    lines_out.append(line)
    ytxt = H-bh+76
    for ln in lines_out[:2]:
        d.text((40, ytxt), ln, font=f3, fill=WHITE)
        ytxt += 42
    return im

def card(lines):
    im = Image.new("RGB", (W,H), (21,21,21)); d = ImageDraw.Draw(im)
    d.rectangle([0,0,16,H], fill=BLUE)
    y = (H - sum(f.size for _,f,_ in lines) - (len(lines)-1)*40)//2 - 30
    for txt,f,c in lines:
        d.text(((W-d.textlength(txt,font=f))/2, y), txt, font=f, fill=c); y += f.size+40
    return im

card([("Migration Toolkit for Applications",f1,WHITE),
      ("UI mockup — role-based guided tour",f2,GRAY),
      ("Northwind Financial · architect → migrator → project mgr → program mgr",f3,GRAY),
      ("real PatternFly 6.7.0 · 8 locales · light/dark · tenancy-scoped",f3,GRAY)]
     ).save(work+'/frames/card_title.png')
card([("Try it yourself",f1,WHITE),
      ("ui-mockup/index.html — deep-linkable: #scr=…&persona=…&lang=…&scheme=…",f3,GRAY),
      ("every frame above is a real render of the mock",f3,GRAY)]).save(work+'/frames/card_outro.png')

# tour scenes: (frame-name, n-steps, persona badge, caption label, explanation)
# one persona section at a time — Northwind org, following each persona's own
# in-mock guided tour (TOURS in index.html)
TOUR = [
    ("arch-home", 5, "Architect", "Portfolio health at a glance",
     "The architect's org-wide landing: effort rollup (#4), combined risk (#32) and analysis coverage \u2014 \u201cWhere is the portfolio hurting?\u201d answered before any click."),
    ("arch-inventory", 6, "Architect", "Applications \u2014 the inventory",
     "The single store of record: filter by risk or analysis state (#2), sort by effort (#4), wave assignment and risk provenance (#32) on every row."),
    ("arch-waves", 7, "Architect", "Migration waves \u2014 planning & gates",
     "Wave composition with gates and timeline (#46): planned vs actual, the quota-blocked gate (#38) and per-wave agent-spend showback (#20)."),
    ("mig-home", 5, "Migrator", "A team-locked landing",
     "Switched to the migrator \u2014 scope pinned to the Claims team (#41): assignments and my work first, no portfolio noise, no Administration entries."),
    ("mig-incidents", 6, "Migrator", "Incidents \u2014 the triage queue",
     "The migrator's daily work surface: writable triage states (confirmed / false positive / not an issue, #33), live filters, sort and pagination."),
    ("mig-modal", 4, "Migrator", "Triage detail",
     "Rule, tracker sync state (#37), archetype cohort and triage history \u2014 resolve, mark false positive, or assign to an agent group."),
    ("pm-home", 5, "Project mgr", "The project manager's landing",
     "Read-only and team-locked: the wave timeline and what is at risk lead the page (#36/#46). Mutation verbs are absent by RBAC."),
    ("pm-waves", 6, "Project mgr", "Migration waves \u2014 timeline & gates",
     "From the pm's seat: planned vs actual per wave and gate states (#46) \u2014 the numbers to bring to the program review."),
    ("pm-reports", 6, "Project mgr", "Reports \u2014 effort & progress",
     "Effort rollup by business service (#4) and wave execution rollups (#46), scoped to the pm's team."),
    ("pgm-home", 5, "Program mgr", "The program manager's landing",
     "Org-wide coordination first (#36/#41): teams in scope, waves that span more than one team, shared blockers."),
    ("pgm-waves", 6, "Program mgr", "Migration waves \u2014 cross-team composition",
     "The coordination card lists each wave's contributing teams and flags cross-team waves \u2014 the change-window conversations a program manager owns."),
    ("pgm-tasks", 6, "Program mgr", "Task manager \u2014 shared platform work",
     "Quota blocks and platform tasks (#30/#38) hit several teams at once; the queue is the escalation surface."),
]
MOTION, HOLD, TITLE, OUTRO = 320, 2800, 3000, 2800

persona_tot, persona_idx = {}, {}
for _, _, p, _, _ in TOUR:
    persona_tot[p] = persona_tot.get(p, 0) + 1

# pre-render captioned frames + assemble
frames = [("card_title.png", TITLE)]
for name, n, persona, lab, txt in TOUR:
    persona_idx[persona] = persona_idx.get(persona, 0) + 1
    badge = f"{persona} \u00b7 {persona_idx[persona]}/{persona_tot[persona]}"
    for i in range(n):
        src = Image.open(f'{work}/frames/{name}_{i:02d}.png').convert('RGB')
        caption(src, lab, txt, badge)
        src.save(f'{work}/frames/cap_{name}_{i:02d}.png')
    frames += [(f"cap_{name}_{i:02d}.png", MOTION) for i in range(n)]
    frames.append((f"cap_{name}_{n-1:02d}.png", HOLD + (600 if name == "mig-modal" else 0)))
frames.append(("card_outro.png", OUTRO))

gf, gd = [], []
for p, ms in frames:
    im = Image.open(f'{work}/frames/{p}').convert('RGB').resize((1280,720), Image.LANCZOS)
    gf.append(im); gd.append(ms)
gf[0].save(out+'/mta-mock-tour.gif', save_all=True, append_images=gf[1:],
           duration=gd, loop=0, optimize=True)
with open(work+'/concat.txt','w') as f:
    for p, ms in frames:
        f.write(f"file 'frames/{p}'\nduration {ms/1000}\n")
    f.write("file 'frames/card_outro.png'\n")
PYEOF

ffmpeg -y -f concat -safe 0 -i "$WORK/concat.txt" \
  -vf "fps=15,scale=1280:720:flags=lanczos" -c:v libvpx-vp9 -b:v 1500k -pix_fmt yuv420p \
  "$OUT/mta-mock-tour.webm" 2>/dev/null
echo "done:"; ls -la "$OUT"
