# Mermade

Draw class, sequence, ER, state, activity, and architecture diagrams on an infinite canvas. Export is Mermaid markdown you can commit to git.

## Run

```bash
cp .env.example .env
npm install
npm test
npm run dev
```

Open the URL Vite prints. Chromium is best (File System Access API for Open/Save into your repo clone).

## GitHub save (Supabase Auth)

Diagrams stay as `.md` files in a GitHub repo (`mermade/*.md`). Supabase is only the login: **Sign in with GitHub**, then pick the repo. Nothing is stored in a Supabase database.

1. Create a [Supabase](https://supabase.com) project (free tier is enough).
2. Create a GitHub OAuth App (Settings → Developer settings → OAuth Apps). Homepage and callback:

   - Homepage: `http://localhost:5173`
   - Callback: `https://<project-ref>.supabase.co/auth/v1/callback`

3. In Supabase: **Authentication → Providers → GitHub**. Paste the client ID and secret. Turn on **Allow users without an email**. Click **Save**. Copy the Callback URL into the GitHub OAuth App’s Authorization callback URL (it must be `https://<project-ref>.supabase.co/auth/v1/callback`, not localhost).
4. In Supabase: **Authentication → URL configuration**, set Site URL to `http://localhost:5173`. Add Redirect URLs:

   - `http://localhost:5173`
   - `http://localhost:5173/**`

   Always open the app at `http://localhost:5173` (the port is fixed). A different port breaks GitHub sign-in.
5. Copy the project URL and **publishable** key (**Settings → API Keys**, not the legacy `anon` JWT) into `.env`:

```
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

The publishable key is public by design (it ships in the browser). Never put a **secret** (`sb_secret_...`) or legacy `service_role` key in this app. Restart `npm run dev` after changing `.env`.

In the editor, click **New** for a blank diagram, or **Diagrams** to open, duplicate, rename, or delete files in `mermade/`. Name the diagram in the top bar; it autosaves after you pause. **Upload from computer** (on the Diagrams page) opens a local `.md` file and stores it in that repo.

## Diagram types

The left sidebar keeps tools, shapes, and link kinds in view. Diagram type is a dropdown at the top of the sidebar. Switching type only changes the sidebar and how the file is saved as Mermaid — boxes already on the canvas stay put. Undo (⌘Z) restores the previous type. Select a class and fill its name, fields, and methods on the right. **New** starts a blank canvas in the current type.

- **Class** — types, fields, methods; Extends / Implements / Contains / Uses; Package; multiplicity on links
- **Sequence** — Person and System, Call / Reply, If / Repeat / Optional frames
- **ER** — entities and how they relate (one to one, one to many, …)
- **State** — start, states, branch, end
- **Activity** — start, action, decision, end (`flowchart TD`)
- **Architecture** — services, databases, queues

Select a class: a panel appears beside the box with **Name**, **Fields**, and **Methods**. Each row has Public/Private/Protected/Internal, then name, type or args. Enter moves to the next box.

## Keys

| Key | Action |
|---|---|
| V | Move |
| H / Space | Pan |
| L | Link |
| G | Group / If frame |
| 1 / 2 | Fit all / selection |
| Pinch / ⌘-scroll | Zoom (click the % to reset 100%) |
| ⌘Z / ⌘⇧Z | Undo / redo |
| ⌘D | Duplicate |
| ⌘S / ⌘O | Save / diagrams page |
| New | Header **New** starts a blank diagram in the current type |
| Enter / F2 | Type on the selected shape |
| Delete | Remove (undoable) |
