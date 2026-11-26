#!/bin/bash
# Regenerates mta-mock-tour.gif / mta-mock-tour.webm from ui-mockup/index.html.
# Every scene carries a caption overlay naming the screen and what to notice.
# Usage: make-demo.sh [en|nl|es]  — nl/es render the tour with &lang=nl / &lang=es deep
# links, translated captions/bubbles/cards and -nl / -es output filenames (rows 211/248).
# Requirements: google-chrome (headless), python3 + Pillow, ffmpeg, Red Hat fonts
# (/usr/share/fonts/redhat). Run from any directory; writes frames to /tmp.
set -euo pipefail
LANG_ARG="${1:-en}"
case "$LANG_ARG" in
  en) SUF="";;
  nl) SUF="-nl";;
  es) SUF="-es";;
  *) echo "unsupported locale '$LANG_ARG' (en|nl|es)"; exit 1;;
esac
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
# nl/es: every scene boots the mock in that language via the &lang= deep link (deep link
# wins over persisted state — same precedence the mock gives lang everywhere)
LANGQ=""; case "$LANG_ARG" in nl|es) LANGQ="&lang=$LANG_ARG";; esac
# nl/es bubble texts (scene-name → text); EN bubbles stay in the scenes array
declare -A BUB_OVR=()
if [ "$LANG_ARG" = nl ]; then
  BUB_OVR[arch-inventory]="Opent de applicatie-inventaris — de centrale administratie."
  BUB_OVR[arch-waves]="Opent Migratiegolven — samenstelling, gates en de tijdlijn gepland vs. werkelijk."
  BUB_OVR[mig-home]="Schakelt naar de migrator — het bereik pin op het team Claims."
  BUB_OVR[mig-incidents]="Opent de triage-wachtrij — het dagelijkse werkoppervlak van de migrator."
  BUB_OVR[pm-home]="Schakelt naar de projectmanager — alleen-lezen en team-gebonden."
  BUB_OVR[pm-waves]="Opent Migratiegolven — de cijfers voor de programmareview."
  BUB_OVR[pm-reports]="Opent Rapporten — inspannings- en voortgangsrollups, toegespitst op het team."
  BUB_OVR[pgm-home]="Schakelt naar de programmamanager — org-breed bereik."
  BUB_OVR[pgm-waves]="Opent de cross-team samenstellingskaart — golven die meer dan één team beslaan."
  BUB_OVR[pgm-tasks]="Opent de taakbeheerder — het escalatie-oppervlak voor gedeeld platformwerk."
fi
if [ "$LANG_ARG" = es ]; then
  BUB_OVR[arch-inventory]="Abre el inventario de aplicaciones — el registro único de datos."
  BUB_OVR[arch-waves]="Abre Olas de migración — composición, gates y la línea de tiempo planificado vs. real."
  BUB_OVR[mig-home]="Cambia al migrador — el alcance se fija al equipo Claims."
  BUB_OVR[mig-incidents]="Abre la cola de triage — la superficie de trabajo diaria del migrador."
  BUB_OVR[pm-home]="Cambia al director de proyectos — solo lectura y fijado al equipo."
  BUB_OVR[pm-waves]="Abre Olas de migración — las cifras para la revisión de programa."
  BUB_OVR[pm-reports]="Abre Informes — rollups de esfuerzo y progreso, acotados al equipo."
  BUB_OVR[pgm-home]="Cambia al director de programa — alcance de toda la organización."
  BUB_OVR[pgm-waves]="Abre la tarjeta de composición entre equipos — olas que abarcan más de un equipo."
  BUB_OVR[pgm-tasks]="Abre el gestor de tareas — la superficie de escalado para el trabajo de plataforma compartido."
fi
for s in "${scenes[@]}"; do
  name="${s%%|*}"; rest="${s#*|}"; hash="${rest%%|*}"; rest="${rest#*|}"; click="${rest%%|*}"; rest="${rest#*|}"; bubble="${rest%%|*}"; steps="${rest#*|}"
  hash="${hash}${LANGQ}"
  bubble="${BUB_OVR[$name]:-$bubble}"
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
python3 - "$OUT" "$LANG_ARG" "$SUF" <<'PYEOF'
import sys
from PIL import Image, ImageDraw, ImageFont
out, lang, suf = sys.argv[1], sys.argv[2], sys.argv[3]
work = '/tmp/opencode/demo-run'
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

if lang == 'nl':
    card([("Migration Toolkit for Applications",f1,WHITE),
          ("UI-mockup — begeleide tour per rol",f2,GRAY),
          ("Northwind Financial · architect \u203a migrator \u203a projectmanager \u203a programmamanager",f3,GRAY),
          ("echte PatternFly 6.7.0 · 11 talen · licht/donker · tenancy-scoped",f3,GRAY)]
         ).save(work+'/frames/card_title.png')
    card([("Probeer het zelf",f1,WHITE),
          ("ui-mockup/index.html — deep-linkable: #scr=…&persona=…&lang=…&scheme=…",f3,GRAY),
          ("elk frame hierboven is een echte render van de mock",f3,GRAY)]).save(work+'/frames/card_outro.png')
