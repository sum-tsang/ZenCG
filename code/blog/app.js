const listView = document.getElementById("list-view");
const postView = document.getElementById("post-view");
const postList = document.getElementById("post-list");
const postTitle = document.getElementById("post-title");
const postMeta = document.getElementById("post-meta");
const postContent = document.getElementById("post-content");
const backLink = document.getElementById("back-link");

if (!postList || !postTitle || !postMeta || !postContent || !backLink) {
  throw new Error("Blog layout is missing required elements.");
}

let posts = [];
const baseUrl = new URL(".", import.meta.url);

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatInline(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/\[(.+?)\]\((.+?)\)/g, "<a href=\"$2\">$1</a>");
}

function renderMarkdown(markdown) {
  const lines = markdown.split(/\r?\n/);
  let html = "";
  let inList = false;
  let inCode = false;
  let paragraph = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) {
      return;
    }
    const text = formatInline(escapeHtml(paragraph.join(" ")));
    html += `<p>${text}</p>`;
    paragraph = [];
  };

  const closeList = () => {
    if (inList) {
      html += "</ul>";
      inList = false;
    }
  };

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

    const listMatch = line.match(/^[-*]\s+(.*)$/);
    if (listMatch) {
      flushParagraph();
      if (!inList) {
        html += "<ul>";
        inList = true;
      }
      const text = formatInline(escapeHtml(listMatch[1]));
      html += `<li>${text}</li>`;
      return;
    }

    paragraph.push(line.trim());
  });

  flushParagraph();
  closeList();
  closeCode();
  return html;
}

function showList() {
  listView.hidden = false;
  postView.hidden = true;
}

function showPost() {
  listView.hidden = true;
  postView.hidden = false;
}

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

function onRouteChange() {
  const slug = window.location.hash.replace("#", "").trim();
  if (!slug) {
    showList();
    return;
  }

  renderPost(slug);
}

async function init() {
  try {
    const response = await fetch(new URL("posts.json", baseUrl));
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
backLink.addEventListener("click", () => {
  window.location.hash = "";
});

init();
