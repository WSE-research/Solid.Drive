/* Shared Solid.drive shell: top strip + sidebar, injected into .app.
   Each page sets data-active (nav key) and optionally data-search="top". */
(function () {
  var app = document.querySelector('.app');
  if (!app) return;
  var active = app.getAttribute('data-active') || '';
  var topSearch = app.getAttribute('data-search') === 'top';

  var I = {
    settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
    bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
    plus: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11 11V5h2v6h6v2h-6v6h-2v-6H5v-2z"/></svg>',
    home: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>',
    myfiles: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
    shared: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="8" r="3"/><path d="M2 20a7 7 0 0 1 14 0"/><circle cx="17" cy="9" r="2.4"/><path d="M16 20a6 6 0 0 1 6-3"/></svg>',
    requests: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 5h18v10H7l-4 4z"/></svg>',
    bin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M9 6V4h6v2M8 6l1 14h6l1-14"/></svg>',
    people: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="3.2"/><path d="M5 20a7 7 0 0 1 14 0"/></svg>'
  };

  function nav(key, label, icon, extra) {
    return '<div class="nav-item' + (active === key ? ' active' : '') + '">' + icon + label + (extra || '') + '</div>';
  }

  var searchHtml = topSearch
    ? '<div class="search">' + I.search + '<input placeholder="Search your Pod"><span class="adv"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M6 12h12M10 18h4"/></svg></span></div>'
    : '<div class="spacer"></div>';

  var top = document.createElement('div');
  top.className = 'top';
  top.innerHTML =
    '<div class="brand"><img src="solid-logo.png" alt=""></div>' +
    searchHtml +
    '<div class="top-actions">' +
      '<button class="icon-btn" title="Settings">' + I.settings + '</button>' +
      '<button class="icon-btn" title="Requests" style="position:relative">' + I.bell +
        '<span style="position:absolute;top:6px;right:6px;width:8px;height:8px;border-radius:999px;background:#5b57d6"></span></button>' +
      '<div class="avatar c1">EC</div>' +
    '</div>';

  var side = document.createElement('nav');
  side.className = 'side';
  side.innerHTML =
    '<button class="new-btn"><span class="plus">' + I.plus + '</span>New</button>' +
    nav('home', 'Home', I.home) +
    nav('myfiles', 'My Files', I.myfiles) +
    nav('shared', 'Shared', I.shared) +
    nav('requests', 'Requests', I.requests, '<span class="badge">2</span>') +
    nav('bin', 'Recycle Bin', I.bin) +
    '<div class="nav-sep"></div>' +
    nav('people', 'People', I.people);

  app.insertBefore(side, app.firstChild);
  app.insertBefore(top, app.firstChild);
})();
