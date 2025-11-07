// Initialize the POS when DOM is loaded
document.addEventListener('DOMContentLoaded', initPOS);

function initPOS() {
    cacheDOM();
    bindEvents();
    loadInitialData();
    addNewRow(); // Add first row
    showToast('POS System Ready', 'success');
    
    // Set initial focus to customer field
    setTimeout(() => {
        customerSelect.focus();
        const fields = getFocusableFields();
        currentFocusIndex = fields.indexOf(customerSelect);
    }, 100);
}

// Add new row function
function addNewRow() {
    const newRow = document.createElement('tr');
    newRow.innerHTML = `
        <td class="ha-relative">
            <input type="text" class="item-code form-control ha-item-input" placeholder="Type item code">
        </td>
        
        <td>
            <input type="text" class="item-name form-control ha-item-input" placeholder="Click to see all items">
        </td>
        <td>
            <input type="text" class="item-uom form-control" value="Nos" readonly>
        </td>
        <td>
            <input type="number" class="item-qty form-control" value="1" min="1">
        </td>
        <td>
            <input type="number" class="item-rate form-control" value="0.00" step="0.01" readonly>
        </td>
        <td>
            <input type="text" class="item-amount form-control" value="0.00" readonly>
        </td>
        <td class="text-center">
            <button class="btn btn-sm btn-danger" style="background-color: transparent; border: none;">
                <svg class="icon  icon-md" aria-hidden="true">
                    <use class="" href="#icon-delete-active"></use>
                </svg>
                <span class="text-danger ha-btn-label">F6</span>
            </button>
        </td>
    `;
    
    itemsTableBody.appendChild(newRow);
    
    // Auto-focus on the new item code field
    setTimeout(() => {
        const itemCodeInput = newRow.querySelector('.item-code');
        itemCodeInput.focus();
        itemCodeInput.select();
        
        // Update current focus index
        const fields = getFocusableFields();
        currentFocusIndex = fields.indexOf(itemCodeInput);
    }, 100);
}

// Update item amount
function updateItemAmount(input) {
    const row = input.closest('tr');
    const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
    const rate = parseFloat(row.querySelector('.item-rate').value) || 0;
    const amountCell = row.querySelector('.item-amount');
    
    const amount = qty * rate;
    amountCell.value = amount.toFixed(2);
    
    updateTotals();
}

// Remove item
function removeItem(button) {
    if (itemsTableBody.querySelectorAll('tr').length > 1) {
        button.closest('tr').remove();
        updateTotals();
    } else {
        showToast('You must have at least one item row.', 'error');
    }
}

// Clear all items from cart
function clearCart() {
    // Clear all rows from the table
    itemsTableBody.innerHTML = '';
    
    // Add a new empty row
    addNewRow();
    
    // Update totals (this will reset everything to 0)
    updateTotals();
    
    // Show success message
    showToast('Cart cleared successfully', 'success');
    
    // Focus on the new item code field
    setTimeout(() => {
        const newRow = itemsTableBody.querySelector('tr');
        if (newRow) {
            const itemCodeInput = newRow.querySelector('.item-code');
            itemCodeInput.focus();
            itemCodeInput.select();
        }
    }, 100);
}

// Update totals
function updateTotals() {
    let total = 0;
    let totalQuantity = 0;
    const amountCells = document.querySelectorAll('.item-amount');
    const quantityCells = document.querySelectorAll('.item-qty');
    const cartBadge = document.querySelector('#cartBadge');
    
    amountCells.forEach(cell => {
        total += parseFloat(cell.value) || 0;
    });
    
    quantityCells.forEach(cell => {
        const qty = parseFloat(cell.value) || 0;
        // Only count rows that have valid item data (non-zero rate indicates item is selected)
        const row = cell.closest('tr');
        const itemCode = row.querySelector('.item-code')?.value || '';
        if(itemCode.length > 0){
            totalQuantity += qty;
        }
    });
    
    // Update total amount display - with fallback to direct query if cached element is null
    const totalAmountElement = totalAmount || document.getElementById('totalAmount');
    if (totalAmountElement) {
        totalAmountElement.textContent = `$${total.toFixed(2)}`;
    }
    
    // Update subtotal field - with fallback
    const subTotalElement = subTotal || document.getElementById('sub_total');
    if (subTotalElement) {
        subTotalElement.value = total.toFixed(2);
    }
    
    // Update cart badge
    if (cartBadge) {
        cartBadge.textContent = Math.round(totalQuantity);
    }
}

