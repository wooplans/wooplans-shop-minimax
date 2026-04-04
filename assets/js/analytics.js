/**
 * WooPlans v2 — Analytics
 * Facebook Pixel + Microsoft Clarity
 */
(function() {
  'use strict';
  
  var FB_PIXEL_ID = '1651374605332302';
  var CLARITY_ID = 'vxek9swtox';
  
  // Facebook Pixel
  function initFB() {
    if (window.fbq) return;
    
    /* eslint-disable */
    !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
    /* eslint-enable */
    
    fbq('init', FB_PIXEL_ID);
    fbq('track', 'PageView');
  }
  
  // Microsoft Clarity
  function initClarity() {
    (function(c,l,a,r,i,t,y){
      c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
      t=l.createElement(r);
      t.async=1;
      t.src="https://www.clarity.ms/tag/"+i;
      y=l.getElementsByTagName(r)[0];
      y.parentNode.insertBefore(t,y);
    })(window,document,"clarity","script",CLARITY_ID);
  }
  
  // Track ViewContent on plan pages
  function trackViewContent(planData) {
    if (!window.fbq) return;
    
    var price = 0;
    if (planData && planData.price) {
      price = parseInt(String(planData.price).replace(/\s/g, '')) || 0;
    }
    
    fbq('track', 'ViewContent', {
      content_name: planData ? planData.title : '',
      content_type: 'product',
      content_ids: planData ? [planData.id] : [],
      value: price,
      currency: 'XAF'
    });
  }
  
  // Track PageView
  function trackPageView(url) {
    if (window.fbq) {
      fbq('track', 'PageView');
    }
  }
  
  // Expose globally
  window.trackViewContent = trackViewContent;
  window.trackPageView = trackPageView;
  
  // Init
  function init() {
    initFB();
    initClarity();
    
    // Track plan view if on a plan page
    if (window.planData) {
      setTimeout(function() {
        trackViewContent(window.planData);
      }, 1000);
    }
  }
  
  // Use requestIdleCallback if available for non-blocking init
  var initFn = function() { init(); };
  if ('requestIdleCallback' in window) {
    requestIdleCallback(initFn, { timeout: 3000 });
  } else {
    setTimeout(initFn, 1);
  }
})();
