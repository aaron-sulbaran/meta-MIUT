/* Line icons for the closing decks, drawn for them (not brand marks), on a 24 x 24 grid.
   Pick one by name in a deck's content.json. */
(function () {
  "use strict";
  const wrap = (body) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
  window.DeckIcons = {
    glasses: wrap('<path d="M2 10.5h20"/><rect x="2.8" y="9.5" width="7.6" height="6" rx="2.6"/><rect x="13.6" y="9.5" width="7.6" height="6" rx="2.6"/><path d="M10.4 11.4c1-.7 2.2-.7 3.2 0"/><path d="M2.8 10.5 1.6 7.6M21.2 10.5l1.2-2.9"/>'),
    city: wrap('<path d="M3 21h18"/><path d="M5 21V10l4-2v13"/><path d="M9 21V4h6v17"/><path d="M15 21v-9h4v9"/><path d="M11.5 7.5h1M11.5 10.5h1M11.5 13.5h1M11.5 16.5h1"/>'),
    megaphone: wrap('<path d="M3.5 10v4a1.5 1.5 0 0 0 1.5 1.5h2l8 4.5V4L7 8.5H5A1.5 1.5 0 0 0 3.5 10Z"/><path d="M8 15.5 9.5 20"/><path d="M18.5 9.5a3.5 3.5 0 0 1 0 5"/>'),
    "instagram-to-facebook": wrap('<rect x="2" y="7" width="8" height="8" rx="2.4"/><circle cx="6" cy="11" r="1.8"/><rect x="14" y="7" width="8" height="8" rx="2.4"/><path d="M18.6 9.6h-.8a1 1 0 0 0-1 1v4.4M16.2 12h2.4"/><path d="M10.8 11h2.4M12.2 9.8l1 1.2-1 1.2"/>'),
    lock: wrap('<rect x="4.5" y="10.5" width="15" height="10" rx="2.5"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/><path d="M12 14.5v2.5"/>'),
    calendar: wrap('<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 9.5h17M8 3v4M16 3v4"/><path d="M8 13.5h.01M12 13.5h.01M16 13.5h.01M8 17h.01M12 17h.01"/>'),
    ticket: wrap('<path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2.5a2 2 0 0 0 0 3V16a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2.5a2 2 0 0 0 0-3Z"/><path d="M14.5 6.5v11" stroke-dasharray="1.6 1.8"/>'),
    people: wrap('<circle cx="9" cy="8.5" r="3.2"/><path d="M3 19.5c.6-3.3 3-5.3 6-5.3s5.4 2 6 5.3"/><circle cx="17" cy="9.5" r="2.5"/><path d="M16.2 14.4c2.5 0 4.3 1.6 4.8 4.4"/>'),
    "map-pin": wrap('<path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11Z"/><circle cx="12" cy="10" r="2.4"/>'),
    sparkle: wrap('<path d="M12 3.5 13.8 9a2 2 0 0 0 1.2 1.2l5.5 1.8-5.5 1.8a2 2 0 0 0-1.2 1.2L12 20.5 10.2 15A2 2 0 0 0 9 13.8L3.5 12 9 10.2A2 2 0 0 0 10.2 9Z"/>'),
    person: wrap('<circle cx="12" cy="8" r="3.6"/><path d="M5 20c.7-3.8 3.5-6 7-6s6.3 2.2 7 6"/>'),
    code: wrap('<path d="M8.5 7 3.5 12l5 5M15.5 7l5 5-5 5"/>'),
    grid: wrap('<rect x="4" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6"/>'),
    check: wrap('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
    arrow: wrap('<path d="M4 12h15M14 6.5l5.5 5.5-5.5 5.5"/>'),
  };
})();
