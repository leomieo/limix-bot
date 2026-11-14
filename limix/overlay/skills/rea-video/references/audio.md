# Audio analysis

Read `audio` (measurements), `audio_plan` (fused conclusions/remake) and `audio.png`. The reliability figures below describe pinned upstream samples, not guaranteed local performance.

| Signal | Interpretation and limits |
|---|---|
| Voice | Syllabic modulation at 3-8 Hz plus pauses; generally strong |
| BGM | Tonal sound during speech gaps (harmonic share >0.62), sustained harmony or beat periodicity. A single steady pitch/hum/beep is `steady_tone`, not music |
| BPM | Percussive onset-envelope autocorrelation plus half/double candidates. Do not assign BPM to sustained pads or weak/no percussion. Upstream sample: 110.0 vs 110.15 ground truth |
| Key | Chroma + Krumhansl profile; medium/high upstream reliability |
| Sections | Chroma/loudness novelty peaks; medium reliability |
| SFX | Prominent non-beat transients outside voice; require actual percussive energy. Reject compression noise and final 0.1-second truncation artifacts. Low precision (~0.2 upstream in voice+BGM mixes); quiet effects often missed. Prefer verified audio-capable VLM/listening |
| TTS vs person | Requires listening/VLM, not a confident signal-only conclusion |
| Voice pitch | Median <150 Hz leans lower/male, >200 Hz higher/female; reference only, not a personal identity determination |
| Beat cuts | Cut-to-beat proportion versus random chance; medium/high |

## Stems
`decompose` creates `stems/original.wav` (full mix), `vocals.wav` (voice, possibly transient keyboard/ding sounds), and `music.wav` (music+ambience). `rea-video stems <video>` performs separation alone. Upstream uses UVR MDX-Net Inst HQ 3 ONNX on CPU, first download ~67 MB into `~/.cache/rea-video/models` or `REA_VIDEO_MODELS`. Reported sample SDR ~19.7 dB, BGM leakage -42 dB and ~0.6x real-time on four cores are upstream benchmarks only. Listen to isolated vocals/music when possible.

## Source attribution
Read `sound_sources` -> music/voice/sfx with `source`, `leaning`, `probs`, `evidence`, `how_to_confirm`. The source summary may use the literal field `sound_sources.summary_zh`; do not rename wire fields.

Determine the format first. Music-video format with music >85% and singing/rap vocals supports an AI-song prior of 60% (45% without VLM). Ordinary narration or instrumental BGM supports a stock-library prior of 60%. These are hypotheses, never proof. On isolated vocals, `sustained_note_ratio` counts notes >=160 ms (>0.3 suggests singing); upstream TTS ~0.14-0.15 and rap ~0.24. `chorus_repeat_share` counts a four-second melody repeating >=6 seconds later (>0.1 supports song, including rap); short excerpts without a chorus defeat this cue.

Update hypotheses with evidence: lyrics matching custom characters/products/story or a recognized `song_guess` are strong; a platform music label naming a track (`--meta`) is strong; an author-original-sound label is medium; a full-volume hard cutoff is weak; ending with the video or a whole-file AIGC marker is very weak. Highest source probability <45% stays unresolved with a leaning.

Ordinary AI-workflow videos often use Suno instrumental music. Signal/listening alone may not distinguish it from stock. Say stock-leaning, unconfirmed and offer verification: original platform music tag, music recognition (QQ/ACRCloud/etc.), rights/source information. Recognition failure is not AI proof. Indistinct articulation, metallic highs, tailored lyrics, repetitive structure or abrupt/looped endings are clues only.

Voice sources include TTS, native generated-video audio and human recordings. `per_clip_audio.resets_at_cuts` means audio follows clips: generated native audio or production sound. SFX usually come from libraries or native video audio; deterministic analysis gives candidates, not a verified exhaustive inventory.

Inspect `audio.png`, align effects to actual text/transitions/actions using `rea-video tiles`, and disclose quiet-SFX uncertainty. Recognized popular tracks require licensing or replacement. Recreate voice using authorized TTS/cloning (DoubaoTTSTool/UniversalTTSTool/MiniMax), BGM via licensed stock or UniversalMusicGenerationTool/Suno, and timed SFX tuned to the BGM key when appropriate. Do not claim to have listened without audio access.
