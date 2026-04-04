/**
 * WooPlans v2 — Turbo Nav
 * Prefetch on hover, soft navigation on click
 */
(function() {
  'use strict';
  
  var prefetched = new Set();
  var prefetchTimer = null;
  var PREFETCH_DELAY = 100;
  
  // Prefetch a page
  function prefetchPage(href) {
    if (prefetched.has(href) || !('IntersectionObserver' in window)) return;
    prefetched.add(href);
    
    var link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = href;
    document.head.appendChild(link);
    
    // Also prefetch the main image if available
    var card = document.querySelector('[href="' + href + '"]');
    if (card) {
      var img = card.querySelector('img');
      if (img && img.src) {
        var preloadImg = new Image();
        preloadImg.src = img.src;
      }
    }
  }
  
  // Soft navigate to a page
  function softNavigate(href, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', href, true);
    xhr.responseType = 'document';
    
    xhr.onload = function() {
      if (xhr.status !== 200) {
        window.location.href = href;
        return;
      }
      
      var doc = xhr.responseXML;
      var main = doc.querySelector('main');
      
      if (!main) {
        window.location.href = href;
        return;
      }
      
      // Update page content
      var currentMain = document.querySelector('main');
      if (currentMain) {
        currentMain.innerHTML = main.innerHTML;
      }
      
      // Update URL
      history.pushState({}, '', href);
      
      // Scroll to top
      window.scrollTo(0, 0);
      
      // Re-initialize page-specific scripts
      if (callback) callback();
      
      // Fire analytics
      if (window.trackPageView) {
        window.trackPageView(href);
      }
    };
    
    xhr.onerror = function() {
      window.location.href = href;
    };
    
    xhr.send();
  }
  
  // Setup event listeners
  function init() {
    // On link hover/touchstart - prefetch
    document.addEventListener('mouseover', function(e) {
      var link = e.target.closest('a');
      if (!link) return;
      
      var href = link.getAttribute('href');
      if (!href || !href.startsWith('/') || href.startsWith('//')) return;
      
      clearTimeout(prefetchTimer);
      prefetchTimer = setTimeout(function() {
        if (link.matches(':hover')) {
          prefetchPage(href);
        }
      }, PREFETCH_DELAY);
    }, { passive: true });
    
    document.addEventListener('mouseout', function(e) {
      clearTimeout(prefetchTimer);
    }, { passive: true });
    
    // On link click - soft navigate for same-origin links
    document.addEventListener('click', function(e) {
      var link = e.target.closest('a');
      if (!link) return;
      
      var href = link.getAttribute('href');
      if (!href || !href.startsWith('/') || href.startsWith('//')) return;
      
      // Skip modifier keys (open in new tab)
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      
      // Skip hash links
      if (href.startsWith('#')) return;
      
      // Skip form elements
      if (link.tagName === 'BUTTON' || link.tagName === 'INPUT') return;
      
      e.preventDefault();
      softNavigate(href);
    });
    
    // Handle browser back/forward
    window.addEventListener('popstate', function() {
      window.location.reload();
    });
  }
  
  // Expose globally
  window.softNavigate = softNavigate;
  
  // Auto-init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
