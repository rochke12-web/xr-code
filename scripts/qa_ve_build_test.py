#!/usr/bin/env python3
"""Build the E2E test video for the brain-driven video editor.

A ~30s 1280x720 clip with real TTS speech and PLANTED mistakes the brain must find:
  1. opener filler   "Okay, recording."            -> should be cut
  2. a false start   "The second step is the, um," -> should be cut
  3. redo cue        "wait, let me say that again" -> cue + old take cut
  4. long silences (2.0-2.5s) between lines        -> tightened to ~0.3s
"""
import subprocess, wave, os, sys

D = "/tmp/vetest"
os.makedirs(D, exist_ok=True)
SR = 48000

LINES = [
    ("l1", "Okay, recording. So today I want to show you the three steps of our pipeline."),
    ("l2", "The first step is the gateway."),
    ("l3a", "The second step is the, um..."),
    ("l3b", "Wait, let me say that again. The second step is the vision preprocessor."),
    ("l4", "And the third step is the brain that answers everything."),
    ("l5", "So that is the whole pipeline. Thanks for watching."),
]
# timeline: (clip or 'SIL', seconds)
TIMELINE = [
    ("SIL", 1.2), ("l1", 0), ("SIL", 2.5), ("l2", 0), ("SIL", 2.0),
    ("l3a", 0), ("SIL", 1.0), ("l3b", 0), ("SIL", 2.5), ("l4", 0),
    ("SIL", 2.2), ("l5", 0), ("SIL", 0.8),
]

def sh(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        print("CMD FAILED:", " ".join(map(str, cmd))[:200], "\n", r.stderr[-800:])
        sys.exit(1)
    return r

def tts(name, text):
    out = f"{D}/{name}.wav"
    if not os.path.exists(out) or os.path.getsize(out) < 4000:
        sh(["z-ai", "tts", "-i", text, "-o", out, "--format", "wav"])
    # normalize everything to 48k stereo s16 for assembly
    std = f"{D}/{name}_48.wav"
    sh(["ffmpeg", "-y", "-loglevel", "error", "-i", out, "-ar", str(SR), "-ac", "2",
        "-c:a", "pcm_s16le", std])
    return std

def read_wav(p):
    with wave.open(p, "rb") as w:
        assert w.getframerate() == SR and w.getnchannels() == 2 and w.getsampwidth() == 2
        return w.readframes(w.getnframes())

clips = {n: tts(n, t) for n, t in LINES}
def silence(sec):
    return b"\x00" * int(SR * sec) * 4  # stereo s16

pcm, t = b"", 0.0
marks = []
for item, sec in TIMELINE:
    if item == "SIL":
        pcm += silence(sec); t += sec
    else:
        data = read_wav(clips[item])
        marks.append((item, round(t, 2), round(t + len(data) / 4 / SR, 2)))
        pcm += data; t += len(data) / 4 / SR

with wave.open(f"{D}/timeline.wav", "wb") as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(pcm)
dur = len(pcm) / 4 / SR
print("audio timeline %.1fs" % dur)
for m in marks: print("  %s  %.2f-%.2f" % m)

# background: dark moving gradient + drifting circle so cuts are visible
sh(["ffmpeg", "-y", "-loglevel", "error", "-f", "lavfi", "-i",
    f"color=c=0x14141e:s=1280x720:d={dur+1:.2f}:r=30",
    "-i", f"{D}/timeline.wav",
    "-filter_complex",
    "[0:v]drawbox=x=mod(t*180\\,1600)-200:y=100:w=180:h=180:c=0x2b6cb0@0.9:t=fill,"
    "drawbox=x=800:y=mod(t*120\\,900)-150:w=120:h=120:c=0x9f7aea@0.85:t=fill,"
    "drawtext=text='XR PIPELINE TEST':fontcolor=white:fontsize=44:x=(w-text_w)/2:y=560:font=/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf[v]",
    "-map", "[v]", "-map", "1:a", "-c:v", "libx264", "-preset", "veryfast", "-crf", "20",
    "-c:a", "aac", "-b:a", "192k", "-pix_fmt", "yuv420p", "-shortest",
    f"{D}/talkinghead.mp4"])

# report
p = subprocess.run(["ffprobe", "-v", "error", "-print_format", "json", "-show_format",
                    f"{D}/talkinghead.mp4"], capture_output=True, text=True)
import json
info = json.loads(p.stdout)
print("talkinghead.mp4:", round(float(info["format"]["duration"]), 2), "s,",
      int(info["format"]["size"]) // 1024, "KB")
print("OK" if os.path.getsize(f"{D}/talkinghead.mp4") > 100000 else "TOO SMALL")
