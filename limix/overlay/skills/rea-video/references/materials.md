# Real source assets and generation references

Real source assets are pixels imported from reality: footage, photos, website/app screenshots, screen recordings, embedded clips and pasted logos/product images. For recreation, ask for originals; never promise to generate the user's real source files with AI.

Keep generation references separate. AI/3D-rendered characters/products/logos are generated pixels; store needed reference images in `material.references`. Products in live-action scenes are props/references. Preserve literal provider syntax such as `@图片N` when an external tool requires it; explain its meaning in the user's language.

Whole-frame live action needs footage; screen captures need original recordings/screenshots. A still/moving still from a known photo needs that photo. Unknown still origin remains real-vs-AI unresolved and is not counted as confirmed real material.

Embedded detection applies to rendered layouts (code, screen, 3D, cards): high-entropy non-flat photo textures outside captions are photo candidates, not proof of real origin. A light panel with >=6 small text regions suggests a real UI screenshot. Motion inside a static surround suggests embedded video/screen recording. Verify candidates visually or through VLM.
For VLM `embedded_assets` with `is_real_material=true`, rendered-layout footage is an embedded clip and may itself be AI. In AI/avatar/live-action bases, or for 3D products/logos/characters, record references instead of assuming embedded originals.

Known misses: dark/translucent atmospheric photographs, dark-mode website screenshots, small logos/product pictures over photographic backgrounds. Inspect dark backgrounds and UI frames yourself; do not treat detector silence as absence.
Stock aerials, landscapes, business scenes and unrelated hand closeups may be stock footage. Mark suspected stock cutaways separately from author-shot material; similar licensed stock can replace them. `film_footage` belongs to its rights holder: identify the source segment and licensing need instead of asking as if the user shot it.

Deliver a checklist with shot ID, time, asset type, screen position, description and exactly what the user needs to provide.
