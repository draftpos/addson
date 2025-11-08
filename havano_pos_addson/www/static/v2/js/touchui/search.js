// Search items with type parameter (code or name)
function searchItems(searchTerm, searchType = 'name') {
    frappe.call({
        method: "havano_pos_addson.www.search.search_items", // update with your app name
        args: { search_term: searchTerm, search_type: searchType },
        callback: function(response) {
            if (response.message) {
                currentSearchResults = response.message;
                const itemsWithPrice = response.message.map(item => ({
                    ...item,
                    price_list_rate: item.valuation_rate,
                    actual_qty: 1
                }));
                displaySearchResults(itemsWithPrice,searchTerm);
            }
        }
    });
}
   var foundornot = true;

// Display search results
function displaySearchResults(items,searchTerm) {
        setTimeout(() => {
    }, 1000); // 1000 ms = 1 second

    searchDropdown.innerHTML = '';
    foundornot = false;
    
    if (items.length === 0) {
        searchDropdown.innerHTML = '<div class="ha-search-result-item">No items found</div>';
        // showHaPopupCustom('Item not found')
     
        console.log(foundornot);
       
        return;
    }
    else{
          foundornot=true;

    }
    
    items.forEach((item, index) => {

      
        const resultItem = document.createElement('div');
        resultItem.className = 'ha-search-result-item';
        if (index === 0) resultItem.classList.add('ha-search-result-active');
        resultItem.innerHTML = `
            <div>
                <span class="ha-item-code">${item.name}</span>
                <span class="ha-item-name">${item.item_name || item.name}</span>
            </div>
            <div class="ha-item-price">$${(item.valuation_rate || 0).toFixed(2)}</div>
        `;
        
        resultItem.addEventListener('click', () => {
            const result = selectItem(item, activeItemField.closest('tr'),searchTerm);
            searchDropdown.style.display = 'none';
            isInSearchMode = false;
            
            if (result === 'new_item_added') {
                // Item was added to a new row, navigate to next row
                const currentRow = activeItemField.closest('tr');
                const nextRow = currentRow.nextElementSibling;
                
                if (nextRow) {
                    // Focus on item code field of next row
                    nextRow.querySelector('.item-code').focus();
                    nextRow.querySelector('.item-code').select();
                } else {
                    // If no next row, add new row and focus on item code
                    addNewRow();
                    const newRow = itemsTableBody.lastChild;
                    newRow.querySelector('.item-code').focus();
                    newRow.querySelector('.item-code').select();
                }
            } else if (result === 'quantity_increased') {
                // Item quantity was increased, stay on current field
                activeItemField.focus();
                activeItemField.select();
            } else {
                // If item selection failed, focus back on the current item code field
                activeItemField.focus();
                activeItemField.select();
            }
        });
        
        searchDropdown.appendChild(resultItem);
    });
}

// Position dropdown
function positionDropdown(element) {
    const rect = element.getBoundingClientRect();
    searchDropdown.style.display = 'block';
    searchDropdown.style.width = '400px';
    
    // Adjust position if near bottom of screen
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    
    if (spaceBelow < 300 && spaceAbove > 300) {
        // Show above the input field
        searchDropdown.style.top = (rect.top + window.scrollY - 300) + 'px';
    } else {
        // Show below the input field
        searchDropdown.style.top = (rect.bottom + window.scrollY) + 'px';
    }
    
    searchDropdown.style.left = rect.left + 'px';
}

// Show item search dropdown
function showItemSearchDropdown(field) {
    activeItemField = field;
    positionDropdown(field);
    displaySearchResults(allItems.slice(0, 10));

}
var bb="new";



// Keep track of the last row where an item was added

lastAddedRoww = null;
function selectItem(item, row, searchTerm) {
    console.log(item);
    // Remove empty rows above before selecting the item
    removeEmptyRowsAbove(row);

    const itemRate = parseFloat(item.valuation_rate) || 0;
    const itemDescription = item.description || '';
    const isGiftItem = itemDescription.toLowerCase().includes('gift');

    // Handle zero rate for non-gift items
    if (itemRate === 0 && !isGiftItem) {
        const itemName = item.item_name || item.name || 'Unknown Item';
        frappe.msgprint(`Item "${itemName}" rate is empty. Please contact admin to add rate for this item.`);

        row.querySelector('.item-code').value = '';
        row.querySelector('.item-name').value = '';
        row.querySelector('.item-uom').value = 'Nos';
        row.querySelector('.item-rate').value = '0.00';
        row.querySelector('.item-qty').value = '1';
        row.querySelector('.item-amount').value = '0.00';
        updateTotals();

        isInSearchMode = false;
        currentSearchTerm = '';
        return false;
    }

    // --- Check if last added row has the same item ---
    if (lastAddedRoww) {
        const lastItemCode = lastAddedRoww.querySelector('.item-code').value;

        console.log(lastItemCode);
        console.log(item.name);
        if (lastItemCode === (item.name || searchTerm)) {
            bb="not new";
            let qtyField = lastAddedRoww.querySelector('.item-qty');
            let currentQty = parseFloat(qtyField.value) || 0;

            if (item.scale_type === "Weight Based Scale") {
                let middlePart = String(searchTerm).slice(7, -1);
                let numericValue = parseInt(middlePart, 10) || 0;
                currentQty += numericValue / 1000;
            } else {
                currentQty += 1;
            }

            qtyField.value = currentQty.toFixed(3);
            updateItemAmount(qtyField);
            updateTotals();

            qtyField.focus();
            qtyField.select();

            isInSearchMode = false;
            currentSearchTerm = '';
            return 'quantity_increased';
        }
    }

    // --- Otherwise, populate the current row as new item ---
    if (item.scale_type === "Weight Based Scale") {
        let middlePart = String(searchTerm).slice(7, -1);
        let numericValue = parseInt(middlePart, 10) || 0;
        let finalValue = numericValue / 1000;

        row.querySelector('.item-code').value = searchTerm;
        row.querySelector('.item-name').value = item.item_name || item.name;
        row.querySelector('.item-rate').value = itemRate.toFixed(2);
        row.querySelector('.item-uom').value = item.stock_uom || 'Nos';
        row.querySelector('.item-qty').value = finalValue;
    } else {
        bb="new";
        row.querySelector('.item-code').value = item.name;
        row.querySelector('.item-name').value = item.item_name || item.name;
        row.querySelector('.item-rate').value = itemRate.toFixed(2);
        row.querySelector('.item-uom').value = item.stock_uom || 'Nos';
        row.querySelector('.item-qty').value = 1;
    }

    updateItemAmount(row.querySelector('.item-qty'));
    updateTotals();

    // Update the last added row reference
    lastAddedRoww = row;

    isInSearchMode = false;
    currentSearchTerm = '';

    return 'new_item_added';
}