// Handle function keys
function handleFunctionKey(action) {
    const actions = {
        // payment: () => saveSalesInvoice(),
        quantity: () => showQuantityPopup(),
        delete: () => deleteCurrentRow(),
        clearAll: () => clearAllItems(),
        discount: () => showToast('Discount feature coming soon', 'success'),
        options: () => showInvoicesModal(),
        return: () => showToast('Return process coming soon', 'success')
    };
    
    if (actions[action]) actions[action]();
}

// Delete current row (F6)
function deleteCurrentRow() {
    const activeElement = document.activeElement;
    const currentRow = activeElement.closest('tr');
    
    if (currentRow) {
        // Check if row has an item code
        const itemCode = currentRow.querySelector('.item-code');
        if (itemCode && itemCode.value && itemCode.value.trim() !== '') {
            // Clear the row instead of removing it
            clearRow(currentRow);
            showToast('Item removed from cart', 'success');
        } else {
            showToast('No item to delete in this row', 'warning');
        }
    } else {
        showToast('Please select a row to delete', 'warning');
    }
}

// Clear all items (Alt + F6)
function clearAllItems() {
    if (clearCartBtn) {
        clearCartBtn.click();
    }
}

// Clear a specific row
function clearRow(row) {
    if (!row) return;
    
    const itemCode = row.querySelector('.item-code');
    const itemName = row.querySelector('.item-name');
    const itemUom = row.querySelector('.item-uom');
    const itemQty = row.querySelector('.item-qty');
    const itemRate = row.querySelector('.item-rate');
    const itemAmount = row.querySelector('.item-amount');
    
    if (itemCode) itemCode.value = '';
    if (itemName) itemName.value = '';
    if (itemUom) itemUom.value = 'Nos';
    if (itemQty) itemQty.value = '1';
    if (itemRate) itemRate.value = '0.00';
    if (itemAmount) itemAmount.value = '0.00';
    
    // Update totals
    updateTotals();
}

function showPaymentDialog(){
    const subTotalEl = document.getElementById('sub_total').value;
    if (subTotalEl == 0) {
        showHaPopupCustom('Select at least one Item')
        return
    }
    openPaymentPopup();
  
}

// Adjust main styles
function adjustMainStyles() {
    const mainElement = document.querySelector('main.container.my-4');
    if (mainElement) {
        // Replace class 'container' with 'container-fluid'
        mainElement.classList.replace('container', 'container-fluid');

        // Set styles
        mainElement.style.setProperty('margin', '0', 'important');
        mainElement.style.setProperty('padding', '0', 'important');
        mainElement.style.setProperty('width', '100%', 'important');
    }
}

// Check if a row is empty (no item selected)
function isRowEmpty(row) {
    if (!row) return true;
    
    const itemCodeEl = row.querySelector('.item-code');
    const itemNameEl = row.querySelector('.item-name');
    const itemRateEl = row.querySelector('.item-rate');
    
    // If any required element is missing, consider row as empty
    if (!itemCodeEl || !itemNameEl || !itemRateEl) {
        return true;
    }
    
    const itemCode = itemCodeEl.value ? itemCodeEl.value.trim() : '';
    const itemName = itemNameEl.value ? itemNameEl.value.trim() : '';
    const itemRate = parseFloat(itemRateEl.value) || 0;
    
    // Row is considered empty if no item code, no item name, and rate is 0
    return !itemCode && !itemName && itemRate === 0;
}

// Remove empty rows above the specified row
function removeEmptyRowsAbove(currentRow) {
    if (!currentRow || !itemsTableBody) return;
    
    const allRows = Array.from(itemsTableBody.querySelectorAll('tr'));
    let currentRowIndex = allRows.indexOf(currentRow);
    
    // If current row not found in the array, return
    if (currentRowIndex === -1) return;
    
    // Check rows above the current row (from top to current row)
    for (let i = 0; i < currentRowIndex; i++) {
        const row = allRows[i];
        if (row && isRowEmpty(row)) {
            row.remove();
            // Update the array since we removed a row
            allRows.splice(i, 1);
            currentRowIndex--; // Adjust current row index
            i--; // Adjust loop counter since we removed an element
        }
    }
}

// Check if item already exists in the table
function checkItemExists(itemCode) {
    const existingRows = itemsTableBody.querySelectorAll('tr');
    for (let row of existingRows) {
        const codeField = row.querySelector('.item-code');
        if (codeField && codeField.value.trim() === itemCode.trim()) {
            return row;
        }
    }
    return null;
}

// Make save function globally available for testing
window.saveSalesInvoice = saveSalesInvoice;


// Run when window loads
window.onload = function() {
    adjustMainStyles();
};