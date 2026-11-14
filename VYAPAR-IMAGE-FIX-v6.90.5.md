# Vyapar promotional image display fix — v6.90.5

- Removed fixed 190px image frame for Vyapar promotional cards.
- Removed `object-fit: cover`, which cropped the artwork.
- Images now render at full intrinsic aspect ratio using `height: auto` and `object-fit: contain`.
- Applied the same behavior on mobile layouts.
- No changes to image URLs, media records, or content management.

Build verification: not run in this environment.
