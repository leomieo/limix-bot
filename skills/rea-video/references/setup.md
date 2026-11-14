# Installation and VLM configuration

Use Limix Bot's bundled Python 3.12 and uv where available; prefer the commit-pinned installation in SKILL.md. FFmpeg and Python >=3.10 are required. Check `rea-video --help` before installing.

Upstream installation alternatives:
```bash
pip install "rea-video[ocr] @ git+https://github.com/JuneYaooo/rea-video"
pipx install "rea-video[ocr] @ git+https://github.com/JuneYaooo/rea-video"
pipx install --python python3.12 "rea-video[ocr] @ git+https://github.com/JuneYaooo/rea-video"
PYTHON_BIN=python3.12 bash scripts/install_skill.sh
```

For `externally-managed-environment`, use pipx or an isolated venv, never `--break-system-packages`. Missing onnxruntime wheels may mean the interpreter is too new: the pinned upstream supports Python 3.10-3.14, preferring that range in its installer. OCR uses rapidocr-onnxruntime on <=3.12 and rapidocr 3 on >=3.13. On <=3.12, conflicting OpenCV distributions may need the upstream repair in that isolated environment:
```bash
pip uninstall -y opencv-python
pip install --force-reinstall --no-deps "opencv-python-headless>=4.8,<5"
```

## Optional local ASR
`pip install "rea-video[ocr,asr] @ git+https://github.com/JuneYaooo/rea-video"`, or install `sherpa-onnx` in the existing environment. SenseVoice transcribes isolated vocals in Chinese, English, Japanese, Korean and Cantonese. First use downloads about 160 MB into `$REA_VIDEO_MODELS` (default `~/.cache/rea-video/models`). Results populate `speech.lines`, report scripts and review-task `said`; `--no-asr` skips it. Without installation, `speech.reason=not_installed` and other analysis continues.
Machine transcripts can mishear names/homophones. Prefer visible subtitles or verified VLM dialogue. Mark unreviewed transcripts accordingly. Per-line `timing: estimated` is estimated by character counts; segment endpoints are measured.

## Optional VLM
A multimodal model can inspect shot clips/keyframes and, where supported, audio. Without one, deterministic statistics/OCR/metadata still produce reports, but live-action/AI/3D distinctions weaken and SFX remain low-confidence candidates.
Configuration precedence:
1. `REA_VLM_BASE_URL`, `REA_VLM_API_KEY`, `REA_VLM_MODEL`; comma-separated models fail over in order.
2. capsule-cinema `VIDEO_ANALYSIS_*` or `GEMINI3_*` fallback.
Load settings with `--env-file <file>`. Never print keys, read secret file contents into chat, or commit credentials.

If no VLM is configured, continue without `--vlm`. If you can inspect images, run review -> inspect -> apply-review yourself, independently of any VLM. Static frames do not replace video motion or audio inspection. If you cannot inspect images either, follow review.md and briefly suggest configuring a multimodal model.

The summary's `VLM:` line and `analysis.vlm.status` are authoritative: `ok` effective, `partial` some results, `failed` all requested calls failed, `not_configured` missing setup, `off` not requested. Partial coverage may show a/n shots; default budget is 60 calls. Use `--max-vlm-shots N` only when appropriate, or visually review unsent shots. Upstream evaluation suggests independent agent review can correct VLM confusion between cartoon AI/3D and game footage/screen capture; this is upstream evidence, not a local accuracy benchmark.
