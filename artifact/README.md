# Single-file artifact build

`PassThePigs.jsx` is the entire app in one file, using `window.storage` for
persistence (the claude.ai artifact sandbox). It's the same engine + UI as
`/src`, kept as a drop-in reference / shareable artifact.

To use it in a normal React app instead, replace the `store` object at the top
with `src/storage.js`'s localStorage adapter (or any `{get,set}` of your own).
