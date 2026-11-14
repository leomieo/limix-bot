# Production taxonomy and confusion checks

## Eleven underlying-image labels
| Enum | Evidence and recreation |
|---|---|
| `live_action` | Author/client-shot footage: sensor noise sigma>1, temporal noise>0.8, unchanged-pixel share<0.55, handheld motion, native 60fps, camera metadata. Request originals or propose a disclosed AI approximation |
| `ai_video` | Photographic texture without sensor noise, 24->30 duplicate/interpolation cadence, floating camera, deforming hands/text/objects or flicker. Recreate with reviewed first/last-frame generation |
| `avatar` | Fixed frontal talking head with audio-driven mouth/head movement; authorized voice/avatar workflow |
| `cg_3d` | Stable geometry/materials and physically coherent movement; clean but not pixel-frozen background. Blender/C4D or disclosed AI approximation |
| `code_render` | Flat blocks>20%, colors<70, straight edges, frozen background/local animation; smooth gradients, saturated shapes, dark glows, shader fields, particles/point clouds/wireframes without material texture. Remotion/HTML; Three.js for particles, GLSL for fields, CSS blur for gradients, SVG/D3 for charts |
| `screen_capture` | Dense small UI text, light panels, low saturation, page scrolling or game HUD. Request actual recording/screenshots |
| `still_motion` | Rigid-transform inliers>95%, residual<0.3px, no remaining compensated motion and no 24fps cadence. Rebuild from one image with FFmpeg |
| `static_hold` | >85% pixel-duplicate frames; one image, unless a flat rendered card is more appropriately code_render |
| `anim_2d` | Visual-only recognition: stable linework/flat colors, skeletal/frame animation, often on twos; character sheet plus animation or AE/Live2D/Spine for precision |
| `stop_motion` | Visual-only: stable real clay/felt/paper texture, stepped motion, slight flicker and stable lighting. Prefer actual fixed-camera capture (~12 images/sec); AI is an approximation |
| `film_footage` | Existing film/TV/short-drama excerpts: recognizable actors, professional sets/lighting, extras, readable scene text, watermarks/credits, wide frame in black bars. Source and license footage or reshoot; do not call it client-shot live_action |

Visual-only labels remain uncertain with one visual source; independent agent+VLM review can strengthen them. No label is established solely by style, metadata absence or a platform disclaimer.

## AI edits on live action/stop motion
Use exact `ai_edits.kind` enums: `face_swap` (flickering face/hair edges, lighting mismatch, drifting profile; R12), `lip_sync` (jaw/mouth mismatch, blurred teeth/local quality; R13), `restyle` (human motion with drifting anime/painting/clay texture; R12), `outfit_swap` (flickering clothes/arm boundaries; R05+video), `bg_replace` (hair halos, mismatched lighting/perspective; keying or R12), `object_edit` (unstable edges/missing shadows; R12), `beautify` (over-smoothed skin/warped nearby straight lines; beauty editor). Add required post-shoot AI processing to the filming plan.

## Evidence checks
- Around 20% duplicate frames with a 4-6 cadence suggests 24->30 conversion: AI, CG or film, not necessarily AI. Native >=48fps without duplicates/interpolation favors camera footage. Sharpness periodicity alone is weak; AI upsampling to 60fps may have `sharp_period_ac>0.45`.
- Platform transcoding invalidates missing-noise arguments. Native 30fps with no shot duplicates can support phone footage; combine with visual evidence.
- Sparse glowing points/lines without continuous shaded surfaces are code particles, not solid CG. Describe the shape, color, particle flow/morph/camera, labels and numbers, not merely particle background.
- Smooth gradients/glows/flat saturated shapes remain code_render even if the entire frame moves. CG has material texture, shadows and object-light interaction. Flat posters with added film grain may fool noise tests (sigma>=3); inspect visually. A continuous slow gradient is not automatically a dissolve.
- Code typography is large/branded/vector-like with entrances; screenshots contain dense UI controls/small text. A screenshot inside a template is an embedded real asset over code_render.
- Code descriptions identify numbered elements in `shots/shot_XXX_elements.jpg` and `shot_XXX_strip.jpg`; measured position/time/easing/colors belong to the report timeline and need not be re-invented.
- A slowly zoomed still has rigid motion and timeline-rate changes; AI push-ins often retain 24fps cadence and tiny breathing/blinking movements.
- 2D character animation has stable lines and performance; code motion animates text/UI/shapes; AI animation style drifts/deforms. Comic panels with pan/zoom are still_motion; local blinking/hair/mouth animation is anim_2d; drifting details support ai_video. Record `image_source=ai_image` only when supported.
- Stop motion preserves physical fingerprints/fibers with stepped movement; AI imitation changes the material itself. Verify stability rather than cadence alone.
- Film has identifiable actors/sets/extras, readable signs and coherent professional shooting. AI shorts may have overperfect similar faces, malformed teeth/hands/text, drifting clothes and repeated 5-10-second closeups. Commentary layouts/disclaimers do not distinguish them. Label inserted author footage and AI shots separately.
- Game recordings/commentary/montages are screen_capture: inspect health bars, minimaps, reticles, abilities, damage/chat HUD. State game/viewpoint/HUD positions when recognized. HUD-free cinematic cutscenes/promos may be cg_3d.
- A static AI image vs real photo is not reliably separated by deterministic metrics; use visual review or keep origin unresolved. Flat low-color cards are code_render.
- Dark grainy footage with faces and non-flat highlights may be night live action, even if transcoding flattened shadows. A speaking face occupying >=6% throughout the shot supports a close-up/avatar, not a rendering label based only on a flat wall or clothing.
- Whole-file GB 45438 AIGC `Label=1` declares AI involvement in the file; classify individual shots separately. Audio across cuts and BGM in speech gaps are supporting contextual cues, not image-production proof.

## Cuts
Hard cuts require histogram/pixel spikes affecting >25%; element entrances are not cuts. Jump/punch-in cuts may affect >17% but exceed surrounding frame changes by >2.5x, with stable adjacent frames and no return to the previous image. Flashes that return after 1-2 frames are not cuts; a white-flash transition revealing a new scene is.
Keep stable shots between clean cuts as short as 0.12 seconds. Merge closer boundaries from one transition using the strongest boundary. Dissolves fit an alpha blend of endpoints (alpha0.2-0.8, residual<0.2), with optical flow excluding zoom/pan. Fades pass through very dark/light frames. Within-shot motion-graphics holds with content difference>12% are internal beats, not separate cuts.
