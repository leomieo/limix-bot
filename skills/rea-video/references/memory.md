# Remember explicit corrections and preferences

- For a user-confirmed shot correction, run `rea-video correct out/ref --shots 3,5 --label stop_motion --note "<user's exact correction>"`. Use taxonomy enum identifiers: `stop_motion` for stop motion, `still_motion` for a moving still. Alternatively select `--start/--end`, use `--shots all`, or set real-material status with `--real yes|no`.
- Corrections update conclusions/reports immediately and append to `~/.rea-video/corrections.jsonl`. The same file reuses them later; related review tasks show correction history.
- Save explicit durable preferences using `rea-video prefs engine kling2.1`, `prefs vlm on`, `prefs env_file <path>`, `prefs reviewer <name>`, or `prefs capsule_root <path>`. Save other preferences with `rea-video prefs --note "Keep reports short and focus on the remake plan"`. Read `rea-video memory` next time and honor them.
- Do not record your guesses as user corrections. Corrections do not automatically train classification weights. Export accumulated examples using `rea-video memory --export-labels eval/user_labels.yaml` and follow `docs/dev/evaluation.md` before changing rules.
