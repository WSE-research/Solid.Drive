# ShEx Shapes

Each `.shex` file in this folder defines a data contract for one type of resource stored on the Pod. The contract specifies which RDF properties a resource must have (`rdf:type`, required fields) and which are optional, along with the exact datatype for each.

LDO reads these files and generates TypeScript interfaces, validators, and shape type objects in `src/.ldo/`. Those generated files are what the React components import to read and write Pod data in a type-safe way.

**Edit `.shex` files here. Never edit `src/.ldo/` directly.** Run `npm run build:ldo` to regenerate after any change.

### `catalogEntry.shex`

Defines the structure of an ABox instance — the metadata document (`index.ttl`) written inside each uploaded file's container.

**Required fields** — the upload is rejected if either is missing:

| Field | Type | Reason required |
|---|---|---|
| `schema:uploadDate` | `xsd:dateTime` | Every file must have a creation timestamp so the catalog can be sorted and audited |
| `schema:publisher` | IRI (WebID) | Every file must be traceable to the Pod owner who uploaded it |

**`rdf:type`** must be exactly one of:

| Value | Meaning |
|---|---|
| `schema:DigitalDocument` | Base class — used when the MIME type does not match any more specific class |
| `app:ImageFile` | MIME type starts with `image/` |
| `app:VideoFile` | MIME type starts with `video/` |
| `app:AudioFile` | MIME type starts with `audio/` |
| `app:TextDocument` | MIME type is `text/*`, `application/pdf`, or `application/msword` |

These classes are defined in `tbox.ttl` on the Pod (written by `ensureTBox` in `catalog.ts`).

**Optional fields:**

| Field | Type |
|---|---|
| `schema:name` | `xsd:string` |
| `schema:description` | `xsd:string` |
| `schema:encodingFormat` | `xsd:string` |
| `schema:contentSize` | `xsd:string` |
| `schema:dateModified` | `xsd:dateTime` |
| `schema:isPartOf` | IRI |
| `schema:sharedWith` | IRI |
| `dcterms:conformsTo` | IRI |

---

### `solidProfile.shex`

Defines the minimum fields the app reads from a user's WebID profile document.

| Field | Purpose |
|---|---|
| `sp:storage` | The root URI of the user's Pod — used to construct the path for `tbox.ttl`, `catalog.ttl`, and `my-solid-app/` |

`EXTRA a` is set so the shape accepts any profile `rdf:type`, not just a specific one. This is necessary because different Solid servers use different type URIs for profile documents, and the app only cares about the storage location, not the profile type.
