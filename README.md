# dialectinstitute.org

The Dialect Institute site: a hanging curtain of text with a few words hidden in it.

Based on "Strings" by Liam Egan (https://codepen.io/shubniggurath/pen/ZYpjorm), MIT License — see LICENSE.txt.

- `index.html`, `script.js`, `style.css` — the site

## Handoff

This is a placeholder site, built to be easy to move. Everything that exists:

- **Code**: this repo — three static files (`index.html`, `script.js`, `style.css`), no build step, no dependencies. Drop them on any static host.
- **Hosting**: GitHub Pages from `main` at the repo root. `CNAME` holds the custom domain.
- **Domain**: `dialectinstitute.org` is registered and DNS-managed in Brock's Cloudflare account. Records: 4× A `@` → GitHub Pages IPs (185.199.108–111.153), CNAME `www` → `brockhuman.github.io`, all DNS-only (not proxied). `dialectguild.org` is also in that account, with no records.

To give access: add a collaborator to this repo, or transfer the repo to another account/org (then update the `www` CNAME to `<new-owner>.github.io`). To move the domain: invite to Cloudflare, or repoint its DNS at another host — only the records above need to change.
