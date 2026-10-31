/**
 * Drive Folder Indexer
 * Lists every file in a Google Drive folder and all of its subfolders into a new tab
 * of the current spreadsheet: name, type, size, last updated, video length, link and full path.
 *
 * https://github.com/Raghavendra-Pratap/drive-folder-indexer
 * MIT License · Raghavendra Pratap (BSOC)
 */

var HEADERS = ['File Name', 'File Type', 'Size (MB)', 'Last Updated', 'Duration (HH:MM:SS)', 'Duration (Seconds)', 'Link', 'Full Path', 'Sharing'];

/** Adds the "Drive Tools" menu when the spreadsheet opens. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Drive Tools')
    .addItem('Index a folder…', 'showFolderDialog')
    .addToUi();
}

/** Asks for the folder link, then whether to change sharing. */
function showFolderDialog() {
  var ui = SpreadsheetApp.getUi();
  var result = ui.prompt('Index a folder', 'Paste the Google Drive folder link:', ui.ButtonSet.OK_CANCEL);
  if (result.getSelectedButton() !== ui.Button.OK) return;

  var folderLink = String(result.getResponseText() || '').trim();
  if (!folderLink) {
    ui.alert('Please paste a folder link.');
    return;
  }

  // Sharing is opt-in. "No" (the default) leaves every file's sharing exactly as it is.
  var share = ui.alert(
    'Make files viewable by link?',
    'Do you want to make EVERY file in this folder viewable by anyone with the link?\n\n' +
      'Choose "No" to leave sharing unchanged. The Link column still works for people who already have access.',
    ui.ButtonSet.YES_NO
  );

  indexFolder(folderLink, { shareByLink: share === ui.Button.YES });
}

/**
 * Indexes a folder into a new sheet.
 * @param {string} folderLink A Drive folder URL or bare folder ID.
 * @param {{shareByLink: boolean}} options
 */
function indexFolder(folderLink, options) {
  var ui = SpreadsheetApp.getUi();
  var folderId = extractFolderId(folderLink);
  if (!folderId) {
    ui.alert('That doesn’t look like a Drive folder link. Copy the link from the folder’s Share menu and try again.');
    return;
  }

  try {
    var root = DriveApp.getFolderById(folderId);
    var rootName = root.getName();
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.insertSheet(uniqueSheetName(ss, rootName.substring(0, 20) + ' (' + folderId.substring(0, 4) + ')'));

    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setBackground('#4a86e8').setFontColor('white').setFontWeight('bold');
    sheet.setFrozenRows(1);

    var rows = [];
    var stats = { shared: 0, skipped: 0 };
    walkFolder(root, rootName, rows, options || {}, stats);

    // Write everything in one batch, which is much faster than a row at a time.
    if (rows.length) sheet.getRange(2, 1, rows.length, HEADERS.length).setValues(rows);
    sheet.autoResizeColumns(1, HEADERS.length);

    var msg = 'Done. Indexed ' + rows.length + ' file' + (rows.length === 1 ? '' : 's') + ' into "' + sheet.getName() + '".';
    if (options && options.shareByLink) {
      msg += '\n\nShared by link: ' + stats.shared + '.';
      if (stats.skipped) msg += ' Not changed (no permission to share): ' + stats.skipped + '.';
    }
    ui.alert(msg);
  } catch (e) {
    ui.alert('Something went wrong: ' + e.message);
  }
}

/** Pulls the folder ID out of a Drive link (or accepts a bare ID). */
function extractFolderId(link) {
  var m = String(link || '').match(/folders\/([-\w]{20,})/) || String(link || '').match(/[-\w]{25,}/);
  return m ? (m[1] || m[0]) : null;
}

/** Returns a sheet name that doesn't clash with an existing tab. */
function uniqueSheetName(ss, base) {
  var name = base;
  for (var n = 2; ss.getSheetByName(name); n++) name = base + ' ' + n;
  return name;
}

/** Walks a folder and its subfolders, adding one row per file. */
function walkFolder(folder, path, rows, options, stats) {
  var files = folder.getFiles();
  while (files.hasNext()) {
    var file = files.next();
    var name = file.getName();
    var mime = file.getMimeType();

    var sharing = 'Unchanged';
    if (options.shareByLink) {
      try {
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        sharing = 'Anyone with link (view)';
        stats.shared++;
      } catch (e) {
        sharing = 'Not changed (no permission)';
        stats.skipped++;
      }
    }

    var duration = mime.indexOf('video/') === 0 ? videoDuration(file.getId()) : null;
    rows.push([
      name,
      mime,
      Math.round((file.getSize() / 1048576) * 100) / 100,
      file.getLastUpdated(),
      duration ? duration.hhmmss : 'N/A',
      duration ? duration.seconds : 'N/A',
      file.getUrl(),
      path + '/' + name,
      sharing,
    ]);
  }

  var subfolders = folder.getFolders();
  while (subfolders.hasNext()) {
    var sub = subfolders.next();
    walkFolder(sub, path + '/' + sub.getName(), rows, options, stats);
  }
}

/**
 * Reads a video's length with the Advanced Drive service (v3).
 * Returns null when Drive hasn't processed the video yet or the call fails.
 */
function videoDuration(fileId) {
  try {
    var meta = Drive.Files.get(fileId, { fields: 'videoMediaMetadata' });
    var ms = meta.videoMediaMetadata && Number(meta.videoMediaMetadata.durationMillis);
    if (!ms) return null;
    var pad = function (n) { return (n < 10 ? '0' : '') + n; };
    var h = Math.floor(ms / 3600000);
    var m = Math.floor((ms % 3600000) / 60000);
    var s = Math.floor((ms % 60000) / 1000);
    // The leading apostrophe keeps Sheets from turning "01:02:03" into a time of day.
    return { hhmmss: "'" + pad(h) + ':' + pad(m) + ':' + pad(s), seconds: Math.round(ms / 1000) };
  } catch (e) {
    return null;
  }
}
