#!/usr/bin/env python3
"""Assemble the live-console demo: caption overlays + title/outro cards over the
frames captured by capture.mjs, then GIF + VP9 WebM output. Same pacing rules as
the mock's make-demo.sh (motion steps 320 ms, screen holds 2.8 s, title 3 s)."""
import json, sys
from PIL import Image, ImageDraw, ImageFont

out = sys.argv[1]                # demos dir (output)
work = sys.argv[2]               # frame dir
frames_dir = work + "/frames"

W, H = 1920, 1080
f1 = ImageFont.truetype("/usr/share/fonts/redhat/RedHatDisplay-Bold.otf", 88)
f2 = ImageFont.truetype("/usr/share/fonts/redhat/RedHatDisplay-Regular.otf", 44)
f3 = ImageFont.truetype("/usr/share/fonts/redhat/RedHatText-Regular.otf", 30)
f4 = ImageFont.truetype("/usr/share/fonts/redhat/RedHatText-Bold.otf", 34)
BLUE, GRAY, WHITE = (0, 102, 204), (170, 170, 170), (255, 255, 255)

def caption(im, label, text, badge=None):
    d = ImageDraw.Draw(im, "RGBA")
    bh = 152
    d.rectangle([0, H - bh, W, H], fill=(21, 21, 21, 232))
    d.rectangle([0, H - bh, 10, H], fill=BLUE + (255,))
    x = 40
    if badge:
        bw = d.textlength(badge, font=f4) + 28
        d.rounded_rectangle([x, H - bh + 22, x + bw, H - bh + 66], 8, fill=(45, 46, 110, 255))
        d.text((x + 14, H - bh + 27), badge, font=f4, fill=WHITE)
        x += bw + 24
    d.text((x, H - bh + 26), label, font=f4, fill=(140, 175, 255))
    maxw = W - 80
    words, line, lines_out = text.split(), "", []
    for wd in words:
        t = (line + " " + wd).strip()
        if d.textlength(t, font=f3) <= maxw:
            line = t
        else:
            lines_out.append(line); line = wd
    lines_out.append(line)
    ytxt = H - bh + 76
    for ln in lines_out[:2]:
        d.text((40, ytxt), ln, font=f3, fill=WHITE)
        ytxt += 42
    return im

def card(lines):
    im = Image.new("RGB", (W, H), (21, 21, 21)); d = ImageDraw.Draw(im)
    d.rectangle([0, 0, 16, H], fill=BLUE)
    y = (H - sum(f.size for _, f, _ in lines) - (len(lines) - 1) * 40) // 2 - 30
    for txt, f, c in lines:
        d.text(((W - d.textlength(txt, font=f)) / 2, y), txt, font=f, fill=c); y += f.size + 40
    return im

card([("Migration Toolkit for Applications", f1, WHITE),
      ("Live console — role-based guided tour", f2, GRAY),
      ("Keycloak sign-in · Quarkus hub API · real data per org and team", f3, GRAY),
      ("Northwind Financial · architect → migrator → project mgr → program mgr", f3, GRAY)]
     ).save(frames_dir + "/card_title.png")
card([("Try it yourself", f1, WHITE),
      ("podman compose up -d  →  http://localhost:5173 — sign in as m.keller@northwind-financial.com / demo", f3, GRAY),
      ("deep-linkable: #scr=…&lang=…&scheme=… — every frame above is a live render", f3, GRAY)]
     ).save(frames_dir + "/card_outro.png")

# captions — the mock demo's tour, adapted to the live app (no suggestion refs;
# data comes from the hub backend, not the sample stores)
TOUR = {
    "arch-home": ("Architect", "Portfolio health at a glance",
        "The architect's org-wide landing: effort rollup, combined risk and analysis coverage — \u201cWhere is the portfolio hurting?\u201d answered before any click."),
    "arch-inventory": ("Architect", "Applications — the inventory",
        "The single store of record, live from the hub: filter by risk or analysis state, sort by effort, wave assignment and risk provenance on every row."),
    "arch-waves": ("Architect", "Migration waves — planning & gates",
        "Wave composition with gates and timeline: planned vs actual, the quota-blocked gate and per-wave agent-spend showback."),
    "mig-home": ("Migrator", "A team-locked landing",
        "Signed in as the migrator — scope pinned to the Claims team: assignments and my work first, no portfolio noise, no Administration entries."),
    "mig-incidents": ("Migrator", "Incidents — the triage queue",
        "The migrator's daily work surface: writable triage states (confirmed / false positive / not an issue), live filters, sort and pagination."),
    "mig-modal": ("Migrator", "Triage detail",
        "Rule, tracker sync state, archetype cohort and triage history — resolve or mark false positive; every write goes to the hub API."),
    "pm-home": ("Project mgr", "The project manager's landing",
        "Read-only and team-locked: the wave timeline and what is at risk lead the page. Mutation verbs are absent by RBAC."),
    "pm-waves": ("Project mgr", "Migration waves — timeline & gates",
        "From the pm's seat: planned vs actual per wave and gate states — the numbers to bring to the program review."),
    "pm-reports": ("Project mgr", "Reports — effort & progress",
        "Effort rollup by business service and wave execution rollups, scoped to the pm's team."),
    "pgm-home": ("Program mgr", "The program manager's landing",
        "Org-wide coordination first: teams in scope, waves that span more than one team, shared blockers."),
    "pgm-waves": ("Program mgr", "Migration waves — cross-team composition",
        "The coordination card lists each wave's contributing teams and flags cross-team waves — the change-window conversations a program manager owns."),
    "pgm-tasks": ("Program mgr", "Task manager — shared platform work",
        "Quota blocks and platform tasks hit several teams at once; the queue is the escalation surface."),
}

MOTION, HOLD, TITLE, OUTRO = 320, 2800, 3000, 2800

manifest = json.load(open(frames_dir + "/manifest.json"))
persona_tot, persona_idx = {}, {}
for sc in manifest:
    p = TOUR[sc["name"]][0]
    persona_tot[p] = persona_tot.get(p, 0) + 1

frames = [("card_title.png", TITLE)]
for sc in manifest:
    name, n = sc["name"], sc["frames"]
    persona, lab, txt = TOUR[name]
    persona_idx[persona] = persona_idx.get(persona, 0) + 1
    badge = f"{persona} · {persona_idx[persona]}/{persona_tot[persona]}"
    for i in range(n):
        src = Image.open(f"{frames_dir}/{name}_{i:02d}.png").convert("RGB")
        caption(src, lab, txt, badge)
        src.save(f"{frames_dir}/cap_{name}_{i:02d}.png")
    frames += [(f"cap_{name}_{i:02d}.png", MOTION) for i in range(n)]
    frames.append((f"cap_{name}_{n-1:02d}.png", HOLD + (600 if name == "mig-modal" else 0)))
frames.append(("card_outro.png", OUTRO))

gf, gd = [], []
for p, ms in frames:
    im = Image.open(f"{frames_dir}/{p}").convert("RGB").resize((1280, 720), Image.LANCZOS)
    gf.append(im); gd.append(ms)
gf[0].save(out + "/mta-live-tour.gif", save_all=True, append_images=gf[1:], duration=gd, loop=0, optimize=True)

with open(work + "/concat.txt", "w") as f:
    for p, ms in frames:
        f.write(f"file 'frames/{p}'\nduration {ms/1000}\n")
    f.write("file 'frames/card_outro.png'\n")
print("assembled:", len(frames), "frames")
