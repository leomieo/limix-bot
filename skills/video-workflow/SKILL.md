---
name: video-workflow
description: Analyze a reference video, author an editable Hypit workflow and produce verified short-form variants.
metadata:
  optionalRequirements:
    bins: [hypit, node, ffmpeg, ffprobe, rea-video]
    npm: [remotion, "@remotion/cli"]
    python: [vieneu, whisperx]
---

# Short-form video production

## English Core

Start from a brief or a reference the user can use. Record the intended audience, language, canvas, duration, available footage and requested number of variants. Keep originals and approved renders intact.

## Workflow

1. Inspect the reference locally. Record observed cuts, spoken beats, captions, cutaways, transitions and sound in a shot table. Mark uncertain timing or speaker attribution.
2. Write an original script. Identify the elements to keep and the single difference to test per variant. Keep captions and narration in the requested audience language. Anchor edits to spoken words when alignment is available.
3. To start from still artwork, copy the files in assets/starter to the project directory, place the supplied image at hero.png and update the image dimensions. Author the composition in main.svml, appearance in style.svs and the delivery target in build.svrun. Reuse accepted media across variants.
4. If the operator has installed Hypit, inspect its version, run `hypit check main.svml` and `hypit plan build.svrun` in the project. Summarize the targets, missing inputs, remote operations and expected charges if known. A working source or plan is a valid deliverable when rendering is unavailable.
5. With a prepared runtime and an approved plan, run `hypit build build.svrun --follow`; read the actual build ID and export with `hypit get BUILD_ID --output final.video --to output/final.mp4`. Retain the sources, plan, output and differences between versions.

## Tools by task

Drafts, shot lists and caption scripts can be written directly. For external tools, direct the user to Tools for skills → Skill requirements. Use only tools already available or explicitly selected for the project.

- Hypit CLI and Node.js run the SVML workflow. Hypit Studio is available through the same CLI. Find the official CLI and Studio setup in https://github.com/hypit-ai/hypit/blob/main/docs/quickstart/run.md. Choose a local runtime for rendering, or configure a provider explicitly for generated assets.
- FFmpeg and ffprobe process and inspect rendered media. REA Video decomposes a reference into shots.
- Remotion and its CLI render code-driven motion graphics when that workflow is requested.
- VieNeu-TTS (Python distribution `vieneu`) synthesizes Vietnamese narration. WhisperX aligns spoken words to subtitle timings.

## Safety Boundaries

Check permission to use footage, voices and likenesses. Request approval before paid generation, transmitting private media to a provider or publishing. Keep credentials in operator configuration. If the local CLI or runtime is missing, identify the missing dependency. Do not install packages, upload media or claim a completed render implicitly.

## Verification

Probe each exported file for dimensions, frame rate, duration and expected audio. Inspect the opening, the main transition and the ending. For speech, verify caption synchronization and audibility. Deliver only files that exist and state which variants were rendered. Vietnamese usage examples are in `references/vi.md`.
