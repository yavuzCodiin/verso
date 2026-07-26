# Verso

A calm, editorial RSS reader for macOS.

Feeds and newsletters live in a SQLite database on your own machine — no
account, no server, nothing to sign into. Verso reads IMAP mailboxes directly,
so paid newsletters (whose full text only ever arrives by email) sit alongside
your feeds.

**This repository is the release channel.** Downloads and automatic updates are
served from here; the source is not published.

## Install

Grab the `.dmg` from [Releases](../../releases/latest) and drag Verso to
Applications.

The app is signed but not notarised, so macOS will refuse the first launch.
Clear the quarantine flag once:

```
xattr -dr com.apple.quarantine /Applications/Verso.app
```

After that it opens normally, and updates arrive in-app — they're
cryptographically signed and verified before installing.

Requires macOS on Apple Silicon.
