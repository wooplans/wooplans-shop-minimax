/**
 * WooPlans v2 — Filters
 * Toggles plan card visibility by type (villa/duplex)
 */
(function() {
  'use strict';
  
  function filterPlans(type, btn) {
    var grid = document.getElementById('plans-grid');
    if (!grid) return;
    
    var cards = grid.querySelectorAll('.plan-card');
    var buttons = document.querySelectorAll('.f-btn');
    
    // Update active button
    buttons.forEach(function(b) { b.classList.remove('active'); });
    if (btn) btn.classList.add('active');
    
    // Show/hide cards
    cards.forEach(function(card) {
      var cardType = card.getAttribute('data-type');
      if (type === 'all' || cardType === type) {
        card.style.display = '';
      } else {
        card.style.display = 'none';
      }
    });
  }
  
  // Expose globally for onclick handlers
  window.filterPlans = filterPlans;
  
  // Initialize nav scroll behavior
  (function() {
    var nav = document.getElementById('nav');
    if (!nav) return;
    
    var scrollTimer;
    window.addEventListener('scroll', function() {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(function() {
        nav.classList.toggle('scrolled', window.scrollY > 20);
      }, 10);
    }, { passive: true });
  })();
})();
