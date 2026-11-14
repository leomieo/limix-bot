---
name: rea-video
description: "Reverse engineer how a reference video was produced, shot by shot: live footage, film clips, AI video, avatars, 3D, 2D animation, stop motion, code rendering, screen capture, moving stills and static holds. Identify AI edits, timed captions and graphics, real source assets, voice/music/effects, lighting and editing; produce an evidence-based, executable remake plan. Use for video analysis, AI provenance questions, source-material identification and recreation requests."
---

> **Limix Bot.** Python 3.12 and `uv` are bundled with Limix Bot and on PATH. If the command is missing, ask the
> person once, then install it with:
>
> ```
> uv tool install "rea-video[ocr] @ https://github.com/JuneYaooo/rea-video/archive/3669923645e3953632e7406a57fb883e0ba8a6e0.zip"
> ```
>
> Tools installed this way land in Limix Bot's own folder (no administrator rights needed) and are on PATH from the
> next command. `<root>` is the folder named by this skill's `root`.
> Source: https://github.com/JuneYaooo/rea-video/tree/3669923645e3953632e7406a57fb883e0ba8a6e0/skills/rea-video (Apache-2.0).


# Reverse engineer video production

Answer six questions with evidence: where each shot came from; which packaging layers were added; which real assets the user must supply; how voice, music and sound effects were made; how live-action camera/lighting/grading/editing worked; and how to recreate the result. Use the eleven enum labels in `references/taxonomy.md`. For live-action AI modifications, fill `ai_edits`. Distinguish embedded real pixels from reference images for AI/3D characters, logos and products.

Never turn uncertainty into a definite answer. State the competing explanations, evidence, confidence and missing evidence. Style alone does not establish AI origin. Offer an actual shooting plan for live-action scenes rather than only an AI approximation.

## Environment and workflow
Run `rea-video --help`. If missing, follow `references/setup.md`; FFmpeg and Python >=3.10 are required. VLM is recommended, not mandatory. If you can see images, perform visual review yourself. If neither you nor a working VLM can see images, follow `references/review.md` and explicitly disclose that limitation.

```bash
rea-video memory
rea-video --env-file <env-file> decompose ref.mp4 -o out/ref --vlm --lang en
rea-video summary out/ref/breakdown.json
rea-video review out/ref
rea-video apply-review out/ref --by <reviewer>
rea-video summary out/ref/breakdown.json
```

Without VLM configuration omit `--env-file` and `--vlm`; continue the task. Use `--ocr-lang ja` for Japanese on-screen text. Judge actual VLM availability from the summary's `VLM:` line: `failed` and `not_configured` mean no working VLM. Do not call requested-but-failed VLM analysis successful.

Use `summary` to avoid reading the entire large `breakdown.json` or report appendices. Locate report sections with `rg -n '^##' out/ref/report.md`, then read the relevant section. `shots/shot_XXX.jpg` is a first/middle/last contact sheet; `_first` and `_last` are generation references.

## Independent visual and audio review
1. Inspect `storyboard.jpg` and `audio.png` for an overall understanding.
2. Read `review_tasks.json` instructions. Inspect each listed image, especially `priority=high`, conflicting/low-confidence shots and near-tied alternatives. Fill `label_probs`, `evidence`, `description`, `narrative` and `embedded_assets` in `review_answers.json`. Leave unseen shots' `label_probs` as `{}` so they are skipped. Do not copy the VLM's claims without checking.
3. `narrative.role` describes the shot's function (hook, context, information, evidence, turn, conclusion, call to action or emotion); `point` describes its message. A mistakenly merged shot can receive `split_suggestion` with cut seconds, labels and a note; this annotates a proposal rather than changing boundaries.
4. Fill top-level `cast` with consistent characters, scenes, props and visual style. Correct duplicate identities. Use one fixed reference image per character across generation units.
5. For close inspection use `rea-video tiles ref.mp4 --start 12.3 --end 13.1 --every 0.1 -o out/ref/check.jpg`. Compare every relevant confusion pair in `references/taxonomy.md`.
6. Listen to `stems/vocals.wav` and `stems/music.wav` if audio playback is available. Follow `references/audio.md`. Signal-only SFX are low-confidence candidates; if you cannot listen or use an audio-capable VLM, disclose that quiet effects and source attribution remain unverified.
7. For live action, verify framing, camera position/movement, handheld/tripod, speed, shooting setups, key/fill/rim direction, softness, ratio, color temperature, practical lights and outdoor location. Explain grading and jump/punch-in/cutaway edits; provide a shooting/equipment plan.
8. Review user assets with `references/materials.md`. Inspect packaging/caption timing, typography, colors, outlines, highlights, entrance animations, titles, stickers/GIFs/PIP and sound cues. Distinguish dialogue-relative layers from persistent layers. Timing-derived placement must be corrected if visual evidence disagrees.
9. After any changes to cast, replication prompts, assets or packaging, rerun `apply-review`; otherwise the report does not include them. Review answers fuse with deterministic evidence rather than simply replacing it. Explain remaining disagreements.

Record only explicit user corrections and durable preferences using `references/memory.md`. Suggest adding valuable labeled examples to the evaluation set; do not claim that doing so retrains a model.

## Delivery and language
Follow `references/output-template.md`: verdict, content/cast, narrative, production plan organized by generation units or shooting sessions, shot table, packaging, audio, real-material checklist, uncertainties and report path. Preserve the narrative structure when adapting a video to a user's own examples; do not just replace the main character. Do not paste the entire breakdown into chat.

Respond in the user's requested language. Determine output language from explicit instruction, then the user's question, then saved language preference; use English if none is established. The CLI supports `--lang zh` and `--lang en`: use Chinese only when requested, otherwise English technical reports. For Vietnamese or other unsupported report languages, run `--lang en`, respond in the user's language and translate `report.md` into `report_<language>.md` if requested; explain that HTML remains English. `apply-review out/ref --lang en` regenerates report text but does not translate already generated VLM descriptions/prompts. Write new review evidence/descriptions/prompts in the selected report language. Save explicit long-term preferences using `rea-video prefs lang en`.

## Remake and references
Read `references/remake.md` for capsule-cinema, Remotion and assembly. Preview billable generation using `rea-video remake-run --dry-run`; obtain the user's authorization before paid calls. Supply filming plans for real footage and original-asset requirements for embedded material. Keep subtitle/graphic layers separate from generated footage.

References: `setup.md` for installation/VLM; `review.md` for evidence fusion and transcoding; `taxonomy.md` for labels and confusion pairs; `audio.md` for sound; `materials.md` for real assets; `output-template.md` for delivery; `remake.md` for execution; `memory.md` for corrections (all under `references/`).

Do not classify solely by visual style, label code-rendered text as an extra overlay, replace user material with imaginary AI assets, use missing metadata as proof of non-AI origin, or execute paid generation without authorization.
