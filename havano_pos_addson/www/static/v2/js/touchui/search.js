// Search items with type parameter (code or name)
var searchTermCalculation="";
function searchItems(searchTerm, searchType = 'name') {
    console.log("another-----------"+searchTerm);
    searchTermCalculation=searchTerm;
   
    searchTermCalculation=searchTerm;
    frappe.call({
        method: "havano_pos_addson.www.search.search_items", // update with your app name
        headers: { 'X-Frappe-CSRF-Token': frappe.csrf_token },
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
console.log("----------search term------"+searchTermCalculation);
// Display search results
function displaySearchResults(items,searchTerm) {
        setTimeout(() => {
    }, 1000); // 1000 ms = 1 second

    searchDropdown.innerHTML = '';
    foundornot = false;
    
    if (items.length === 0) {
       
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
                <span class="ha-item-code">${item.simple_code}</span>
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
    if (!item.simple_code) {
        frappe.msgprint(`Item "${item.item_name}" doesnt have simple code. Please contact admin to add simple code.`);
        return false;
    }
    frappe.call({
        method: "havano_pos_addson.www.search.get_item_price_by_simple_code",
        headers: { 'X-Frappe-CSRF-Token': frappe.csrf_token },
        args: {
            simple_code: item.simple_code,
            price_list: "Standard Selling"
        },
        callback: function(r) {
            var real_price = 0;

            if (r.message && !r.message.error) {
                console.log("Item price:", r.message.price);
                real_price = r.message.price;
            } else if (r.message && r.message.error) {
                console.error("Error from server:", r.message.error);
            } else {
                console.log("No item found for simple code:", item.simple_code);
            }

            console.log(item);
            removeEmptyRowsAbove(row);
            console.log("Real price is " + real_price);

            const itemRate = real_price || 0;
            const itemDescription = item.description || '';
            const isGiftItem = itemDescription.toLowerCase().includes('gift');

            if (itemRate === 0 && !isGiftItem) {
                const itemName = item.item_name || item.name || 'Unknown Item';
                frappe.msgprint(`Item "${itemName}" price not set. Please contact admin to set price.`);

                row.querySelector('.item-code').value = '';
                row.querySelector('.item-name').value = '';
                row.querySelector('.item-uom').value = 'Nos';
                row.querySelector('.item-rate').value = '0.00';
                row.querySelector('.item-qty').value = '1';
                row.querySelector('.item-amount').value = '0.00';
                updateTotals();

                isInSearchMode = false;
                currentSearchTerm = '';
                return;
            }

            // Check if last added row has the same item
            if (lastAddedRoww) {
                const lastItemCode = lastAddedRoww.querySelector('.item-code').value;

                if (lastItemCode === (item.simple_code || searchTerm)) {
                    bb = "not new";
                    console.log("not addin")
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

                    // qtyField.focus();
                    // qtyField.select();

                    isInSearchMode = false;
                    currentSearchTerm = '';
                    return; // stop here, no new row
                }
            }

            // Populate current row as new item
            if (item.scale_type === "Weight Based Scale") {
                let middlePart = String(searchTermCalculation).slice(7, -1);
                let numericValue = parseInt(middlePart, 10) || 0;
                let finalValue = numericValue / 1000;

                row.querySelector('.item-code').value = searchTermCalculation;
                row.querySelector('.item-name').value = item.item_name || item.name;
                row.querySelector('.item-rate').value = itemRate.toFixed(2);
                row.querySelector('.item-uom').value = item.stock_uom || 'Nos';
                row.querySelector('.item-qty').value = finalValue;
            } else {
                console.log("adding new product")
                bb = "new";
                row.querySelector('.item-code').value = item.simple_code;
                row.querySelector('.item-name').value = item.item_name || item.name;
                row.querySelector('.item-rate').value = itemRate.toFixed(2);
                row.querySelector('.item-uom').value = item.stock_uom || 'Nos';
                row.querySelector('.item-qty').value = 1;
            }

            updateItemAmount(row.querySelector('.item-qty'));
            updateTotals();

            // Update the last added row reference
            lastAddedRoww = row;

            // Add a new row after current
            const nextRow = row.nextElementSibling;
            if (!nextRow) {
                addNewRow(); // <-- this ensures new row is added
            }

            isInSearchMode = false;
            currentSearchTerm = '';
        },
        error: function(err) {
            console.error("Request failed:", err);
        }
    });
}

function loggedin(){
             frappe.call({
                method: "havano_pos_addson.havano_pos_addson.doctype.havano_pos_entry.havano_pos_entry.user_permitted",
                args: {},
                async: true,
                callback: function(r) {
                    if (r.message === "200") {
                       console.log(r.message);
                    }
                    else{
                        window.location.href = "/login";

                    }
                }
            });}
document.addEventListener("DOMContentLoaded", loggedin);

let timeout = null;

const input = document.getElementById("quotation_search");
const results = document.getElementById("results_box");

input.addEventListener("input", () => {
    clearTimeout(timeout);

    const txt = input.value.trim();
    if (!txt) {
        results.style.display = "none";
        return;
    }

    timeout = setTimeout(() => searchQuotation(txt), 300);
});


function searchQuotation(text) {
    frappe.call({
        method: "havano_pos_addson.www.search.search_quotations",
        args: { search: text },
        callback(r) {
            const list = r.message || [];
            if (!list.length) {
                results.style.display = "none";
                return;
            }

            results.innerHTML = "";
            list.forEach(q => {
                const item = document.createElement("div");
                item.classList.add("item");
                item.textContent = q.name;

                // CLICK EVENT ON THE QUOTATION
                item.addEventListener("click", () => {
                    input.value = q.name;      // populate input
                    results.style.display = "none";

                

                    // Example: call another function
                    handleQuotationClick(q);
                });

                results.appendChild(item);
            });

            results.style.display = "block";
        }
    });
}

input.addEventListener("dblclick", () => {
    searchQuotation(""); // empty string will return first 10
});


function handleQuotationClick(quotation) {
    console.log("Quotation selected:", quotation.name);

    frappe.call({
        method: "havano_pos_addson.www.search.get_quotation",
        args: { name: quotation.name },
        callback(r) {
            const q = r.message;

            // Just log the full quotation object
            console.log("Full quotation:", q);
            console.log("Items:", q.items);
            populateItemsFromList(q.items);
        }
    });
}


// Populate multiple items from a list (e.g., quotation items)
function populateItemsFromList(itemsList) {
    if (!itemsList || itemsList.length === 0) return;

    let currentRow = itemsTableBody.querySelector('tr'); // first row

    itemsList.forEach((item, index) => {
        // If no row exists, add one
        if (!currentRow) {
            addNewRow();
            currentRow = itemsTableBody.lastChild;
        }

        // We reuse your selectItem logic but slightly adapted
        populateRowWithItem(item, currentRow);

        // Move to next row for next item
        currentRow = currentRow.nextElementSibling;
    });

    // Update totals after all items
    updateTotals();
}
// Populate multiple items from a list (e.g., quotation items)
function populateItemsFromList(itemsList) {
    if (!itemsList || itemsList.length === 0) return;

    let currentRow = itemsTableBody.querySelector('tr'); // first row

    itemsList.forEach((item, index) => {
        // If no row exists, add one
        if (!currentRow) {
            addNewRow();
            currentRow = itemsTableBody.lastChild;
        }

        // We reuse your selectItem logic but slightly adapted
        populateRowWithItem(item, currentRow);

        // Move to next row for next item
        currentRow = currentRow.nextElementSibling;
    });

    // Update totals after all items
    updateTotals();
}

// Adapted selectItem logic for direct row population (no search)
function populateRowWithItem(item, row) {
    if (!item.item_code && !item.simple_code) {
        frappe.msgprint(`Item "${item.item_name || item.name}" doesn't have a simple code. Please contact admin.`);
        return;
    }
    console.log("simple code is here:" + item.simple_code);

    let simple_code = item.simple_code || item.item_code;

    frappe.call({
        method: "havano_pos_addson.www.search.get_item_price_by_simple_code",
        headers: { 'X-Frappe-CSRF-Token': frappe.csrf_token },
        args: {
            simple_code: simple_code,
            price_list: "Standard Selling"
        },
        callback: function(r) {
            let real_price = (r.message && !r.message.error) ? r.message.price : 0;
            const itemRate = real_price || 0;

            // Populate the row
            row.querySelector('.item-code').value = item.simple_code;
            row.querySelector('.item-name').value = item.item_name || item.name;
            row.querySelector('.item-rate').value = item.rate
            row.querySelector('.item-uom').value = item.stock_uom || 'Nos';
            row.querySelector('.item-qty').value = item.qty || 1;

            updateItemAmount(row.querySelector('.item-qty'));
            lastAddedRoww = row;

            // Add a new row if needed
            if (!row.nextElementSibling) {
                addNewRow();
            }
        },
        error: function(err) {
            console.error("Failed to fetch price for", simple_code, err);
        }
    });
}
let customerTimeout = null;
const customerInput = document.getElementById("customer_search");
const customerResults = document.getElementById("customer_results_box");

// Search as typing
customerInput.addEventListener("input", () => {
    clearTimeout(customerTimeout);
    const txt = customerInput.value.trim();
    if (!txt) {
        customerResults.style.display = "none";
        return;
    }
    customerTimeout = setTimeout(() => searchCustomer(txt), 300);
});

// Double-click → show first 10 customers
customerInput.addEventListener("dblclick", () => {
    searchCustomer("");
});

function searchCustomer(text) {
    frappe.call({
        method: "havano_pos_addson.www.search.search_customers",
        args: { search: text },
        callback(r) {
            const list = r.message || [];
            customerResults.innerHTML = "";

            if (!list.length) {
                // If no customer found, show "Create Customer" button
                const createBtn = document.createElement("div");
                createBtn.textContent = "➕ Create Customer";
                createBtn.classList.add("create_button");
                createBtn.onclick = () => {
                    console.log("Create customer clicked");
                    // You can call your create customer function here
                };
                customerResults.appendChild(createBtn);
                customerResults.style.display = "block";
                return;
            }

            // Add customer items
            list.forEach(c => {
                const item = document.createElement("div");
                item.classList.add("item");
                item.textContent = c.customer_name;
                item.onclick = () => {
                    customerInput.value = c.customer_name;
                    customerResults.style.display = "none";

                    // Log full customer object
                    console.log("Customer selected:", c);
                };
                customerResults.appendChild(item);
            });

            // Add "Create Customer" button at the bottom
            const createBtn = document.createElement("div");
            createBtn.textContent = "➕ Create Customer";
            createBtn.classList.add("create_button");

            createBtn.classList.add("create_button");
            createBtn.onclick = () => {
                console.log("Create customer clicked");
            };
            customerResults.appendChild(createBtn);

            customerResults.style.display = "block";
        }
    });
}

// Optional: click outside to close
document.addEventListener("click", e => {
    if (!customerResults.contains(e.target) && e.target !== customerInput) {
        customerResults.style.display = "none";
    }
});
document.addEventListener("click", e => {
    if (!results.contains(e.target) && e.target !== input) {
        results.style.display = "none";
    }
});
