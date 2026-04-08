// Checkout Modal Logic

const CHECKOUT_API = 'https://xlmwzvkqjnojdldzrol.supabase.co/functions/v1/chariow-checkout';

// Country data with phone codes
const COUNTRIES = [
  { code: 'CM', name: 'Cameroun', dial: '+237', flag: '🇨🇲' },
  { code: 'CI', name: "Côte d'Ivoire", dial: '+225', flag: '🇨🇮' },
  { code: 'SN', name: 'Sénégal', dial: '+221', flag: '🇸🇳' },
  { code: 'FR', name: 'France', dial: '+33', flag: '🇫🇷' },
  { code: 'BE', name: 'Belgique', dial: '+32', flag: '🇧🇪' },
  { code: 'CA', name: 'Canada', dial: '+1', flag: '🇨🇦' },
  { code: 'US', name: 'États-Unis', dial: '+1', flag: '🇺🇸' },
  { code: 'GA', name: 'Gabon', dial: '+241', flag: '🇬🇦' },
  { code: 'CG', name: 'Congo', dial: '+242', flag: '🇨🇬' },
  { code: 'CD', name: 'RD Congo', dial: '+243', flag: '🇨🇩' },
  { code: 'ML', name: 'Mali', dial: '+223', flag: '🇲🇱' },
  { code: 'BF', name: 'Burkina Faso', dial: '+226', flag: '🇧🇫' },
  { code: 'NE', name: 'Niger', dial: '+227', flag: '🇳🇪' },
  { code: 'TG', name: 'Togo', dial: '+228', flag: '🇹🇬' },
  { code: 'BJ', name: 'Bénin', dial: '+229', flag: '🇧🇯' },
  { code: 'GH', name: 'Ghana', dial: '+233', flag: '🇬🇭' },
  { code: 'NG', name: 'Nigeria', dial: '+234', flag: '🇳🇬' },
  { code: 'CF', name: 'Centrafrique', dial: '+236', flag: '🇨🇫' },
  { code: 'TD', name: 'Tchad', dial: '+235', flag: '🇹🇩' },
  { code: 'MA', name: 'Maroc', dial: '+212', flag: '🇲🇦' },
  { code: 'DZ', name: 'Algérie', dial: '+213', flag: '🇩🇿' },
  { code: 'TN', name: 'Tunisie', dial: '+216', flag: '🇹🇳' },
];

let currentPlan = null;
let selectedCountry = COUNTRIES[0]; // Default: Cameroon

function initCheckout() {
  const modal = getOrCreateModal();
  const overlay = document.getElementById('checkout-overlay');
  
  // Close on overlay click
  if (overlay) {
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) closeModal();
    });
  }

  // Country selector
  const countrySelect = document.getElementById('checkout-country');
  if (countrySelect) {
    // Populate country options
    COUNTRIES.forEach((country, index) => {
      const option = document.createElement('option');
      option.value = country.dial;
      option.textContent = `${country.flag} ${country.dial} ${country.name}`;
      option.dataset.code = country.code;
      countrySelect.appendChild(option);
    });

    // Detect user country via IP
    detectCountry().then(country => {
      if (country) {
        const dialCode = country.dial;
        countrySelect.value = dialCode;
        selectedCountry = country;
      }
    });

    countrySelect.addEventListener('change', (e) => {
      const dial = e.target.value;
      selectedCountry = COUNTRIES.find(c => c.dial === dial) || COUNTRIES[0];
    });
  }

  // Form submission
  const form = document.getElementById('checkout-form');
  if (form) {
    form.addEventListener('submit', handleCheckout);
  }
}

async function detectCountry() {
  try {
    const response = await fetch('https://ipapi.co/json/');
    const data = await response.json();
    const countryCode = data.country_code;
    return COUNTRIES.find(c => c.code === countryCode) || COUNTRIES[0];
  } catch {
    return COUNTRIES[0];
  }
}

