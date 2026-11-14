# Delivery template

Use the user's language for the reply. Technical report language follows `--lang` (en/zh); see SKILL.md for unsupported-language translation. This English template specifies structure, not fabricated findings.

1. **One-line verdict:** production mix, major packaging, real assets, audio and beat alignment. Use measured percentages/confidence only when available.
2. **Content, cast and narrative:** what the video communicates, main characters/scenes/products, recurring identities and each shot's narrative role. Keep one reference image per character across generation units.
3. **Remake plan:** organize `production_plan` by real workflow rather than merely repeating shots. Group AI shots into generation units with model, shot range, references, multi-shot prompt and transitions. Preserve external reference tokens such as `@图片` / `@视频` when required by the provider. If the default engine cannot make multi-shot units, include `engine_note` and compare call counts. Group live action by scene/camera setup, lighting and wide-before-close shooting order. Group code rendering by composition and implementation method. Reconstruct moving stills locally.
4. **Shot table:** shot ID | time | production label/confidence | material source | overlays | key evidence | recreation route.
5. **Filming, lighting and editing** when applicable: format, shot size/angle, handheld/tripod, setups/scenes, key direction/height, light ratio/softness/temperature, fill/rim/practicals, jump/punch-in/cutaway edits and an equipment list. Explain conflicts between measurements and visual observations.
6. **Packaging:** caption count/position/colors/outlines/background/highlights/entrances and SRT/ASS paths; titles, callouts, chapter cards, tracking labels; stickers/GIFs/PIP timing/placement/looping; sound-effect alignment; dialogue-relative versus persistent layers. Identify manually observed additions.
7. **Audio:** voice/TTS/person and script source; music title hypothesis/style/BPM/key/source/licensing/sections; SFX timestamps and corresponding visual events; mixing/ducking. Mark uncertain source attribution.
8. **Real assets to supply:** shot, time, position, type, content and required original. Separate stock/film clips from user-owned footage and generation references.
9. **Open questions:** unresolved classifications, competing evidence, confidence and how to verify.
10. **Report:** provide `out/ref/report.html`. Code recreation needs the entire directory, including `shots/` element captures/keyframe strips and `packaging/`, not HTML/PDF alone. Do not paste the whole JSON.
11. **VLM:** reproduce the actual summary status. If unavailable and you cannot inspect images, suggest configuring `REA_VLM_BASE_URL`, `REA_VLM_API_KEY`, `REA_VLM_MODEL` and rerunning `--vlm`. If you inspected images, say agent visual review was performed; do not imply audio/video access you lacked.

Missing replication prompts can be supplied after inspection in `review_answers.json` using `replication.image_prompt`, `video_prompt`, `video_prompt_en`; rerun apply-review. Billable generation requires authorization before execution.
