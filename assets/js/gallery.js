/**
 * WooPlans v2 — Gallery
 * Image gallery with arrows, thumbnails, and swipe support
 */
(function() {
  'use strict';
  
  var currentIndex = 0;
  var images = [];
  var galMain, galCounter, galThumbs;
  
  function initGallery() {
    galMain = document.getElementById('gal-main');
    galCounter = document.getElementById('gal-counter');
    galThumbs = document.getElementById('gal-thumbs');
    
    if (!galMain) return;
    
    // Collect all gallery images
    images = Array.from(galMain.querySelectorAll('.gal-img'));
    
    if (images.length === 0) return;
    
    // Set initial image
    currentIndex = 0;
    updateGallery();
    
    // Setup thumbnails
    if (galThumbs) {
      var thumbs = galThumbs.querySelectorAll('.gal-thumb');
      thumbs.forEach(function(thumb, i) {
        thumb.addEventListener('click', function() {
          goToIndex(i);
        });
      });
    }
    
    // Setup swipe
    setupSwipe();
    
    // Setup keyboard nav
    document.addEventListener('keydown', function(e) {
      if (e.key === 'ArrowLeft') galNav(-1);
      if (e.key === 'ArrowRight') galNav(1);
    });
  }
  
  function goToIndex(index) {
    if (index < 0) index = images.length - 1;
    if (index >= images.length) index = 0;
    currentIndex = index;
    updateGallery();
  }
  
  function galNav(dir) {
    goToIndex(currentIndex + dir);
  }
  
  function updateGallery() {
    // Update main image visibility
    images.forEach(function(img, i) {
      img.style.opacity = i === currentIndex ? '1' : '0';
      img.style.position = i === currentIndex ? 'relative' : 'absolute';
    });
    
    // Update counter
    if (galCounter) {
      galCounter.textContent = (currentIndex + 1) + ' / ' + images.length;
    }
    
    // Update active thumbnail
    if (galThumbs) {
      var thumbs = galThumbs.querySelectorAll('.gal-thumb');
      thumbs.forEach(function(thumb, i) {
        thumb.classList.toggle('active', i === currentIndex);
        
        // Scroll into view if needed
        if (i === currentIndex) {
          thumb.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
        }
      });
    }
  }
  
  function setupSwipe() {
    var startX = 0;
    var endX = 0;
    
    if (!galMain) return;
    
    galMain.addEventListener('touchstart', function(e) {
      startX = e.touches[0].clientX;
    }, { passive: true });
    
    galMain.addEventListener('touchend', function(e) {
      endX = e.changedTouches[0].clientX;
      var diff = startX - endX;
      
      if (Math.abs(diff) > 40) {
        if (diff > 0) {
          galNav(1); // Swipe left, next
        } else {
          galNav(-1); // Swipe right, prev
        }
      }
    }, { passive: true });
  }
  
  // Expose globally
  window.galNav = galNav;
  window.goToIndex = goToIndex;
  
  // Init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initGallery);
  } else {
    initGallery();
  }
})();
