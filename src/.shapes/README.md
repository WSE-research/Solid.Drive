# ShEx Shapes

These are the source of truth for every data model in this app. Think of them as a contract, they describe exactly what a valid resource looks like on the Pod before any component is allowed to use it.

Each `.shex` file here generates the four files in [`src/.ldo/`](../.ldo/). 

**Edit here, never there.**

---

**`post.shex`**: a file (document, image, or any digital asset) using the `schema.org` vocabulary.

- `uploadDate` and `publisher` (the owner's WebID) are required
- `name`, `description`, `encodingFormat` (MIME type), `contentSize`, `dateModified`, `isPartOf` (parent folder), and `sharedWith` are optional

**`solidProfile.shex`**: the minimum the app needs from a user's WebID profile.

- `EXTRA a` means it accepts any profile type, as long as the required fields are there
- `sp:storage` is how the app finds where to write posts on the Pod

---

After editing a shape, run `npm run build:ldo` to regenerate [`src/.ldo/`](../.ldo/).
