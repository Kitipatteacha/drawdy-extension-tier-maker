# Changelog

## 0.1.1

- Only images can be ranked. Other board elements dropped on a list are no
  longer pulled into its pool.
- Safe on shared boards: when several people have Tier Maker open, a resize
  reflows its row once instead of once per person, items are placed at
  absolute positions so concurrent redraws agree instead of stacking up, and
  rows no longer get drawn twice (a list left with doubled rows heals on the
  next change).
- One undo step per action. Rows that grow, shrink or shift are now resized
  and moved in place in the same update as the images, so ranking an image,
  moving a list and **Send everything back to the pool** each undo in one
  step after the drag itself. Rows are only drawn fresh when they are new or
  their text or color changes. Lists drawn by an older version redraw fully
  once.
- Removed **Fit images to image height**. Extensions can't resize board
  elements, so it only re-laid the rows as if it had, leaving images
  overlapping their rows.

## 0.1.0

- First release: a tier list builder.
