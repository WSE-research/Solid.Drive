# Tester Guide

> **Recommended browser:** Use **Google Chrome** for the smoothest experience. Other modern browsers (Firefox, Edge) work but Chrome is preferred.

---

## Getting the App Running

### Option A — Run locally (development)

**Prerequisites:** Node.js >= 18

```bash
# 1. Clone the repository
git clone https://github.com/WSE-research/Solid-Hello-World-Frontend-React.git
cd Solid-Hello-World-Frontend-React

# 2. Install dependencies
npm install

# 3. Start the development server
npm run dev
```

The app will be available at `http://localhost:5173` (or the port Vite prints in the terminal).

> **Important!** When running on `localhost`, use `solidcommunity.net` or `solidweb.org` as your identity provider. `inrupt.net` blocks localhost redirects (see Known Issues).

---

### Option B — Production Build

```bash
npm run build     # compiles TypeScript and bundles assets
npm run preview   # serves the /dist folder locally to verify the build
```

---

### Option C — Docker

```bash
# Build the image
docker build -t solid-hello-world-frontend-react .

# Run the container (serves on port 3000)
docker run -p 3000:80 solid-hello-world-frontend-react
```

The app will be available at `http://localhost:3000`.

The Docker image uses a two-stage build: Node 20 compiles the app, then nginx serves the static files on port 80.

---

### Option D — Live Demo (no installation needed)

A hosted instance is available at:

**http://demos.swe.htwk-leipzig.de:3000/**

