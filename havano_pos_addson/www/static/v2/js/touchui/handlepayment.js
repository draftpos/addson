document.addEventListener('DOMContentLoaded', function () {
  const overlay = document.getElementById('paymentOverlay');
  if (!overlay) {
    console.error('paymentOverlay element not found. Aborting payment popup init.');
    return;
  }
  
  // State
  let activeInput = null;
  let popupInitialized = false;
  let subWatchInterval = null;
  const subTotalEl = document.getElementById('sub_total');
  let lastKnownSubTotal = subTotalEl ? subTotalEl.value : null;
  let defaultCurrency = null;
  let exchangeRates = {};

  // --------------------------
  // Helpers (safe, scoped)
  // --------------------------
  function getTotalAmount() {
    // Read-only: never write to #sub_total here
    return subTotalEl ? parseFloat(subTotalEl.value) || 0 : 0;
  }

  function fetchDefaultCurrency() {
    frappe.call({
      method: "frappe.client.get_value",
      args: {
        doctype: "HA POS Setting",
        fieldname: "default_currency",
        filters: { ha_pos_settings_on: 1 }
      },
      callback: function(response) {
        if (response.message) {
          defaultCurrency = response.message.default_currency;
          // Store in localStorage for use by invoice.js
          localStorage.setItem("pos_base_currency", defaultCurrency);
          checkAndShowExchangeRates();
          updateExchangeRateDisplay(); // Ensure proper display state
        }
      }
    });
  }
  function roundToTwo(num) {
    return Math.round((num + Number.EPSILON) * 100) / 100;
  }

  function fetchExchangeRate(fromCurrency, toCurrency) {
    if (fromCurrency === toCurrency) return 1;
    
    frappe.call({
      method: "frappe.client.get_value",
      args: {
        doctype: "Currency Exchange",
        fieldname: "exchange_rate",
        filters: {
          from_currency: fromCurrency,
          to_currency: toCurrency
        },
        order_by: "date desc"
      },
      callback: function(response) {
        if (response.message && response.message.exchange_rate) {
          
      // exchangeRates[`${fromCurrency}_${toCurrency}`] = 1 / response.message.exchange_rate;
      exchangeRates[`${fromCurrency}_${toCurrency}`] = roundToTwo(1 / response.message.exchange_rate);


        } else {
          // Fallback to 1 if no exchange rate found
          exchangeRates[`${fromCurrency}_${toCurrency}`] = 1;
        }
        updateExchangeRateDisplay();
      }
    });
  }

  function checkAndShowExchangeRates() {
    if (!defaultCurrency) return;
    
    const paymentInputs = overlay.querySelectorAll('.ha-pos-payment-pop-method-input');
    paymentInputs.forEach((input, index) => {
      const currency = input.getAttribute('data-currency');
      
      // Find the exchange rate div by looking for it within the same payment method container
      const methodContainer = input.closest('.ha-pos-payment-pop-method');
      const exchangeRateDiv = methodContainer ? methodContainer.querySelector('.ha-exchange-rate-info') : null;
      const baseEquivDiv = methodContainer ? methodContainer.querySelector('.ha-base-currency-equivalent') : null;
      
      if (currency && currency !== defaultCurrency) {
        // Show exchange rate info and base currency equivalent
        if (exchangeRateDiv) {
          exchangeRateDiv.style.display = 'block';
        }
        if (baseEquivDiv) {
          baseEquivDiv.style.display = 'block';
          // Set the base currency symbol
          const baseSymbol = baseEquivDiv.querySelector('.base-currency-symbol');
          if (baseSymbol) baseSymbol.textContent = defaultCurrency;
        }
        // Fetch exchange rate
        fetchExchangeRate(defaultCurrency, currency);
      } else {
        // Hide exchange rate info for same currency
        if (exchangeRateDiv) {
          exchangeRateDiv.style.display = 'none';
        }
        if (baseEquivDiv) {
          baseEquivDiv.style.display = 'none';
        }
      }
    });
  }

  function updateExchangeRateDisplay() {
    const paymentInputs = overlay.querySelectorAll('.ha-pos-payment-pop-method-input');
    paymentInputs.forEach((input, index) => {
      const currency = input.getAttribute('data-currency');
      
      // Find the exchange rate div by looking for it within the same payment method container
      const methodContainer = input.closest('.ha-pos-payment-pop-method');
      const exchangeRateDiv = methodContainer ? methodContainer.querySelector('.ha-exchange-rate-info') : null;
      
      if (currency && currency !== defaultCurrency) {
        // Show and update exchange rate for different currencies
        if (exchangeRateDiv) {
          exchangeRateDiv.style.display = 'block';
          const rateValue = exchangeRates[`${defaultCurrency}_${currency}`];
          if (rateValue) {
            exchangeRateDiv.querySelector('.exchange-rate-value').textContent = rateValue.toFixed(4);
            
            // Update the <b> value with converted amount if there's an input value
            const inputValue = parseFloat(input.value) || 0;
            if (inputValue > 0) {
              const convertedAmount = calculateConvertedAmount(inputValue, defaultCurrency, currency);
              const bElement = methodContainer.querySelector('.ha-pos-payment-pop-method-label b');
              if (bElement) {
                bElement.textContent = convertedAmount.toFixed(2);
              }
            }
          }
        }
      } else {
        // Hide exchange rate for same currency
        if (exchangeRateDiv) {
          exchangeRateDiv.style.display = 'none';
        }
      }
    });
  }

  function calculateConvertedAmount(inputValue, fromCurrency, toCurrency) {
    if (fromCurrency === toCurrency) return parseFloat(inputValue) || 0;
    
    const rate = exchangeRates[`${fromCurrency}_${toCurrency}`] || 1;
    return (parseFloat(inputValue) || 0) * rate;
  }

  // Calculate base currency equivalent from foreign currency input
  function calculateBaseEquivalent(foreignAmount, foreignCurrency) {
    if (!defaultCurrency || foreignCurrency === defaultCurrency) return parseFloat(foreignAmount) || 0;
    
    // To convert from foreign to base: divide by the exchange rate (base to foreign)
    const rate = exchangeRates[`${defaultCurrency}_${foreignCurrency}`] || 1;
    return (parseFloat(foreignAmount) || 0) / rate;
  }

  function safeSetInputValue(inputEl, valueStr) {
    if (!inputEl) return;
    if (inputEl.id === 'sub_total') {
      // Never overwrite the external subtotal
      // console.warn('Attempt to write #sub_total prevented.');
      return;
    }
    inputEl.value = valueStr;
  }

  function setMethodValue(methodContainer, value) {
    if (!methodContainer) return;
    const bEl = methodContainer.querySelector('b');
    const inputEl = methodContainer.querySelector('input');
    if (!bEl || !inputEl) return;

    const v = (typeof value === 'number') ? value : (parseFloat(value) || 0);
    bEl.textContent = v.toFixed(2);

    // Protect external subtotal if somehow present
    if (inputEl.id === 'sub_total') {
      // console.warn('Skipped writing to an input with id=sub_total inside setMethodValue.');
    } else {
      inputEl.value = v.toFixed(2);
      activeInput = inputEl;
      activeInput.focus();
    }
  }

  function resetPopupMethods() {
    // Only reset methods inside the popup
    const methods = overlay.querySelectorAll('.ha-pos-payment-pop-method');
    methods.forEach(method => {
      const bEl = method.querySelector('b');
      const inputEl = method.querySelector('input');
      if (!bEl || !inputEl) return;
      bEl.textContent = '0.00';
      if (inputEl.id === 'sub_total') {
        // Never clear the external subtotal if it's accidentally included
        // console.warn('Skipped clearing input with id=sub_total during resetPopupMethods.');
      } else {
        inputEl.value = '';
      }
    });
    activeInput = null;
  }

  function syncDisplay(inputEl) {
    if (!inputEl || inputEl.id === 'sub_total') return;
    const methodContainer = inputEl.closest('.ha-pos-payment-pop-method');
    const container = inputEl.closest('.ha-pos-payment-method-base-currency');
    const bEl = container ? container.querySelector('b') : null;
    if (!bEl) return;
    
    const inputValue = parseFloat(inputEl.value) || 0;
    const currency = inputEl.getAttribute('data-currency');
    
    // Calculate total and sum paid to get remaining balance
    const totalAmount = getTotalAmount();
    let sumPaidInBaseCurrency = 0;
    
    overlay.querySelectorAll('.ha-pos-payment-pop-method-input').forEach(input => {
      if (input.id === 'sub_total') return;
      const val = parseFloat(input.value) || 0;
      const curr = input.getAttribute('data-currency');
      
      if (curr && defaultCurrency && curr !== defaultCurrency) {
        sumPaidInBaseCurrency += calculateBaseEquivalent(val, curr);
      } else {
        sumPaidInBaseCurrency += val;
      }
    });
    
    const remainingBalanceInBase = totalAmount - sumPaidInBaseCurrency;
    
    // Show remaining balance converted to this payment method's currency
    if (currency && defaultCurrency && currency !== defaultCurrency) {
      const remainingInThisCurrency = calculateConvertedAmount(remainingBalanceInBase, defaultCurrency, currency);
      bEl.textContent = (remainingInThisCurrency > 0 ? remainingInThisCurrency : 0).toFixed(2);
      
      // Show base currency equivalent of what was entered
      const baseEquivDiv = methodContainer ? methodContainer.querySelector('.ha-base-currency-equivalent') : null;
      if (baseEquivDiv && inputValue > 0) {
        const baseEquivalent = calculateBaseEquivalent(inputValue, currency);
        const baseEquivValue = baseEquivDiv.querySelector('.base-equiv-value');
        if (baseEquivValue) {
          baseEquivValue.textContent = baseEquivalent.toFixed(2);
        }
      }
    } else {
      // For same currency, show remaining balance
      bEl.textContent = (remainingBalanceInBase > 0 ? remainingBalanceInBase : 0).toFixed(2);
    }
  }

  // --------------------------
  // Distribute balance across payment methods with currency conversion
  // --------------------------
  function distributeBalanceAcrossPaymentMethods() {
    const totalAmount = getTotalAmount();
    let sumPaidInBaseCurrency = 0;

    // Calculate total paid across all methods (in base currency)
    overlay.querySelectorAll('.ha-pos-payment-pop-method-input').forEach(input => {
      if (input.id === 'sub_total') return;
      const inputValue = parseFloat(input.value) || 0;
      const currency = input.getAttribute('data-currency');
      
      // Convert to base currency if different
      if (currency && defaultCurrency && currency !== defaultCurrency) {
        sumPaidInBaseCurrency += calculateBaseEquivalent(inputValue, currency);
      } else {
        sumPaidInBaseCurrency += inputValue;
      }
    });

    const remainingBalance = totalAmount - sumPaidInBaseCurrency;

    // Check if any method has input
    const hasAnyInput = sumPaidInBaseCurrency > 0;

    // Update <b> tags for all payment methods
    const inputs = overlay.querySelectorAll('.ha-pos-payment-pop-method-input');

    inputs.forEach((input, index) => {
      if (input.id === 'sub_total') return;
      
      const container = input.closest('.ha-pos-payment-pop-method');
      if (!container) return;
      
      const labelDiv = container.querySelector('.ha-pos-payment-pop-method-label');
      if (!labelDiv) return;
      
      // Get the second span which contains the currency symbol and <b> tag
      const spans = labelDiv.querySelectorAll('span');
      const currencySpan = spans.length > 1 ? spans[1] : spans[0];
      
      if (!currencySpan) return;
      
      const bEl = currencySpan.querySelector('b');
      if (!bEl) return;

      const inputValue = parseFloat(input.value) || 0;
      const currency = input.getAttribute('data-currency');

      // Always show remaining balance (converted to the method's currency if needed)
      let amountToShowInBaseCurrency;
      
      if (hasAnyInput) {
        // If ANY method has input, show remaining balance
        amountToShowInBaseCurrency = remainingBalance > 0 ? remainingBalance : 0;
      } else {
        // If NO method has input yet, show total amount
        amountToShowInBaseCurrency = totalAmount;
      }
      
      // Convert to the payment method's currency if different
      if (currency && defaultCurrency && currency !== defaultCurrency) {
        const convertedAmount = calculateConvertedAmount(amountToShowInBaseCurrency, defaultCurrency, currency);
        bEl.textContent = convertedAmount.toFixed(2);
        
        // Update base currency equivalent if this method has an input value
        if (inputValue > 0) {
          const baseEquivDiv = container ? container.querySelector('.ha-base-currency-equivalent') : null;
          if (baseEquivDiv) {
            const baseEquivalent = calculateBaseEquivalent(inputValue, currency);
            const baseEquivValue = baseEquivDiv.querySelector('.base-equiv-value');
            if (baseEquivValue) {
              baseEquivValue.textContent = baseEquivalent.toFixed(2);
            }
          }
        }
      } else {
        bEl.textContent = amountToShowInBaseCurrency.toFixed(2);
      }
    });
  }

  // --------------------------
  // Handle click on disabled save button
  // --------------------------
  function handleDisabledSaveClick(event) {
    event.preventDefault();
    event.stopPropagation();
    
    const saveButton = document.getElementById('ha-pos-savepaymentdata');
    if (saveButton && saveButton.hasAttribute('disabled')) {
      const change = parseFloat(saveButton.getAttribute('data-change')) || 0;
      const balance = Math.abs(change);
      const currencySymbol = defaultCurrency || '$';
      
      frappe.msgprint({
        message: `Cannot save! Balance remaining: ${currencySymbol} ${balance.toFixed(2)}`,
        indicator: 'red',
        title: 'Payment Incomplete'
      });
      
      // Apply z-index to the modal after it's created
      setTimeout(() => {
        // Try multiple selectors to find the modal
        const modals = document.querySelectorAll('.modal');
        const modalDialogs = document.querySelectorAll('.modal-dialog');
        const modalContents = document.querySelectorAll('.modal-content');
        const modalBackdrop = document.querySelector('.modal-backdrop');
        
        // Apply z-index to all modals (the last one should be our msgprint)
        modals.forEach((modal, index) => {
          modal.style.setProperty('z-index', '999999', 'important');
        });
        
        // Also apply to modal dialogs
        modalDialogs.forEach((dialog, index) => {
          dialog.style.setProperty('z-index', '999999', 'important');
        });
        
        // Also apply to modal contents
        modalContents.forEach((content, index) => {
          content.style.setProperty('z-index', '999999', 'important');
        });
        
        if (modalBackdrop) {
          modalBackdrop.style.setProperty('z-index', '999998', 'important');
        }
      }, 100);
    }
    
    return false;
  }

  // --------------------------
  // Totals (scoped)
  // --------------------------
  function updateTotals() {
    const totalAmount = getTotalAmount();
    let sumPaidInBaseCurrency = 0;

    // Sum all payments converted to base currency
    overlay.querySelectorAll('.ha-pos-payment-pop-method-input').forEach(input => {
      if (input.id === 'sub_total') return; // safety
      const inputValue = parseFloat(input.value) || 0;
      const currency = input.getAttribute('data-currency');
      
      // Convert to base currency if different
      if (currency && defaultCurrency && currency !== defaultCurrency) {
        sumPaidInBaseCurrency += calculateBaseEquivalent(inputValue, currency);
      } else {
        sumPaidInBaseCurrency += inputValue;
      }
    });

    const change = sumPaidInBaseCurrency - totalAmount; // Positive when overpaid, negative when underpaid
    // if (Math.abs(change) < 0.01) {
    //   change = 0;
    // }

    const totalEl = document.getElementById('ha-pos-payment-pop-total-amount');
    if (totalEl) {
      // Get currency symbol
      const currencySymbol = defaultCurrency || '$';
      const currencySymbolEl = document.getElementById('ha-pos-payment-pop-currency-symbol');
      if (currencySymbolEl) currencySymbolEl.textContent = currencySymbol;
      
      // Update total with currency
      totalEl.innerHTML = `<span id="ha-pos-payment-pop-currency-symbol">${currencySymbol}</span> ${totalAmount.toFixed(2)}`;
    }

    const changeEl = overlay.querySelector('#ha-pos-payment-pop-change-footer-section') || document.querySelector('#ha-pos-payment-pop-change-footer-section');
    if (changeEl) {
      // Show change with sign (negative when underpaid, positive when overpaid)
      const changeText = change.toFixed(2);
      changeEl.textContent = changeText;
      
      // Apply color styling: red for negative, green for positive
      if (change < 0) {
        changeEl.style.color = 'red';
        changeEl.style.fontWeight = 'bold';
      } else if (change > 0) {
        changeEl.style.color = 'green';
        changeEl.style.fontWeight = 'bold';
      } else {
        changeEl.style.color = 'black';
        changeEl.style.fontWeight = 'normal';
      }
    }

    // Update currency symbols for Rounding and Change
    const currencySymbol = defaultCurrency || '$';
    const roundingCurrencyEl = document.getElementById('ha-pos-payment-pop-rounding-currency');
    const changeCurrencyEl = document.getElementById('ha-pos-payment-pop-change-currency');
    if (roundingCurrencyEl) roundingCurrencyEl.textContent = currencySymbol;
    if (changeCurrencyEl) changeCurrencyEl.textContent = currencySymbol;

    // Disable save button if change is negative (underpaid)
    const saveButton = document.getElementById('ha-pos-savepaymentdata');
    if (saveButton) {
      if (change < 0) {
        saveButton.style.opacity = '0.5';
        saveButton.style.cursor = 'not-allowed';
        saveButton.setAttribute('disabled', 'true');
        saveButton.setAttribute('data-change', change.toFixed(2)); // Store change value for message
        
        // Use capture phase to intercept clicks before they're blocked
        saveButton.addEventListener('click', handleDisabledSaveClick, true);
      } else {
        saveButton.style.opacity = '1';
        saveButton.style.cursor = 'pointer';
        saveButton.removeAttribute('disabled');
        saveButton.removeAttribute('data-change');
        
        // Remove the disabled click handler
        saveButton.removeEventListener('click', handleDisabledSaveClick, true);
      }
    }

    // Distribute balance across payment methods with currency conversion
    distributeBalanceAcrossPaymentMethods();
  }

  // --------------------------
  // Keypad behavior
  // --------------------------
  function handleKeypadInput(value) {
    if (!activeInput) return;
    if (activeInput.id === 'sub_total') {
      // console.warn('Keypad prevented from writing to #sub_total.');
      return;
    }
    // If input currently is "0.00" or empty, start fresh (so buttons act like entering numbers)
    if (activeInput.value === '0.00' || activeInput.value === '') activeInput.value = '';

    // Append the button text (some buttons are '10', '20', '100', etc.)
    activeInput.value = String(activeInput.value || '') + String(value).trim();

    syncDisplay(activeInput);
    updateTotals();
  }

  function clearActiveInput() {
    if (!activeInput || activeInput.id === 'sub_total') return;
    activeInput.value = '';
    syncDisplay(activeInput);
    updateTotals();
  }

  function backspaceActiveInput() {
    if (!activeInput || activeInput.id === 'sub_total') return;
    activeInput.value = String(activeInput.value || '').slice(0, -1);
    syncDisplay(activeInput);
    updateTotals();
  }

  // --------------------------
  // Event hookup (once)
  // --------------------------
  function setupEventHandlersOnce() {
    if (popupInitialized) return;
    popupInitialized = true;

    // Keypad numeric buttons
    overlay.querySelectorAll('.ha-pos-payment-pop-btn-num').forEach(btn => {
      btn.addEventListener('click', function () {
        handleKeypadInput(btn.textContent);
      });
    });

    // Special keypad buttons (Back, Clear, Cancel, etc)
    overlay.querySelectorAll('.ha-pos-payment-pop-btn').forEach(btn => {
      const txt = (btn.textContent || '').trim();
      if (txt === 'Clear') btn.addEventListener('click', clearActiveInput);
      else if (txt === 'Back') btn.addEventListener('click', backspaceActiveInput);
      else if (txt === 'Cancel') btn.addEventListener('click', closePaymentPopup);
      else if (txt === '.') btn.addEventListener('click', function() {
        handleKeypadInput('.');
      });
      // leave other buttons alone (e.g. numeric duplicates handled above)
    });

    // Payment-method click -> make that method's input active
    overlay.querySelectorAll('.ha-pos-payment-pop-method').forEach(method => {
      method.addEventListener('click', function (e) {
        const container = method.querySelector('.ha-pos-payment-method-base-currency');
        if (!container) return;
        const inputEl = container.querySelector('input');
        if (!inputEl) return;

        if (inputEl.id === 'sub_total') {
          // console.warn('Clicked input is #sub_total, ignoring to avoid overwriting outside subtotal.');
          return;
        }

        activeInput = inputEl;
        activeInput.focus();
      });
    });

    // If user types directly into popup inputs, keep display & totals in sync
    overlay.querySelectorAll('.ha-pos-payment-pop-method-input').forEach(input => {
      input.addEventListener('input', function () {
        if (input.id === 'sub_total') return;
        
        syncDisplay(input);
        updateTotals();
      });
    });
  }

  // --------------------------
  // Protect external subtotal while popup is open (watcher)
  // --------------------------
  function startSubTotalWatcher() {
    if (!subTotalEl) return;
    lastKnownSubTotal = subTotalEl.value;
    // poll rapidly while popup open; revert immediate accidental zeroing
    subWatchInterval = setInterval(() => {
      if (overlay.style.display === 'flex') {
        const current = subTotalEl.value;
        // if it was changed to empty or zero unexpectedly, restore it
        if ((current === '' || current === '0' || current === '0.00') && lastKnownSubTotal && lastKnownSubTotal !== current) {
          // console.warn('Detected accidental change to #sub_total while popup open — restoring previous value.');
          subTotalEl.value = lastKnownSubTotal;
        } else {
          // accept legitimate changes (update last known)
          if (current !== lastKnownSubTotal) lastKnownSubTotal = current;
        }
      } else {
        // popup closed -> stop watcher
        clearInterval(subWatchInterval);
        subWatchInterval = null;
      }
    }, 120); // 120ms is responsive but light-weight
  }

  // --------------------------
  // Open/Close: exposed globally so your inline onclicks still work
  // --------------------------
  window.openPaymentPopup = function () {
    setupEventHandlersOnce();     // ensure handlers exist (only once)
    resetPopupMethods();          // reset only popup fields
    fetchDefaultCurrency();       // fetch default currency and exchange rates
    const totalAmount = getTotalAmount();
    const cashMethodContainer = overlay.querySelector('.ha-pos-payment-method-cash-amount-container');
    const cash_default = document.getElementById("ha-pos-payment-pop-total-amount");
    // const cash_default = document.querySelector(".ha-total-value");
    
    cash_default.innerHTML = totalAmount;
    
    // Don't auto-fill cash, just show the total in all payment method <b> tags
    // if (cashMethodContainer) setMethodValue(cashMethodContainer, totalAmount);
    
    overlay.style.display = 'flex';
    
    // Initialize balance distribution across all payment methods with multiple attempts
    // First attempt - immediate (might work if currency already cached)
    setTimeout(() => {
      distributeBalanceAcrossPaymentMethods();
    }, 50);
    
    // Second attempt - after currency should be loaded
    setTimeout(() => {
      distributeBalanceAcrossPaymentMethods();
    }, 300);
    
    // Third attempt - ensure it's definitely loaded
    setTimeout(() => {
      distributeBalanceAcrossPaymentMethods();
    }, 800);
    
    updateTotals();
    startSubTotalWatcher();
  };

  window.closePaymentPopup = function () {
    overlay.style.display = 'none';
    // clear active input
    activeInput = null;
    if (subWatchInterval) {
      clearInterval(subWatchInterval);
      subWatchInterval = null;
    }
  };

  // Optional: if the page updates the subtotal and you want the popup to reflect that while open,
  // you can call updateTotals() from your cart code when subtotal changes.
});