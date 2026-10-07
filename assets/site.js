(function () {
  var q = document.getElementById('siteSearch'), r = document.getElementById('searchResults');
  if (!q || !r) return;
  var items = null;
  function render(list) {
    r.textContent = '';
    list.forEach(function (x) {
      var d = document.createElement('div'); d.className = 'result';
      var a = document.createElement('a'); a.href = x.url;
      var s = document.createElement('strong'); s.textContent = x.title; a.appendChild(s);
      var p = document.createElement('div'); p.className = 'muted'; p.textContent = x.description;
      d.appendChild(a); d.appendChild(p); r.appendChild(d);
    });
    if (!list.length && q.value.trim()) r.textContent = 'No guides found. Try "plug", "250mm" or "speed".';
  }
  function run() {
    var terms = q.value.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!terms.length) { r.textContent = ''; return; }
    var hits = items.filter(function (x) {
      var hay = (x.title + ' ' + x.description + ' ' + (x.keywords || []).join(' ')).toLowerCase();
      return terms.every(function (t) { return hay.indexOf(t) !== -1; });
    });
    render(hits.slice(0, 8));
  }
  q.addEventListener('input', function () {
    if (items) return run();
    fetch('/search-index.json').then(function (x) { return x.json(); }).then(function (d) { items = d; run(); });
  });
})();