Open the URL in your browser and skip straight to [Before You Start](#before-you-start). No installation required.

---

### Other npm Scripts

| Command | Purpose |
|---|---|
| `npm test` | Run the test suite once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Run ESLint |
| `npm run build:ldo` | Regenerate TypeScript bindings from ShEx shapes (dev only) |
| `npm run tbox:extract` | Re-fetch SHACL shapes from datashapes.org (dev only) |

---

## Before You Start

### Get a Solid Pod, if you don't have one :)

Before you can use solid.drive, you need a Solid Pod and a **WebID** (your Solid identity address).

| Provider | Sign-up URL | Notes |
|---|---|---|
| solidcommunity.net | https://solidcommunity.net/register | Recommended for testing |
| solidweb.org | https://solidweb.org | Alternative community server |
| inrupt.net | https://inrupt.net | **Do not use with localhost** |

After registering you will receive:
- A **WebID** —> looks like `https://yourname.solidcommunity.net/profile/card#me`
- A **Pod storage root** —> looks like `https://yourname.solidcommunity.net/`

Keep these handy. You will need your WebID to connect with others later on.

---

## First Things First — Log In

Whether you are in development mode (localhost) or on the live server, you will see the login screen with the header bar at the top. This is your main guide in the app.

1. In the top header, find the **provider dropdown** —> choose which provider you prefer to use.
2. Click the dropdown and select the matching provider where your Pod is hosted, or type in a custom provider URL.
3. Click **Log in**.
4. You will be redirected to your identity provider's login page. Enter your credentials there.
5. Should you have registered multiple pods, you can choose which one you wish to use.
6. After a successful login you are redirected back to solid.drive. Your display name appears in the header and the sidebar.

> **Tip:** Your session is remembered in the browser. You do not need to log in again after a page refresh.

---

## The Lay of the Land — App Layout

After logging in you will see three areas:

| Area | Description | Usage |
|---|---|---|
| **Header** (top) | Your name, logout button, and language switcher | Change your provider, switch your preferred language, or log out |
| **Profile sidebar** (left) | Your Pod details, contacts, and requests | Edit your display name and picture (requires a page refresh to update), add or remove contacts via their WebID, and handle incoming access requests to your Catalog |
| **File explorer** (center) | Your files and folder navigation | Everything on your Pod appears here so you can view it easily |

---

## Uploading Your First File

On your first login, solid.drive creates a new folder for you named `my-solid-app`. You can choose this folder to store your uploaded files, or pick any other folder available on your Pod.

1. Navigate to the folder you want to upload a file to.
2. In the file explorer, click **Choose file**.
3. Select any file from your device.
4. Fill in the required fields:
   - **Title** — required (e.g. `Holiday Photo`)
   - **Description** — fully optional
   - Data type, upload date, and publisher are filled in automatically
5. Once all required fields are valid, you can upload your file; otherwise you are prompted to fill in the required fields.
6. Click **Upload**. The app will:
   - Validate your metadata
   - Upload the binary file
   - Write a metadata document (`index.ttl`) alongside it
   - Register the file in your Pod's catalog
7. The file appears as a card in the explorer when the upload completes.

> **Note:** The first upload also links your catalog to your WebID profile so other Solid apps can discover it.

---

## Finding Your Way Around — Browse & Navigate

- Your files appear as cards in the file explorer.
- Click any **folder row** to navigate inside it —> the breadcrumb trail at the top updates as you go.
- Click a breadcrumb item to jump back up to any previous level.
- The explorer hides internal system files (catalog, ACL, helper files) automatically

---

## Peek at Your Files — Inline Preview

Each file card shows an inline preview automatically (currently only inside the `my-solid-app` folder):

| File type | Preview |
|---|---|
| Image | Thumbnail rendered directly on the card |
| Video | Playable video player |
| Audio | Audio player |
| PDF / text | Embedded viewer |
| Other | Download button only |

All previews are loaded from your Pod directly into your browser.

---

## What's Behind the Card — File Details

Click the **Info** button on any file card to expand the details panel. It shows:

- File type (schema.org class)
- Title
- Description
- Format (MIME type)
- File size
- Upload date
- Publisher name (resolved from their Solid profile)

---

## Take It With You — Download

Click the **Download** button on a file card. Your browser will save the file locally. The download comes directly from your Pod.

---

## Share the Love — Sharing Files

You can share any file you own with contacts listed in your Solid profile.

1. Click the **Share** button on a file card.
2. The Share panel opens and lists your current contacts.
3. Click **Grant** next to a contact to share the file with them.
4. The app will:
   - Update the file's access control list (ACL) on your Pod
   - Create a per-contact shared catalog so the recipient can discover the file
   - Restrict the shared catalog so only that contact can read it

To **revoke**:
1. Open the Share panel on the file.
2. Find the contact under **Shared with**.
3. Click **Revoke** next to their name.
4. The app removes them from the ACL and deletes the file entry from their shared catalog.

Should a contact be removed from your list, the files they shared with you or the files you shared with them are also removed.

---

## Someone Shared Something With You — Shared With Me

Scroll down below your own files to the **Shared with Me** section. The app reads your contacts' shared catalogs and displays any files they have shared with you as read-only file cards.

> If a contact shared files with you before the app was updated, it also checks their main catalog as a fallback, so older shares still show up.

---

## Spring Clean — Delete a File

1. Click the **Delete** button on a file card.
2. Confirm the deletion when prompted.
3. The app removes:
   - The file entry from your catalog
   - The binary file from your Pod
   - The metadata document (`index.ttl`)
   - The file's container on your Pod

No orphaned resources are left behind.

---

## Sprechen Sie Deutsch? — Switch Language

Should you wish to change the language, click the **language switcher** in the top header. Currently supported languages:

- English
- German

The selected language is remembered for your next visit.

---

## Test Checklist

Here is a checklist of the core flows worth putting through their paces, along with things to watch for.

### Test Accounts

You need at least **two Solid Pod accounts** to test the full sharing flow. Register two accounts on `solidcommunity.net` (or any mix of supported providers) and add each other as contacts via the Profile sidebar.

### Core Test Checklist

**Authentication**
- [ ] Log in with `solidcommunity.net` —> redirects correctly and displays the user name
- [ ] Refresh the page —> session is restored without re-login
- [ ] Log out —> session is cleared and the login screen re-appears

**Upload**
- [ ] Upload an image —> preview thumbnail appears on the card
- [ ] Upload a video —> inline video player appears
- [ ] Upload an audio file —> audio player appears
- [ ] Upload a PDF —> embedded viewer appears
- [ ] Upload a file with no title —> prompted to fill in the title, upload stays blocked
- [ ] Upload a second file —> catalog is updated without creating a duplicate profile link
- [ ] Upload the same file twice —> gets rejected to avoid duplicate files
- [ ] Files uploaded to a folder other than `my-solid-app` get their own folder

**Browse & Navigate**
- [ ] From _Pod Content_, navigate into any subfolder using the folder row
- [ ] Use the breadcrumb trail to jump back up
- [ ] System files (`.acl`, `catalog.ttl`, `.shared-*.ttl`) do not appear in the file list

**File Details**
- [ ] Click _Info_ on a file —> all metadata fields are populated correctly
- [ ] Switch language —> metadata labels update accordingly
- [ ] Publisher name resolves to a display name (not a raw WebID URL)

**Download**
- [ ] Download a file —> browser saves it locally without a server redirect

**Delete**
- [ ] Delete a file —> card disappears and catalog is cleaned up; no orphaned container remains on the Pod

**Sharing (requires two accounts)**
- [ ] Add the second account as a contact in the Profile sidebar using their _WebID_
- [ ] Check that their name and avatar photo appear (if they have set one)
- [ ] Click _Request Access_ to see their catalog
- [ ] The second user receives the request on their page —> they can _Deny_ or _Accept_
- [ ] Accept the request —> your catalog content appears in their **Shared with Me** section
- [ ] Deny the request —> they get a denied message in the _Contacts_ part of the sidebar next to your name
- [ ] Request again —> the cycle repeats
- [ ] On an accepted request —> their Pod catalog is shared with you in file format, with numbers on each folder describing how many files it contains
- [ ] Request all or certain desired files —> they receive your request —> they can _Deny_ or _Accept_ per file individually
- [ ] Denied files show a notice next to the file name —> you may request again —> cycle repeats
- [ ] Accepted request —> the **Shared with Me** section updates
- [ ] Share a file directly with others using the Share button on the file card —> no request needed
- [ ] Revoke access —> the file disappears from the second account's **Shared with Me** section
- [ ] The revoked file is no longer accessible via direct URL from the second account

**Language**
- [ ] Switch to German —> all labels update immediately
- [ ] Refresh the page —> German is still active

