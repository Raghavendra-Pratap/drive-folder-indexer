# Drive Folder Indexer

List every file in a Google Drive folder, and every folder inside it, into a Google Sheet in one click.

You get one row per file with:

| Column | What's in it |
|---|---|
| File Name | The file's name |
| File Type | Its type, such as `application/pdf` or `video/mp4` |
| Size (MB) | File size |
| Last Updated | When it last changed |
| Duration (HH:MM:SS) / (Seconds) | Video length, for video files |
| Link | The file's Drive link |
| Full Path | Where it sits, such as `Course/Week 1/lecture.mp4` |
| Sharing | Whether the indexer changed its sharing |

Useful for course libraries, client handovers, media archives, audits ("what's actually in this folder?") and adding up video hours.

It's a small Google Apps Script that lives inside your own spreadsheet. Nothing is sent anywhere else.

---

## Use it

> A one-click "Make a copy" template is coming soon. Until then, setup takes about two minutes.

1. Open a Google Sheet (a new one is fine).
2. Go to **Extensions → Apps Script**.
3. Replace everything in `Code.gs` with the contents of [`src/Code.gs`](src/Code.gs).
4. Turn on the Drive service, using **either** option:
   - Click **Services (+)**, pick **Drive API**, choose version **v3**, then **Add**.
   - Or open **Project Settings ⚙**, tick **Show "appsscript.json" manifest file in editor**, and replace that file with [`src/appsscript.json`](src/appsscript.json).
5. Click **Save**, close the tab and reload your spreadsheet.
6. A **Drive Tools** menu appears. Choose **Drive Tools → Index a folder…** and paste a folder link.

### Sharing is opt-in

After you paste the link, the indexer asks whether to make every file **viewable by anyone with the link**.

- **No** (the default) leaves sharing exactly as it is. The Link column still works for anyone who already has access.
- **Yes** shares each file you're allowed to share. Files you can't change, such as ones shared with you, are skipped and marked in the Sharing column.

Only choose Yes if you really want everything in that folder open to anyone with a link.

### The "Google hasn't verified this app" screen

The first time you run it, Google asks for permission and may show **"Google hasn't verified this app"**. This is normal for a script you added yourself. It runs in your own account, and you can read every line of it above.

To continue, click **Advanced**, then **Go to … (unsafe)**, then **Allow**.

## Permissions it asks for

| Permission | Why |
|---|---|
| See and edit **this** spreadsheet only (`spreadsheets.currentonly`) | To add the new tab with your file list |
| Show menus and dialogs (`script.container.ui`) | For the Drive Tools menu and prompts |
| See and manage your Drive files (`drive`) | To read the folder tree and, only if you choose Yes, change sharing |

## Good to know

- **Big folders.** Google stops any single script run after about 6 minutes. A folder with several thousand files may not finish. If that happens, index its subfolders one at a time.
- **Video length** appears once Drive has finished processing a video. Until then it shows `N/A`.
- **Shared drives** and folders shared with you work too, as long as you can open them.
- **Each run adds a new tab,** named after the folder, so earlier lists are never overwritten.

## For developers

Push the files with [clasp](https://github.com/google/clasp):

```bash
npm i -g @google/clasp
clasp login
clasp create --type sheets --title "Drive Folder Indexer" --rootDir src
clasp push
```

Run the logic tests, which use small stand-ins for Google's services:

```bash
node test/run.js
```

## License

[MIT](LICENSE) © Raghavendra Pratap · Made at BSOC (Building Solutions Out of Curiosity) · [raghav.it](https://raghav.it/work/)