function openCheckoutModal(planData) {
  currentPlan = planData;
  const modal = getOrCreateModal();
  const overlay = document.getElementById('checkout-overlay');
  
  if (modal && overlay) {
    // Reset form
    document.getElementById('checkout-form').reset();
    document.getElementById('checkout-error').textContent = '';
    document.getElementById('checkout-submit-btn').disabled = false;
    document.getElementById('checkout-submit-btn').textContent = 'Continuer vers le paiement';

    // Set product info
    document.getElementById('checkout-plan-name').textContent = planData.title;
    document.getElementById('checkout-plan-price').textContent = formatPrice(planData.price);

    modal.classList.add('active');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal() {
  const modal = document.getElementById('checkout-modal');
  const overlay = document.getElementById('checkout-overlay');
  
  if (modal && overlay) {
    modal.classList.remove('active');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }
}

async function handleCheckout(e) {
  e.preventDefault();
  
  const submitBtn = document.getElementById('checkout-submit-btn');
  const errorDiv = document.getElementById('checkout-error');
  
  if (!currentPlan) {
    errorDiv.textContent = 'Erreur: données du plan manquantes';
    return;
  }

  // Get form values
  const email = document.getElementById('checkout-email').value.trim();
  const firstName = document.getElementById('checkout-firstname').value.trim();
  const lastName = document.getElementById('checkout-lastname').value.trim();
  const phoneNumber = document.getElementById('checkout-phone').value.trim();
  const dialCode = document.getElementById('checkout-country').value;

  // Validate
  if (!email || !firstName || !lastName || !phoneNumber) {
    errorDiv.textContent = 'Veuillez remplir tous les champs';
    return;
  }

  if (!isValidEmail(email)) {
    errorDiv.textContent = 'Veuillez entrer une adresse email valide';
    return;
  }

  // Disable button during request
  submitBtn.disabled = true;
  submitBtn.textContent = 'Redirection...';
  errorDiv.textContent = '';

  try {
    const response = await fetch(CHECKOUT_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        product_id: currentPlan.chariowProductId,
        email,
        first_name: firstName,
        last_name: lastName,
        phone: {
          number: phoneNumber.replace(/\s+/g, ''),
          country_code: dialCode.replace('+', ''),
        },
        plan_id: currentPlan.id,
        plan_slug: currentPlan.slug,
        plan_title: currentPlan.title,
        redirect_url: `https://shop.wooplans.com/merci?plan=${currentPlan.slug}`,
      }),
    });

    const data = await response.json();

    if (data.checkout_url) {
      // Redirect to Chariow checkout
      window.location.href = data.checkout_url;
    } else if (data.error) {
      errorDiv.textContent = data.error === 'already_purchased' 
        ? 'Vous avez déjà acheté ce plan'
        : (data.message || data.error);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Continuer vers le paiement';
    } else {
      errorDiv.textContent = 'Une erreur est survenue. Veuillez réessayer.';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Continuer vers le paiement';
    }
  } catch (error) {
    console.error('Checkout error:', error);
    errorDiv.textContent = 'Erreur de connexion. Veuillez réessayer.';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Continuer vers le paiement';
  }
}

