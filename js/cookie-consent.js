// Cookie Consent Manager
(function() {
  'use strict';

  const COOKIE_NAME = 'hd_tracking_consent';
  const COOKIE_EXPIRY_DAYS = 365;

  // Check if consent has been given
  function hasConsent() {
    const consent = getCookie(COOKIE_NAME);
    return consent === 'accepted';
  }

  // Check if consent has been declined
  function hasDeclined() {
    const consent = getCookie(COOKIE_NAME);
    return consent === 'declined';
  }

  // Get cookie value
  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }

  // Set cookie
  function setCookie(name, value, days) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = `expires=${date.toUTCString()}`;
    document.cookie = `${name}=${value};${expires};path=/;SameSite=Lax`;
  }

  // Show cookie banner
  function showBanner() {
    const banner = document.getElementById('cookie-banner');
    if (banner) {
      banner.classList.add('show');
    }
  }

  // Hide cookie banner
  function hideBanner() {
    const banner = document.getElementById('cookie-banner');
    if (banner) {
      banner.classList.remove('show');
    }
  }

  // Accept cookies
  function acceptCookies() {
    setCookie(COOKIE_NAME, 'accepted', COOKIE_EXPIRY_DAYS);
    hideBanner();
    // Trigger tracking initialization
    if (window.initPageViewTracking) {
      window.initPageViewTracking();
    }
  }

  // Decline cookies
  function declineCookies() {
    setCookie(COOKIE_NAME, 'declined', COOKIE_EXPIRY_DAYS);
    hideBanner();
  }

  // Initialize on page load
  function init() {
    // Check if user has already made a choice
    if (!hasConsent() && !hasDeclined()) {
      showBanner();
    } else if (hasConsent()) {
      // User has consented, initialize tracking
      if (window.initPageViewTracking) {
        window.initPageViewTracking();
      }
    }

    // Setup button handlers
    const acceptBtn = document.getElementById('cookie-accept');
    const rejectBtn = document.getElementById('cookie-reject');

    if (acceptBtn) {
      acceptBtn.addEventListener('click', acceptCookies);
    }

    if (rejectBtn) {
      rejectBtn.addEventListener('click', declineCookies);
    }
  }

  // Export functions for use by tracking scripts
  window.cookieConsent = {
    hasConsent: hasConsent,
    hasDeclined: hasDeclined,
    acceptCookies: acceptCookies,
    declineCookies: declineCookies
  };

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
