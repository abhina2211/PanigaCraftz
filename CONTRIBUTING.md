# How work gets done on PanigaCraftz

## Branches, one at a time

- `main` is what is live. Only `development` is merged into it, when Abhi decides to go live.
- `development` holds finished features waiting to go live.
- Each piece of work gets its own `feature/<short-name>` branch, **taken from the latest `development`**.
- **Start a new feature branch only after the previous one is merged into `development`.** Branches are not stacked on top of each other. If a new idea comes up while a branch is open, write it in `docs/requirements.md` and start it after the merge.

## Definition of done

A feature branch is done, and can be merged into `development`, when every line below is true. Copy this list into the pull request and tick it.

- [ ] **Builds**: `npm run build` finishes without errors.
- [ ] **Tests pass**: `npm test` shows `fail 0`. New business rules or database changes come with new tests.
- [ ] **Checked by hand**: the changed pages were tried in `npm run dev`. For anything in the admin panel, also tried on a phone (or the browser's phone view), since Neha uses it on her phone.
- [ ] **Checked against the real Supabase** when the site's or admin's database requests changed (harmless reads, or an update aimed at an id that doesn't exist), because the in-memory test database doesn't behave exactly like Supabase.
- [ ] **Database changes applied and written down**: any new `supabase/*.sql` file is listed in `README.md` with when to run it and in what order, and has been run in the Supabase SQL editor. Running it twice must be safe.
- [ ] **Branch log updated**: `docs/branch-log.md` has a row for the branch (date, component, what it changes), and the merge commit once merged.
- [ ] **Requirements updated**: `docs/requirements.md` has the new or changed requirements, a raised version number and a change log line.
- [ ] **No secrets**: no `.env` file, Supabase keys (anon or `service_role`), passwords or tokens in the commits. Only `.env.example`, with empty values, is committed.
- [ ] **Pushed and reviewed**: the branch is pushed, a pull request into `development` is open, and Abhi has read the changes and approved it.

When it is merged, delete the feature branch (on GitHub and locally) so the list of branches only shows work in progress.
