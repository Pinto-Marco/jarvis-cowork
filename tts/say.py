import sys, io, base64, subprocess, soundfile as sf
from kokoro_onnx import Kokoro
voice, speed, text = sys.argv[1], float(sys.argv[2]), sys.argv[3]
k = Kokoro("/home/claude/tts/kokoro.onnx", "/home/claude/tts/voices.bin")
s, sr = k.create(text, voice=voice, speed=speed, lang="it")
buf = io.BytesIO(); sf.write(buf, s, sr, format="WAV")
mp3 = subprocess.run(["ffmpeg", "-loglevel", "error", "-f", "wav", "-i", "pipe:0", "-ac", "1", "-c:a", "libmp3lame", "-b:a", "48k", "-f", "mp3", "pipe:1"], input=buf.getvalue(), capture_output=True, check=True).stdout
sys.stdout.write(base64.b64encode(mp3).decode())
