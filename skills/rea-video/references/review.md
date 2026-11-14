# Visual review and evidence fusion

Follow the review workflow in SKILL.md. The following fusion behavior is documented by the pinned upstream evaluation, not newly verified local performance.

## Fusion
- With only one visual source (VLM or agent), visual votes normally choose among the tool's top two candidates. Confident AI/live-action/avatar evidence and 24->30 duplicate-frame cadence are not overturned merely because a frame looks real.
- A shot with native 30fps cadence and no duplicates may accept a live-action visual vote even when the full video mixes AI shots. When all top-three probabilities are below 0.4 and the visual choice is only slightly below the runner-up, visual review can prevail.
- `anim_2d`, `stop_motion`, `film_footage` require visual recognition; accepted votes from a single visual source remain uncertain. With two sources, fuse broad families first (generated/rendered/filmed/screen/still), then subtypes. If either visual source supports the tool's top family, retain that family; if both disagree, use normal fusion.
- Always inspect disputed shots and verify that the VLM's alleged evidence is actually visible. Prior user-correction history increases review priority.

## When you cannot see images
Establish whether you can inspect storyboard/shot images. With neither image access nor working VLM, do not overturn production labels using the same pixel statistics the tool already consumed. You can verify timestamps, cuts, OCR, audio levels and metadata, and list low-confidence shots. Explicitly state that VLM was off and frames were not viewed; retain unresolved labels as unresolved.

## Originals and handcrafted material
For a single continuous realistic/handcrafted shot with no AIGC marker or 24->30 duplicates, first list evidence against the AI hypothesis. If you cannot identify deformation, flicker, physics errors or corrupted text, do not assert high confidence. Report AI vs live-action/stop-motion as unresolved with both sides' evidence and confidence <=0.7.

## Film clips vs AI shorts
Black bars/24-25fps and commentary layouts are clues, not proof. Recognizable actors/shows, professional sets/lighting, extras, readable text or station/platform watermarks support `film_footage`. Overperfect/similar faces, malformed hands/teeth/text and drifting textures support `ai_video`. Classify inserted author commentary, screenshots and AI clips separately. `live_action` denotes author/client-shot footage, not excerpts from existing films.

## Platform transcoding
`Tencent CAPD MTS`, `Wxmm_` and `vid:v...` can mark `video_context.transcoded`. Recompression removes noise and creates misleading sharpness/interpolation patterns. Missing sensor noise is therefore not AI proof.
24->30 duplicate frames, AIGC declarations and verified visual content remain evidence. Joint duplicate-frame cadence and an AIGC marker outweigh merely finding no visible AI defect; at most report AI-leaning uncertainty. Native 30fps without duplicates/AIGC plus natural visual evidence supports live action. Reencoded files with stripped platform metadata have similar caveats: periodic sharpness alone without duplicates is weak and visual review may override it.
