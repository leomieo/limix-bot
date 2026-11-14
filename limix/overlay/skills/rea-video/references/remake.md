# Recreation

- AI shots: reference first/last frames plus reviewed prompts through capsule-cinema. Preview `--dry-run` and obtain authorization before paid calls.
- Moving/static stills: reconstruct locally using measured transforms.
- Code rendering: use Remotion/HTML and the report's code-composition instructions, per-shot element timing/position/easing/colors, `shots/` captures/strips and `packaging/overlays.ass`. Reuse cropped icon/logo/illustration assets when redrawing cannot reproduce them accurately.
- Live/user material: request originals and provide filming/lighting/equipment plans.
- Prepare separate voice, BGM (BPM/key/mood) and timed SFX tracks.
- Captions, titles and stickers are separate compositing layers, not generated pixels. If source first/last frames contain captions, honor `overlays_in_frames` warnings and remove text before generation. Reposition dialogue-relative effects against the new script rather than old seconds; composite persistent layers once.

## Assemble user footage or manually generated clips
1. Map material to report shot IDs/durations. Split long material or multi-shot generation units at their action/prompt time boundaries using FFmpeg. If uncertain, show contact sheets for confirmation.
2. Write `results.json`: `{"results":{"<shot-id>":{"video":"<absolute-path>"}}}`.
3. Run `rea-video assemble out/ref/breakdown.json <results.json>`. Whole clips are retimed into original windows, up to 3x speed or 1.25x slow-down before cropping. Missing shots retain original placeholders; audio initially remains original. Outputs include `remake.mp4` and side-by-side `compare.mp4`. Disclose placeholders and audio still requiring replacement.
4. `--overlays` composites measured captions/titles onto replaced shots only. Generic sans-serif fonts may differ from originals. Stickers are listed in `assemble_log.json` -> `stickers_to_add` and require manual assets/compositing.

Automatic remake-plan/capsule generation currently calls once per shot. Multi-shot generation-unit prompts must be used manually in a compatible model; report both call counts rather than promising automatic grouped generation.

## capsule-cinema
Use its own environment: `$CAPSULE_CINEMA_PYTHON`, `<capsule-root>/.venv/bin/python`, or `--python`.
```bash
CC=$CAPSULE_CINEMA_ROOT
rea-video remake-plan out/ref/breakdown.json --capsule-root "$CC" --engine seedance2.0
rea-video remake-run out/ref/remake/jobs.json --dry-run
# Execute only after authorization:
rea-video remake-run out/ref/remake/jobs.json
rea-video assemble out/ref/breakdown.json out/ref/remake/results.json
rea-video capsule-draft out/ref/breakdown.json --capsule-root "$CC" --capsule-name example
```
Optional plan filters include `--mode image_to_video` and `--labels ai_video`; `capsule-draft --write-capsule` writes a draft. `executor` is `capsule_cinema`, `local_ffmpeg`, or `keep_original`. `user_assets` identifies required originals; generated substitutions are approximations. Drafts use capsule-cinema's `tool_factory` without modifying its code and default to `review_required`.