elif lang == 'es':
    card([("Migration Toolkit for Applications",f1,WHITE),
          ("Mockup de UI — tour guiado por rol",f2,GRAY),
          ("Northwind Financial · arquitecto \u203a migrador \u203a director de proyectos \u203a director de programa",f3,GRAY),
          ("PatternFly 6.7.0 real · 11 idiomas · claro/oscuro · acotado por tenencia",f3,GRAY)]
         ).save(work+'/frames/card_title.png')
    card([("Pruébalo tú mismo",f1,WHITE),
          ("ui-mockup/index.html — enlazable: #scr=…&persona=…&lang=…&scheme=…",f3,GRAY),
          ("cada fotograma de arriba es un render real del mock",f3,GRAY)]).save(work+'/frames/card_outro.png')
else:
    card([("Migration Toolkit for Applications",f1,WHITE),
          ("UI mockup — role-based guided tour",f2,GRAY),
          ("Northwind Financial · architect \u203a migrator \u203a project mgr \u203a program mgr",f3,GRAY),
          ("real PatternFly 6.7.0 · 11 locales · light/dark · tenancy-scoped",f3,GRAY)]
         ).save(work+'/frames/card_title.png')
    card([("Try it yourself",f1,WHITE),
          ("ui-mockup/index.html — deep-linkable: #scr=…&persona=…&lang=…&scheme=…",f3,GRAY),
          ("every frame above is a real render of the mock",f3,GRAY)]).save(work+'/frames/card_outro.png')

