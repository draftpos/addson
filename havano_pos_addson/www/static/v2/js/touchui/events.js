// Bind event listeners
function bindEvents() {
    btnAddRow.addEventListener('click', addNewRow);
    btnPayment.addEventListener('click',  showPaymentDialog);
    clearCartBtn.addEventListener('click', clearCart);
    
    // Quantity popup events
    quantityPopupConfirm.addEventListener('click', applyQuantityFromPopup);
    quantityPopupCancel.addEventListener('click', hideQuantityPopup);
    quantityPopupOverlay.addEventListener('click', hideQuantityPopup);
    
    // Number pad events
    document.querySelectorAll('.ha-numpad-btn[data-value]').forEach(button => {
        button.addEventListener('click', () => {
            handleNumpadInput(button.getAttribute('data-value'));
        });
    });
    
    document.querySelectorAll('.ha-sidebar-numpad-btn[data-value]').forEach(button => {
        button.addEventListener('click', () => {
            handleNumpadInput(button.getAttribute('data-value'));
        });
    });
    
    quantityClear.addEventListener('click', () => {
        handleNumpadInput('clear');
    });
    
    quantityBackspace.addEventListener('click', () => {
        handleNumpadInput('backspace');
    });
    
    // Handle Enter key in quantity popup
    document.addEventListener('keydown', function(e) {
        if (quantityPopup.classList.contains('active')) {
            if (e.key === 'Enter') {
                e.preventDefault();
                applyQuantityFromPopup();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                hideQuantityPopup();
            } else if (e.key >= '0' && e.key <= '9') {
                e.preventDefault();
                handleNumpadInput(e.key);
            } else if (e.key === 'Backspace') {
                e.preventDefault();
                handleNumpadInput('backspace');
            } else if (e.key === 'Delete' || e.key === 'Clear') {
                e.preventDefault();
                handleNumpadInput('clear');
            }
        }
    });
    
    // Event delegation for dynamic elements
    document.addEventListener('click', function(e) {
        // Item search for both name and code
        if (e.target.classList.contains('ha-item-input') || 
            e.target.classList.contains('item-code')) {
            showItemSearchDropdown(e.target);
            activeItemField = e.target;
        } 
        // Delete item
        else if (e.target.closest('.btn-danger')) {
            removeItem(e.target.closest('.btn-danger'));
        }
        // Hide dropdown when clicking elsewhere
        else if (!e.target.closest('.ha-item-search-dropdown')) {
            searchDropdown.style.display = 'none';
            isInSearchMode = false;
        }
        
        // Function keys
        if (e.target.closest('.ha-function-key')) {
            const action = e.target.closest('.ha-function-key').dataset.action;
            handleFunctionKey(action);
        }
        
        // Set active row when clicking on any row element
        if (e.target.closest('tr')) {
            const rows = itemsTableBody.querySelectorAll('tr');
            rows.forEach(row => row.classList.remove('item-row-active'));
            e.target.closest('tr').classList.add('item-row-active');
        }
    });
    
    // Input events for both item code and name search
    document.addEventListener('input', function(e) {
        if (e.target.classList.contains('item-code') || 
            e.target.classList.contains('ha-item-input')) {
            const searchTerm = e.target.value.trim();
            currentSearchTerm = searchTerm;
            
            if (searchTerm.length > 1) {
                searchItems(searchTerm, e.target.classList.contains('item-code') ? 'code' : 'name');
                positionDropdown(e.target);
            } else {
                searchDropdown.style.display = 'none';
                isInSearchMode = false;
            }
        }
    });
    
    // Change events for quantity and rate
    document.addEventListener('change', function(e) {
        if (e.target.classList.contains('item-qty') || 
            e.target.classList.contains('item-rate')) {
            updateItemAmount(e.target);
        }
    });
    
    // Focus events for form fields
    document.addEventListener('focusin', function(e) {
        if (e.target.matches('input, select')) {
            // Remove active class from all fields
            document.querySelectorAll('input, select').forEach(field => {
                field.classList.remove('form-field-active');
            });
            
            // Add active class to current field
            e.target.classList.add('form-field-active');
            
            // Update current focus index
            const fields = getFocusableFields();
            currentFocusIndex = fields.indexOf(e.target);
            
            // If it's an item field, set as active
            if (e.target.classList.contains('ha-item-input') || 
                e.target.classList.contains('item-code')) {
                activeItemField = e.target;
            }
            
            // Set active row when focusing on a field in a row
            if (e.target.closest('tr')) {
                const rows = itemsTableBody.querySelectorAll('tr');
                rows.forEach(row => row.classList.remove('item-row-active'));
                e.target.closest('tr').classList.add('item-row-active');
            }
        }
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // Skip if quantity popup is active (handled separately)
        if (quantityPopup.classList.contains('active')) return;
        
        // Function keys
        if (e.key === 'F1' || e.key === 'F2') {
            e.preventDefault();
            showPaymentDialog();
        }
        else if (e.key === 'F5') {
            e.preventDefault();
            handleFunctionKey('quantity');
        }
        else if (e.key === 'F6') {
            e.preventDefault();
            handleFunctionKey('delete');
        }
        else if (e.key === 'F9') {
            e.preventDefault();
            openShiftPopup();
        }
        
        else if (e.key === 'F7') handleFunctionKey('discount');
        else if (e.key === 'F10') handleFunctionKey('options');
        else if (e.key === 'F12') handleFunctionKey('return');
        
        // Alt + F6 for Clear All
        if (e.altKey && e.key === 'F6') {
            e.preventDefault();
            handleFunctionKey('clearAll');
        }

        
        // Enter key to move to next field/row or confirm selection
        if (e.key === 'Enter') { const activeEl = document.activeElement;

    // Handle Enter only in item fields
    if (activeEl.classList.contains('item-code') || activeEl.classList.contains('ha-item-input')) {
        e.preventDefault();

        const searchTerm = activeEl.value.trim();
        if (!searchTerm) return;

        // Trigger search
        searchItems(searchTerm, activeEl.classList.contains('item-code') ? 'code' : 'name');

        // Wait a tiny bit and select the first item automatically
        setTimeout(() => {
            const firstResult = searchDropdown.querySelector('.ha-search-result-item');
            if (firstResult) {
                firstResult.click(); // this calls selectItem()
                searchDropdown.style.display = 'none';
                isInSearchMode = false;

                // Move to next row
                const currentRow = activeEl.closest('tr');
                let nextRow = currentRow.nextElementSibling;
                if (!nextRow) {
                    // addNewRow();
                    nextRow = itemsTableBody.lastChild;
                }

                const nextCodeField = nextRow.querySelector('.item-code');
                nextCodeField.focus();
                nextCodeField.select();
            }
        }, 500); // tiny delay for dropdown to populate
    }
}

        
        // Tab key to move to next field
        if (e.key === 'Tab') {
            e.preventDefault();
            moveToNextField();
        }
        
        // Shift+Tab to move to previous field
        if (e.key === 'Tab' && e.shiftKey) {
            e.preventDefault();
            moveToPreviousField();
        }
        
        // Escape key to close dropdown and exit search mode
        if (e.key === 'Eescape') {
            searchDropdown.style.display = 'none';
            isInSearchMode = false;
            
            // If we were in an item field, keep focus there
            if (activeItemField) {
                activeItemField.focus();
                activeItemField.select();
            }
        }
        
        // Arrow keys in search dropdown
        if (searchDropdown.style.display === 'block') {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                navigateSearchResults(1);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                navigateSearchResults(-1);
            }
        }
        // Arrow keys to navigate between items in the table
        else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && 
                 document.activeElement.closest('tr') && 
                 !document.activeElement.classList.contains('btn-danger')) {
            e.preventDefault();
            navigateTableRows(e.key === 'ArrowDown' ? 1 : -1);
        }
    });
    
    // Logout button
    document.getElementById('btnLogout').addEventListener('click', function() {
        // Show confirmation dialog
        if (confirm('Are you sure you want to logout?')) {
            // Show loading message
            if (typeof frappe !== 'undefined' && frappe.show_alert) {
                // frappe.show_alert('Logging out...', 'info');
            } else {
                // alert('Logging out...');
            }
            
            // Clear any cached data first
            // localStorage.clear();
            // sessionStorage.clear();
            
            // Use the correct Frappe logout endpoint
            // Method 1: Direct redirect to logout URL (most reliable)
            // window.location.href = "/api/method/logout";
            
            // Method 2: Alternative - fetch logout endpoint
            fetch('/api/method/logout', {
                method: 'GET',
                credentials: 'include'
            }).then(() => {
                window.location.href = "/login?redirect-to=havano-pos-touch-ui#login";
            }).catch((error) => {
                // console.error("Logout error:", error);
                window.location.href = "/login?redirect-to=havano-pos-touch-ui#login";
            });
        }
    });
    
    // Handle window resize to reposition dropdown
    window.addEventListener('resize', function() {
        if (searchDropdown.style.display === 'block' && activeItemField) {
            positionDropdown(activeItemField);
        }
    });

    // Handle scroll indicators for function keys
    function setupScrollIndicators() {
        const functionKeysContainer = document.querySelector('.ha-function-keys');
        if (!functionKeysContainer) return;

        function updateScrollIndicators() {
            const { scrollLeft, scrollWidth, clientWidth } = functionKeysContainer;
            
            // Remove existing classes
            functionKeysContainer.classList.remove('scroll-left', 'scroll-right');
            
            // Add appropriate classes based on scroll position
            if (scrollLeft > 0) {
                functionKeysContainer.classList.add('scroll-left');
            }
            if (scrollLeft < scrollWidth - clientWidth - 1) {
                functionKeysContainer.classList.add('scroll-right');
            }
        }

        // Update indicators on scroll
        functionKeysContainer.addEventListener('scroll', updateScrollIndicators);
        
        // Update indicators on resize
        window.addEventListener('resize', updateScrollIndicators);
        
        // Initial update
        updateScrollIndicators();
    }

    // Setup scroll indicators when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', setupScrollIndicators);
    } else {
        setupScrollIndicators();
    }
}