function getOrCreateModal() {
  let modal = document.getElementById('checkout-modal');
  
  if (!modal) {
    const modalHTML = `
      <div id="checkout-overlay"></div>
      <div id="checkout-modal">
        <div class="checkout-modal-inner">
          <button class="checkout-modal-close" onclick="closeModal()" aria-label="Fermer">
            <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
          
          <div class="checkout-header">
            <h2>Finaliser votre commande</h2>
            <div class="checkout-plan-info">
              <span id="checkout-plan-name">Plan</span>
              <span id="checkout-plan-price">14 900 FCFA</span>
            </div>
          </div>

          <form id="checkout-form">
            <div class="checkout-field">
              <label for="checkout-email">Email *</label>
              <input type="email" id="checkout-email" placeholder="votre@email.com" required>
            </div>

            <div class="checkout-row">
              <div class="checkout-field">
                <label for="checkout-firstname">Prénom *</label>
                <input type="text" id="checkout-firstname" placeholder="Jean" required>
              </div>
              <div class="checkout-field">
                <label for="checkout-lastname">Nom *</label>
                <input type="text" id="checkout-lastname" placeholder="Dupont" required>
              </div>
            </div>

            <div class="checkout-field">
              <label for="checkout-phone">Téléphone *</label>
              <div class="checkout-phone-row">
                <select id="checkout-country" class="checkout-country-select"></select>
                <input type="tel" id="checkout-phone" placeholder="6 12 34 56 78" required>
              </div>
            </div>

            <div id="checkout-error" class="checkout-error"></div>

            <button type="submit" id="checkout-submit-btn" class="checkout-submit-btn">
              Continuer vers le paiement
            </button>

            <p class="checkout-trust">
              <svg viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              Paiement sécurisé par Mobile Money
            </p>
          </form>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    modal = document.getElementById('checkout-modal');
    
    // Add modal styles if not already present
    addModalStyles();
  }
  
  return modal;
}

function addModalStyles() {
  if (document.getElementById('checkout-styles')) return;
  
  const styles = document.createElement('style');
  styles.id = 'checkout-styles';
  styles.textContent = `
    #checkout-overlay {
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.5);
      z-index: 1000;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.3s, visibility 0.3s;
    }
    #checkout-overlay.active {
      opacity: 1;
      visibility: visible;
    }
    #checkout-modal {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1001;
      padding: 20px;
      pointer-events: none;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.3s, visibility 0.3s;
    }
    #checkout-modal.active {
      opacity: 1;
      visibility: visible;
      pointer-events: auto;
    }
    .checkout-modal-inner {
      background: var(--creme, #FAF7F2);
      border-radius: 16px;
      padding: 32px;
      max-width: 440px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      position: relative;
      box-shadow: 0 20px 60px rgba(0,0,0,0.2);
    }
    .checkout-modal-close {
      position: absolute;
      top: 16px;
      right: 16px;
      background: none;
      border: none;
      cursor: pointer;
      padding: 8px;
      color: var(--gris, #7A736C);
      transition: color 0.2s;
    }
    .checkout-modal-close:hover { color: var(--brun, #1a1208); }
    .checkout-modal-close svg { width: 20px; height: 20px; stroke: currentColor; stroke-width: 2; fill: none; }
    .checkout-header { margin-bottom: 24px; }
    .checkout-header h2 {
      font-family: 'Cormorant Garamond', serif;
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--brun, #1a1208);
      margin-bottom: 12px;
    }
    .checkout-plan-info {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--creme-3, #E8DFD0);
      padding: 12px 16px;
      border-radius: 8px;
      font-size: 0.9rem;
    }
    .checkout-plan-info span:first-child { color: var(--brun, #1a1208); }
    .checkout-plan-info span:last-child {
      font-weight: 600;
      color: var(--terre, #8B5E3C);
    }
    .checkout-field { margin-bottom: 16px; }
    .checkout-field label {
      display: block;
      font-size: 0.85rem;
      font-weight: 500;
      color: var(--gris-fonce, #4A4540);
      margin-bottom: 6px;
    }
    .checkout-field input, .checkout-country-select {
      width: 100%;
      padding: 12px 14px;
      border: 1.5px solid var(--creme-3, #E8DFD0);
      border-radius: 8px;
      font-size: 0.95rem;
      background: white;
      color: var(--brun, #1a1208);
      transition: border-color 0.2s;
      box-sizing: border-box;
    }
    .checkout-field input:focus, .checkout-country-select:focus {
      outline: none;
      border-color: var(--terre, #8B5E3C);
    }
    .checkout-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    .checkout-phone-row { display: flex; gap: 8px; }
    .checkout-country-select {
      width: 120px;
      flex-shrink: 0;
      padding: 12px 8px;
    }
    .checkout-phone-row input { flex: 1; }
    .checkout-error {
      color: #c0392b;
      font-size: 0.85rem;
      margin-bottom: 12px;
      min-height: 20px;
    }
    .checkout-submit-btn {
      width: 100%;
      padding: 16px;
      background: var(--brun, #1a1208);
      color: var(--or, #D4A853);
      font-size: 0.95rem;
      font-weight: 600;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.2s, transform 0.2s;
    }
    .checkout-submit-btn:hover:not(:disabled) {
      background: var(--terre, #8B5E3C);
      transform: translateY(-1px);
    }
    .checkout-submit-btn:disabled {
      opacity: 0.7;
      cursor: not-allowed;
    }
    .checkout-trust {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-top: 16px;
      font-size: 0.8rem;
      color: var(--gris, #7A736C);
    }
    .checkout-trust svg {
      width: 14px;
      height: 14px;
      fill: var(--vert, #2D6A4F);
      stroke: none;
    }
    @media (max-width: 480px) {
      .checkout-modal-inner { padding: 24px 20px; }
      .checkout-row { grid-template-columns: 1fr; }
      .checkout-phone-row { flex-direction: column; }
      .checkout-country-select { width: 100%; }
    }
  `;
  document.head.appendChild(styles);
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function formatPrice(price) {
  return new Intl.NumberFormat('fr-FR').format(price) + ' FCFA';
}

// Expose functions globally
window.openCheckoutModal = openCheckoutModal;
window.closeModal = closeModal;

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCheckout);
} else {
  initCheckout();
}