# tour scenes: (frame-name, n-steps, persona badge, caption label, explanation)
# one persona section at a time — Northwind org, following each persona's own
# in-mock guided tour (TOURS in index.html)
TOUR_EN = [
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

# nl tour (row 211): persona badges use the mock's own nl terms (Projectmanager,
# Programmamanager); suggestion refs (#4/#32/…) stay as-is — annotations are
# locale-neutral; loanwords (gate, run, tracker, cross-team) follow the nl dict
TOUR_NL = [
    ("arch-home", 5, "Architect", "Portfoliogezondheid in een oogopslag",
     "De org-brede landing van de architect: inspanningsrollup (#4), gecombineerd risico (#32) en analysedekking \u2014 \u201cWaar knelt de portefeuille?\u201d beantwoord v\u00f3\u00f3r de eerste klik."),
    ("arch-inventory", 6, "Architect", "Applicaties \u2014 de inventaris",
     "De ene bron van waarheid: filter op risico of analysestatus (#2), sorteer op inspanning (#4), golftoewijzing en risicoherkomst (#32) op elke rij."),
    ("arch-waves", 7, "Architect", "Migratiegolven \u2014 planning & gates",
     "Golfsamenstelling met gates en tijdlijn (#46): gepland vs. werkelijk, de quotageblokkeerde gate (#38) en per golf het agentverbruik (#20)."),
    ("mig-home", 5, "Migrator", "Een teamgebonden landing",
     "Geschakeld naar de migrator \u2014 bereik vastgepind op het team Claims (#41): opdrachten en mijn werk eerst, geen portefeuilleruis, geen Administration-items."),
    ("mig-incidents", 6, "Migrator", "Incidenten \u2014 de triagewachtrij",
     "Het dagelijkse werkoppervlak van de migrator: beschrijfbare triagestatussen (bevestigd / vals positief / geen probleem, #33), live filters, sorteren en paginering."),
    ("mig-modal", 4, "Migrator", "Triagedetail",
     "Regel, trackersynchronisatie (#37), archetypecohort en triagehistorie \u2014 oplossen, als vals positief markeren of toewijzen aan een agentgroep."),
    ("pm-home", 5, "Projectmanager", "De landing van de projectmanager",
     "Alleen-lezen en teamgebonden: de golftijdlijn en wat er op risico staat leiden de pagina (#36/#46). Mutatiehandelingen ontbreken door RBAC."),
    ("pm-waves", 6, "Projectmanager", "Migratiegolven \u2014 tijdlijn & gates",
     "Vanuit de stoel van de pm: gepland vs. werkelijk per golf en gatestatussen (#46) \u2014 de cijfers voor de programmareview."),
    ("pm-reports", 6, "Projectmanager", "Rapporten \u2014 inspanning & voortgang",
     "Inspanningsrollup per business service (#4) en golfexecutierollups (#46), toegespitst op het team van de pm."),
    ("pgm-home", 5, "Programmamanager", "De landing van de programmamanager",
     "Orgbrede co\u00f6rdinatie eerst (#36/#41): teams in scope, golven die meer dan \u00e9\u00e9n team beslaan, gedeelde blokkades."),
    ("pgm-waves", 6, "Programmamanager", "Migratiegolven \u2014 cross-teamsamenstelling",
     "De co\u00f6rdinatiekaart toont per golf de bijdragende teams en markeert cross-teamgolven \u2014 de change-window-gesprekken die een programmamanager voert."),
    ("pgm-tasks", 6, "Programmamanager", "Taakbeheerder \u2014 gedeeld platformwerk",
     "Quotablokkades en platformtaken (#30/#38) raken meerdere teams tegelijk; de wachtrij is het escalatieoppervlak."),
]

# es tour (row 248): persona badges use the mock's own es terms (Migrador, Director de
# proyectos, Director de programa); suggestion refs (#4/#32/…) stay as-is — annotations
# are locale-neutral; loanwords (gate, run, tracker, rollup) follow the es dict
TOUR_ES = [
    ("arch-home", 5, "Arquitecto", "Salud del portafolio de un vistazo",
     "La página de inicio de toda la organización del arquitecto: rollup de esfuerzo (#4), riesgo combinado (#32) y cobertura de análisis \u2014 \u00ab\u00bfDónde duele el portafolio?\u00bb respondido antes de cualquier clic."),
    ("arch-inventory", 6, "Arquitecto", "Aplicaciones \u2014 el inventario",
     "La única fuente de verdad: filtra por riesgo o estado de análisis (#2), ordena por esfuerzo (#4), asignación a olas y procedencia del riesgo (#32) en cada fila."),
    ("arch-waves", 7, "Arquitecto", "Olas de migración \u2014 planificación y gates",
     "Composición de olas con gates y línea de tiempo (#46): planificado vs. real, el gate bloqueado por cuota (#38) y el gasto de agentes por ola (#20)."),
    ("mig-home", 5, "Migrador", "Una página de inicio fijada al equipo",
     "Cambiado al migrador \u2014 alcance fijado al equipo Claims (#41): asignaciones y mi trabajo primero, sin ruido del portafolio, sin entradas de Administración."),
    ("mig-incidents", 6, "Migrador", "Incidencias \u2014 la cola de triage",
     "La superficie de trabajo diaria del migrador: estados de triage escribibles (confirmado / falso positivo / no es un problema, #33), filtros en vivo, orden y paginación."),
    ("mig-modal", 4, "Migrador", "Detalle de triage",
     "Regla, estado de sincronización con el tracker (#37), cohorte de arquetipo e historial de triage \u2014 resolver, marcar falso positivo o asignar a un grupo de agentes."),
    ("pm-home", 5, "Director de proyectos", "La página del director de proyectos",
     "Solo lectura y fijado al equipo: la línea de tiempo de olas y lo que está en riesgo encabezan la página (#36/#46). Los verbos de mutación están ausentes por RBAC."),
    ("pm-waves", 6, "Director de proyectos", "Olas de migración \u2014 línea de tiempo y gates",
     "Desde el puesto del director de proyectos: planificado vs. real por ola y estados de gate (#46) \u2014 las cifras para la revisión de programa."),
    ("pm-reports", 6, "Director de proyectos", "Informes \u2014 esfuerzo y progreso",
     "Rollup de esfuerzo por servicio de negocio (#4) y rollups de ejecución de olas (#46), acotados al equipo del director de proyectos."),
    ("pgm-home", 5, "Director de programa", "La página del director de programa",
     "Coordinación de toda la organización primero (#36/#41): equipos en el ámbito, olas que abarcan más de un equipo, bloqueos compartidos."),
    ("pgm-waves", 6, "Director de programa", "Olas de migración \u2014 composición entre equipos",
     "La tarjeta de coordinación lista los equipos que contribuyen a cada ola y marca las olas entre equipos \u2014 las conversaciones de ventana de cambios que dirige un director de programa."),
    ("pgm-tasks", 6, "Director de programa", "Gestor de tareas \u2014 trabajo de plataforma compartido",
     "Los bloqueos de cuota y las tareas de plataforma (#30/#38) afectan a varios equipos a la vez; la cola es la superficie de escalado."),
]
TOUR = TOUR_NL if lang == 'nl' else (TOUR_ES if lang == 'es' else TOUR_EN)
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
gf[0].save(out+'/mta-mock-tour%s.gif' % suf, save_all=True, append_images=gf[1:],
           duration=gd, loop=0, optimize=True)
with open(work+'/concat.txt','w') as f:
    for p, ms in frames:
        f.write(f"file 'frames/{p}'\nduration {ms/1000}\n")
    f.write("file 'frames/card_outro.png'\n")
PYEOF

ffmpeg -y -f concat -safe 0 -i "$WORK/concat.txt" \
  -vf "fps=15,scale=1280:720:flags=lanczos" -c:v libvpx-vp9 -b:v 1500k -pix_fmt yuv420p \
  "$OUT/mta-mock-tour${SUF}.webm" 2>/dev/null
echo "done:"; ls -la "$OUT"
