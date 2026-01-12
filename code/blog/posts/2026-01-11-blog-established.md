# ZenCG Blog

Hello, we have set up a basic blog using the Markdown format. We will document our software engineering process, development processes, and major design decisions. The blog will be publicly accessible and will likely be hosted on Render. We chose the Markdown format due to the nature of the project, and because previous requirements required Markdown.

## ZenCG Base Established

> Last updated (11th January 2026 17:33)

Hi, we have essentially established the basis of ZenCG. We initialised the repos, got a basic Three.js canvas working, and have some basic working features. Moreover, we now have a blog, and the site is being hosted on Render. This can be
found at https://zencg.onrender.com

Alternatively, you can directly visit the editor and blog at:
- https://zencg.onrender.com/editor
- https://zencg.onrender.com/blog


### 1. Structure

#### 1.1 Code Repository

At a high level, we have two apps: blog and editor. This architecture keeps it simple. We have a public blog, and the actual project program, which is our 3D editor (named editor for simplicity).

```
code/blog
code/editor
```

#### 1.2 Editor Repository

The editor repo contains all our functions, bundled in the /src directory. Following our functional specification, we created folders for each function, or group of functions (e.g. io for import/export). Naming conventions are subject to change.

```
editor/src/camera
editor/src/combiningModels
editor/src/io
editor/src/materialEditing
editor/src/modelTransformation
editor/src/resizingModelComponents
editor/src/history
```

### 2. Editor

- We created a basic, functioning Three.js canvas with rendering, scene, lighting, and a working camera.
- We added an OBJ import and export, and the imported OBJ is parsed and framed in the view.
- Added camera controls, each has its own atomic js file for modularity.
- Using IndexedDB, it allows us to refresh the page while the project persists (this will likely have a 50MB limit as per the functional specification).
- Basic UI, control panel, and canvas established.
- Root directory `/code` has index.html as a homepage and will be a landing page for our ZenCG website.

### 3. DevOps

- As GitLab doesn't seem to have Pages, or allow us to use Render due to GitLab being a specific DCU instance (gitlab.computing.dcu.ie), we mirrored our GitLab repo to Sum's personal GitHub. From there, Render has access to the repo and deploys to a static site.
- All we have to do is run `git add`, `git commit -m`, and `git push origin main`... which is picked up by the GitHub mirror, and allows Render to have access to the repo.
- We chose Render because it is relatively lightweight, simple, and efficient for deploying apps, and because the AUTODEPLOY feature makes the update pipeline simple. Moreover, it provides a custom URL/domain, which allows us to make our site and personal blog public, as per requirements.
