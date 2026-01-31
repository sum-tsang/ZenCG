const listView = document.getElementById("list-view");
const postView = document.getElementById("post-view");
const postList = document.getElementById("post-list");
const postTitle = document.getElementById("post-title");
const postMeta = document.getElementById("post-meta");
const postContent = document.getElementById("post-content");
const backLink = document.getElementById("back-link");
const lightbox = document.getElementById("image-lightbox");
const lightboxImage = document.getElementById("lightbox-image");

if (!postList || !postTitle || !postMeta || !postContent || !backLink) {
  throw new Error("Blog layout is missing required elements.");
}

let posts = [];
const baseUrl = new URL("../", import.meta.url);

// Escape HTML special characters for safe rendering.
function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Convert inline markdown syntax into HTML.
function formatInline(text) {
  return text
    .replace(/!\[([^\]]*?)\]\(([^)\s]+?)(?:\s+&quot;(.+?)&quot;)?\)/g, (match, alt, src, title) => {
      const titleAttr = title ? ` title="${title}"` : "";
      return `<img src="${src}" alt="${alt}" loading="lazy"${titleAttr} />`;
    })
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\[(.+?)\]\((.+?)\)/g, "<a href=\"$2\">$1</a>");
}

// Render a subset of markdown into HTML.
function renderMarkdown(markdown) {
  const lines = markdown.split(/\r?\n/);
  let html = "";
  let listType = null;
  let inCode = false;
  let paragraph = [];

  // Flush the buffered paragraph lines into HTML.
  const flushParagraph = () => {
    if (paragraph.length === 0) {
      return;
    }
    const text = formatInline(escapeHtml(paragraph.join(" ")));
    html += `<p>${text}</p>`;
    paragraph = [];
  };

  // Close an open list if needed.
  const closeList = () => {
    if (listType) {
      html += `</${listType}>`;
      listType = null;
    }
  };

  // Close an open code block if needed.
  const closeCode = () => {
    if (inCode) {
      html += "</code></pre>";
      inCode = false;
    }
  };

  lines.forEach((line) => {
    if (line.trim().startsWith("```")) {
      flushParagraph();
      closeList();
      if (inCode) {
        closeCode();
      } else {
        html += "<pre><code>";
        inCode = true;
      }
      return;
    }

    if (inCode) {
      html += `${escapeHtml(line)}\n`;
      return;
    }

    if (line.trim().match(/^-{3,}$/)) {
      flushParagraph();
      closeList();
      html += "<hr />";
      return;
    }

    if (!line.trim()) {
      flushParagraph();
      closeList();
      return;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.*)$/);
    if (headingMatch) {
      flushParagraph();
      closeList();
      const level = headingMatch[1].length;
      const text = formatInline(escapeHtml(headingMatch[2]));
      html += `<h${level}>${text}</h${level}>`;
      return;
    }

    const unorderedMatch = line.match(/^[-*]\s+(.*)$/);
    if (unorderedMatch) {
      flushParagraph();
      if (listType !== "ul") {
        closeList();
        html += "<ul>";
        listType = "ul";
      }
      const text = formatInline(escapeHtml(unorderedMatch[1]));
      html += `<li>${text}</li>`;
      return;
    }

    const orderedMatch = line.match(/^(\d+)[.)]\s+(.*)$/);
    if (orderedMatch) {
      flushParagraph();
      if (listType !== "ol") {
        closeList();
        html += "<ol>";
        listType = "ol";
      }
      const number = orderedMatch[1];
      const text = formatInline(escapeHtml(orderedMatch[2]));
      html += `<li value="${number}">${text}</li>`;
      return;
    }

    if (listType) {
      closeList();
    }
    paragraph.push(line.trim());
  });

  flushParagraph();
  closeList();
  closeCode();
  return html;
}

// Open the image lightbox for a given image element.
function openLightbox(image) {
  if (!lightbox || !lightboxImage) {
    return;
  }
  lightboxImage.src = image.currentSrc || image.src;
  lightboxImage.alt = image.alt || "";
  lightbox.classList.add("is-open");
  lightbox.setAttribute("aria-hidden", "false");
  document.body.classList.add("lightbox-open");
}

// Close the image lightbox and reset its state.
function closeLightbox() {
  if (!lightbox || !lightboxImage) {
    return;
  }
  lightbox.classList.remove("is-open");
  lightbox.setAttribute("aria-hidden", "true");
  lightboxImage.src = "";
  lightboxImage.alt = "";
  document.body.classList.remove("lightbox-open");
}

// Show the post list view and hide the post view.
function showList() {
  listView.hidden = false;
  postView.hidden = true;
}

// Show the post view and hide the list view.
function showPost() {
  listView.hidden = true;
  postView.hidden = false;
}

// Render the list of available blog posts.
function renderPostList() {
  postList.innerHTML = "";

  posts.forEach((post) => {
    const item = document.createElement("li");
    const time = document.createElement("time");
    const link = document.createElement("a");

    time.textContent = post.date;
    time.setAttribute("datetime", post.date);
    link.href = `#${post.slug}`;
    link.textContent = post.title;

    item.append(time, link);
    postList.append(item);
  });
}

// Fetch and render a single post by slug.
async function renderPost(slug) {
  const post = posts.find((entry) => entry.slug === slug);
  if (!post) {
    postTitle.textContent = "Post not found";
    postMeta.textContent = "";
    postContent.textContent = "";
    showPost();
    return;
  }

  postTitle.textContent = post.title;
  postMeta.textContent = post.date;
  postContent.textContent = "Loading...";
  showPost();

  try {
    const response = await fetch(new URL(`posts/${post.slug}.md`, baseUrl));
    if (!response.ok) {
      throw new Error("Failed to load post");
    }

    const markdown = await response.text();
    postContent.innerHTML = renderMarkdown(markdown);
  } catch (error) {
    console.error(error);
    postContent.textContent = "Unable to load the post content.";
  }
}

// Handle hash-based route changes.
function onRouteChange() {
  const slug = window.location.hash.replace("#", "").trim();
  if (!slug) {
    showList();
    return;
  }

  renderPost(slug);
}

// Initialize blog data and render the initial view.
async function init() {
  try {
    const response = await fetch(new URL("src/posts.json", baseUrl));
    posts = await response.json();
    posts.sort((a, b) => (a.date < b.date ? 1 : -1));
    renderPostList();
    onRouteChange();
  } catch (error) {
    console.error(error);
    const isFile = window.location.protocol === "file:";
    postList.innerHTML = isFile
      ? "<li>Posts failed to load. Run a local server instead of opening the file directly.</li>"
      : "<li>Unable to load posts.</li>";
  }
}

window.addEventListener("hashchange", onRouteChange);
backLink.addEventListener("click", (event) => {
  event.preventDefault();
  history.replaceState(null, "", window.location.pathname + window.location.search);
  showList();
});

if (postContent) {
  postContent.addEventListener("click", (event) => {
    const target = event.target;
    if (target && target.tagName === "IMG") {
      openLightbox(target);
    }
  });
}

if (lightbox) {
  lightbox.addEventListener("click", (event) => {
    if (event.target.matches("[data-lightbox-close]")) {
      closeLightbox();
    }
  });
}

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && lightbox && lightbox.classList.contains("is-open")) {
    closeLightbox();
  }
});

init();
