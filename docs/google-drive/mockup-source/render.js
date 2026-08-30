/* Shared render helpers: clean file-type icons, fictional users, row builder. */
(function () {
  // ── File-type icons (24px, Google-Drive-ish colour coding) ──────────────
  // Uniform rounded-square ("box") icons: coloured tile + white glyph.
  function box(col, inner) { return '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="4.5" fill="' + col + '"/>' + inner + '</svg>'; }
  var F = {
    doc: box('#4285f4', '<rect x="7" y="9.4" width="10" height="1.7" rx=".8" fill="#fff"/><rect x="7" y="12.6" width="10" height="1.7" rx=".8" fill="#fff"/><rect x="7" y="15.8" width="6.5" height="1.7" rx=".8" fill="#fff"/>'),
    sheet: box('#0f9d58', '<rect x="7" y="8.5" width="10" height="9" rx="1" fill="#fff"/><path fill="#0f9d58" d="M8.2 9.8h3v1.7h-3zM12.8 9.8h3v1.7h-3zM8.2 12.2h3v1.7h-3zM12.8 12.2h3v1.7h-3zM8.2 14.6h3v1.7h-3zM12.8 14.6h3v1.7h-3z"/>'),
    slides: box('#f9ab00', '<rect x="7" y="9" width="10" height="6.5" rx="1.2" fill="#fff"/>'),
    pdf: box('#ea4335', '<text x="12" y="14.6" font-family="Arial,Helvetica,sans-serif" font-size="6" font-weight="700" fill="#fff" text-anchor="middle">PDF</text>'),
    json: box('#f9ab00', '<path fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round" d="M11 8.8c-1.5 0-1.3 2-1.3 2s.2 2-1.3 2c1.5 0 1.3 2 1.3 2s-.2 2 1.3 2M13 8.8c1.5 0 1.3 2 1.3 2s-.2 2 1.3 2c-1.5 0-1.3 2-1.3 2s.2 2-1.3 2"/>'),
    archive: box('#78909c', '<path fill="#fff" d="M11.3 5h1.4v1.5h-1.4zM11.3 8h1.4v1.5h-1.4zM11.3 11h1.4v1.5h-1.4z"/><rect x="10.4" y="13.4" width="3.2" height="4" rx=".6" fill="#fff"/>'),
    generic: box('#90a4ae', '<rect x="7" y="9.4" width="10" height="1.7" rx=".8" fill="#fff"/><rect x="7" y="12.6" width="10" height="1.7" rx=".8" fill="#fff"/><rect x="7" y="15.8" width="6.5" height="1.7" rx=".8" fill="#fff"/>'),
    image: box('#ea4335', '<circle cx="8.6" cy="9.4" r="1.9" fill="#fff"/><path fill="#fff" d="M5.8 17.5l4-5 2.7 3.2 3-3.9 3.4 5.7z"/>'),
    video: box('#ea4335', '<path fill="#fff" d="M10 8.4l6.2 3.6L10 15.6z"/>'),
    audio: box('#a142f4', '<path fill="#fff" d="M15.5 6.5l-5.6 1.4v6.4a2.4 2.4 0 1 1-1.4-2.2V8.7l7-1.7z"/>'),
    rdf: box('#5b57d6', '<g stroke="#fff" stroke-width="1.3"><path d="M8 8l8 8M16 8l-8 8"/></g><circle cx="8" cy="8" r="2" fill="#fff"/><circle cx="16" cy="8" r="2" fill="#fff"/><circle cx="8" cy="16" r="2" fill="#fff"/><circle cx="16" cy="16" r="2" fill="#fff"/><circle cx="12" cy="12" r="2.2" fill="#fff"/>'),
    folder: box('#5b57d6', '<path fill="#fff" d="M7 9.6a1 1 0 0 1 1-1h2.1l1 1.2H16a1 1 0 0 1 1 1v3.8a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1z"/>')
  };
  var EXT = { md:'doc', txt:'doc', doc:'doc', docx:'doc', csv:'sheet', xlsx:'sheet',
    ppt:'slides', pptx:'slides', pdf:'pdf', jpg:'image', jpeg:'image', png:'image',
    gif:'image', webp:'image', mp4:'video', mov:'video', mp3:'audio', wav:'audio',
    zip:'archive', gz:'archive', tar:'archive', ttl:'rdf', rdf:'rdf', nq:'rdf', jsonld:'rdf',
    json:'json' };
  function fileIcon(name) {
    var ext = (name.indexOf('.') > -1) ? name.split('.').pop().toLowerCase() : '';
    return F[EXT[ext] || 'generic'];
  }
  function folderIcon() { return F.folder; }

  // ── Fictional users ─────────────────────────────────────────────────────
  var USERS = {
    'me':   { name: 'Emily Carter',  ini: 'EC', c: 'c1' },
    'theo': { name: 'James Miller',  ini: 'JM', c: 'c2' },
    'nadia':{ name: 'Sarah Johnson', ini: 'SJ', c: 'c3' },
    'ravi': { name: 'David Wilson',  ini: 'DW', c: 'c4' },
    'lena': { name: 'Laura Davis',   ini: 'LD', c: 'c5' },
    'iris': { name: 'Grace Bennett', ini: 'GB', c: 'c6' },
    'omar': { name: 'Michael Brown', ini: 'MB', c: 'c7' },
    'sofia':{ name: 'Olivia Taylor', ini: 'OT', c: 'c8' }
  };
  function ownerCell(key) {
    var u = USERS[key] || USERS.me;
    return '<div class="cell owner"><span class="oav aav ' + u.c + '">' + u.ini + '</span>' + u.name + '</div>';
  }

  // ── Sharing / access glyphs ─────────────────────────────────────────────
  var S = {
    private: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    public:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></svg>',
    shared:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3"/><path d="M2 20a7 7 0 0 1 14 0"/></svg>',
    read:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5c-5 0-9 4-10 7 1 3 5 7 10 7s9-4 10-7c-1-3-5-7-10-7z"/><circle cx="12" cy="12" r="2.5"/></svg>',
    write:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 20h4l10-10-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>',
    myfiles: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>'
  };
  function shareCell(kind, label) { return '<div class="cell share">' + (S[kind] || S.private) + (label || (kind.charAt(0).toUpperCase() + kind.slice(1))) + '</div>'; }

  var SHARED_DOT = '<span class="shared-dot"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="2.4"/><path d="M4 18a5 5 0 0 1 10 0"/></svg></span>';
  var KEBAB = '<button class="kebab"><svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg></button>';

  // ── Row builder ─────────────────────────────────────────────────────────
  // row: { name, folder?, shared?, sel?, cols:[html,html,html] }
  function rowHtml(r) {
    var icon = r.folder ? folderIcon() : fileIcon(r.name);
    var nameCell = '<div class="cell name"><span class="fic">' + icon + '</span>' + r.name + (r.shared ? SHARED_DOT : '') + '</div>';
    return '<div class="row' + (r.sel ? ' selected' : '') + '">' + nameCell + (r.cols || []).join('') + KEBAB + '</div>';
  }
  function renderRows(sel, rows) {
    var el = document.querySelector(sel);
    if (el) el.insertAdjacentHTML('beforeend', rows.map(rowHtml).join(''));
  }

  window.SD = { fileIcon: fileIcon, folderIcon: folderIcon, ownerCell: ownerCell,
                shareCell: shareCell, users: USERS, renderRows: renderRows,
                KEBAB: KEBAB, SHARED_DOT: SHARED_DOT };
})();
