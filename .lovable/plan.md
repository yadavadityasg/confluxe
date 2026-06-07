## Goal

Upgrade the global search so it looks inside page body text (not just titles), counts how many times the query word appears, and ranks results so pages with more matches appear first. Results show the full breadcrumb: `Space › Parent page › Page (N matches)`.

## Match priority (highest → lowest)

1. **Space name** matches the query
2. **Page title** matches the query
3. **Page content** contains the query — ranked by occurrence count (more matches first)

Within group 3, ties are broken by most recently updated.

## What changes

### 1. `searchAll` server function (`src/lib/wiki.functions.ts`)

Rewrite to:
- Fetch matching spaces by name/key (small list, cheap).
- Fetch all pages in spaces the user can see (`id, space_id, parent_id, title, content, updated_at`).
- In JS, walk each page's TipTap JSON `content` to extract plain text, then count case-insensitive whole-word-ish occurrences of the query.
- Return three buckets:
  - `spaces`: name/key matches
  - `titlePages`: pages whose title matches (with breadcrumb + match count in body too)
  - `contentPages`: pages whose body matches, sorted by count desc, then `updated_at` desc
- Each page result includes: `id`, `space_id`, `space_name`, `space_icon`, `parent_titles[]` (ancestor chain up to root), `title`, `count`, `snippet` (≈140-char excerpt around the first match with the word highlighted server-side as plain text — UI bolds it).
- Cap at 50 content matches to stay snappy.

Helper added: `extractText(node)` recursively concatenates `text` fields from TipTap JSON, inserting spaces at block boundaries.

### 2. Search UI (`src/routes/_authenticated/search.tsx`)

- Render three sections in order: **Spaces**, **Title matches**, **In page content**.
- Each page row shows the breadcrumb `📘 Space name › Parent › Page title` and a right-aligned badge `N matches`.
- Below the title, show the snippet with the matched word bolded.
- Empty/loading states unchanged.

### 3. No DB migration

Pure server-side computation over existing `pages.content` JSONB. RLS already scopes `pages` to authenticated users, so no policy changes.

## Out of scope

- Postgres full-text indexes / `tsvector` (can add later if dataset grows; current scale fits in-memory scan).
- Fuzzy matching, stemming, multi-word phrase ranking — query is treated as a single token, case-insensitive substring.
- Highlighting every occurrence inside the snippet (only the first is bolded).
