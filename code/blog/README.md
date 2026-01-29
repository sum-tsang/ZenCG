# ZenCG Blog (Client-side Markdown)

This blog is a static site that renders Markdown in the browser.

## File map

- `index.html`: Blog shell and layout.
- `src/blog.js`: Client-side router, Markdown renderer, and post loader.
- `src/blog.css`: Blog styling.
- `src/posts.json`: Post index (list view).
- `posts/`: Markdown content for each post.
- `assets/`: Images for posts.

## Add a new post

1) Create a new markdown file in `code/blog/posts/`, e.g.:

```bash
code/blog/posts/2026-01-15-your-title.md
```

2) Start the post with a title and content, for example:

```md
# Your post title

Summary paragraph: what changed and why it matters.

## What we did

- Task or feature completed.
- Design decision or tradeoff.
```

3) Add the post to `code/blog/src/posts.json`:

```json
{
  "slug": "2026-01-15-your-title",
  "title": "Your post title",
  "date": "2026-01-15"
}
```

The `slug` must match the filename without `.md`, and the `date` should be ISO format.

## Images

Place image files in `code/blog/assets/` (create the folder if needed). Image paths are resolved relative to `code/blog/`:

```md
![Home page layout](./assets/home-page.png)
```

Optional title text is supported:

```md
![Gizmo update](./assets/gizmo-update.png "Transform gizmo improvements")
```

## Local preview

Any static server will do:

```bash
python3 -m http.server 8000
```

Open:

```
http://localhost:8000/code/blog/
```

## Render (static site)

Publish the `code/blog` directory as a static site.
