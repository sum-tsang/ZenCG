# ZenCG Blog (Client-side Markdown)

This blog is a static site that renders Markdown in the browser.

## File map

- `index.html`: Blog shell and layout.
- `blog.js`: Client-side router, Markdown renderer, and post loader.
- `blog.css`: Blog styling.
- `posts.json`: Post index (list view).
- `posts/`: Markdown content for each post.

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

3) Add the post to `code/blog/posts.json`:

```json
{
  "slug": "2026-01-15-your-title",
  "title": "Your post title",
  "date": "2026-01-15"
}
```

The `slug` must match the filename without `.md`, and the `date` should be ISO format.

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
