# Anaira AI Growth Engine v6.82.3 — External Assistant Popup

- Added Anaira / External Assistant tabs inside the existing floating chat popup.
- Added URL configuration through the popup settings control.
- External assistant URL can be saved in the current browser using localStorage.
- Added deployment-wide default via `NEXT_PUBLIC_EXTERNAL_ASSISTANT_URL`.
- Existing Anaira chat, lead form, polling, and WhatsApp handoff remain available in Anaira mode.
- External assistant is embedded in an iframe; the provider must permit iframe embedding (no blocking `X-Frame-Options` or restrictive `frame-ancestors` CSP).
- No database migration required.
