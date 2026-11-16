#!/usr/bin/env python3
"""CR7 'Siuuu' tribute for Yug Sunar — TTS + ffmpeg assembly → 1280x720 MP4.

Timeline: 4 scenes x 4s, 0.4s crossfades -> 14.8s total.
Scene starts: 0.0 / 3.6 / 7.2 / 10.8 (audio placed there).
Audio: TTS narration + low stadium rumble bed.
"""
import subprocess, os, sys

OUT = "/tmp/cr7demo"
FINAL = "/home/z/my-project/download/cr7-siuuu-for-yug-sunar.mp4"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
SCENE_D = 4.0
SCENE4_D = 8.2   # holds the 7.1s closing line with margin
XFADE = 0.4
TOTAL = 19.0
STARTS = [0.0, SCENE_D - XFADE, 2 * (SCENE_D - XFADE), 3 * (SCENE_D - XFADE)]  # 0/3.6/7.2/10.8

LINES = [
    "Yug Sunar... this night is yours.",
    "Number seven sees you in the stands. The run begins.",
    "The leap... hangs in the floodlights.",
    "Siuuuu! Yug Sunar! The legend salutes you!",
]
CAPS = ["FOR YUG SUNAR", "THE RUN", "THE LEAP", "SIUUUU!"]

def run(cmd, **kw):
    r = subprocess.run(cmd, capture_output=True, text=True, **kw)
    if r.returncode != 0:
        print("CMD FAILED:", " ".join(cmd)[:200])
        print(r.stderr[-4000:])
        sys.exit(1)
    return r

# ---- 1. TTS ----
wavs = []
for i, line in enumerate(LINES):
    w = f"{OUT}/voice_{i}.wav"
    if os.path.exists(w) and os.path.getsize(w) > 2000:
        print(f"voice_{i}: reusing existing {w}")
    else:
        # TTS shares the gateway rate limit — patient retries
        for a in range(6):
            r = subprocess.run(["z-ai", "tts", "-i", line, "-o", w, "--format", "wav"],
                               capture_output=True, text=True)
            if r.returncode == 0 and os.path.exists(w) and os.path.getsize(w) > 2000:
                break
            if a < 5:
                print(f"voice_{i} retry {a} (429) — waiting 20s")
                import time; time.sleep(20)
            else:
                print(r.stderr[-300:]); sys.exit(1)
    d = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                              "-of", "csv=p=0", w], capture_output=True, text=True).stdout)
    print(f"voice_{i}: {d:.1f}s  {line}")
    wavs.append((w, d))

# scene 4 must hold the closing line (it starts at STARTS[3]); keep a 0.8s tail
SCENE4_D = max(8.0, wavs[3][1] + 0.8)
TOTAL = STARTS[3] + SCENE4_D
print(f"scene4_d={SCENE4_D:.1f}s  total={TOTAL:.1f}s")

# ---- 2. per-scene Ken Burns + caption ----
vins = []
for i in range(4):
    frames = int((SCENE4_D if i == 3 else SCENE_D) * 25)
    zoom = ["min(zoom+0.0012,1.18)", "max(1.15-0.0012,1.0)", "min(zoom+0.0016,1.22)", "min(zoom+0.0009,1.15)"][i]
    x = ["iw/2-(iw/zoom/2)", f"(iw-iw/zoom)*on/{frames-1}", "iw/2-(iw/zoom/2)", "iw/2-(iw/zoom/2)"][i]
    y = ["ih/2-(ih/zoom/2)", "ih/2-(ih/zoom/2)", "ih/4", "ih/2-(ih/zoom/2)"][i]
    cap = CAPS[i].replace("'", "").replace("!", "")
    vf = (
        f"scale=1472:736,zoompan=z='{zoom}':x='{x}':y='{y}':d={frames}:s=1280x720:fps=25,"
        f"drawtext=fontfile={FONT}:text='{cap}':fontsize=54:fontcolor=white:borderw=3:"
        f"bordercolor=black@0.6:x=(w-text_w)/2:y=h-104"
    )
    vins.append(["-i", f"{OUT}/s{i+1}.png"])
    globals()[f"vf{i}"] = vf

# ---- 3. build filter graph ----
parts = []
for i in range(4):
    parts.append(f"[{i}:v]{globals()[f'vf{i}']}[v{i}]")
x1, x2 = STARTS[1], STARTS[2]
x3 = STARTS[3]
parts.append(f"[v0][v1]xfade=transition=fade:duration={XFADE}:offset={x1}[x1]")
parts.append(f"[x1][v2]xfade=transition=fade:duration={XFADE}:offset={x2}[x2]")
parts.append(f"[x2][v3]xfade=transition=fade:duration={XFADE}:offset={x3}[xv]")
parts.append(f"[xv]fade=t=in:d=0.5,fade=t=out:st={TOTAL-0.6}:d=0.6[vout]")
parts.append(f"[4:a]lowpass=f=500,volume=0.9,atrim=0:{TOTAL}[bed]")
for i, (w, d) in enumerate(wavs):
    parts.append(f"[{5+i}:a]aresample=48000,volume=1.9,adelay={int(STARTS[i]*1000)}|{int(STARTS[i]*1000)}[a{i}]")
parts.append("[bed][a0][a1][a2][a3]amix=inputs=5:duration=first:normalize=0[aout]")

cmd = ["ffmpeg", "-y", "-loglevel", "error"]
for i in range(4):
    # single still + zoompan d=N -> exactly N frames (classic Ken Burns)
    cmd += ["-i", f"{OUT}/s{i+1}.png"]
cmd += ["-f", "lavfi", "-t", str(TOTAL), "-i", "anoisesrc=colour=brown:amplitude=0.05:sample_rate=48000"]
for w, _ in wavs:
    cmd += ["-i", w]
cmd += ["-filter_complex", ";".join(parts), "-map", "[vout]", "-map", "[aout]",
        "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
        "-movflags", "+faststart", "-t", str(TOTAL), FINAL]
run(cmd)
print("FINAL:", FINAL, os.path.getsize(FINAL) // 1024, "KB")
d = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", FINAL],
                   capture_output=True, text=True).stdout.strip()
print("duration:", d, "s")
