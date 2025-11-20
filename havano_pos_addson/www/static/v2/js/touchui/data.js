// Load initial data
function loadInitialData() {
    showLoading();
        
    // console.log("loadInitialData", frappe.session.user);
    
    // First load settings, then customers and price lists
    loadPosSettings(function(settings) {
        // Store settings for later use
        let allSettings = settings;
        // console.log("loadPosSettings");
        // console.log("actual settings below----");
        // console.log(allSettings);
        
        // Now load customers and price lists
        loadCustomers(function() {
            loadPriceLists(function() {
                // Load item groups
                loadItemGroups(function() {
                    // console.log('Item groups loaded, setting default values...');
                    // Set default values after all dropdowns are populated
                    if (allSettings.length > 0) {
                        setDefaultValues(allSettings[0]);
                    }
                    
                    // Finally load items
                    loadAllItems(function() {
                        // console.log('All items loaded, hiding loading...');
                        hideLoading();
                    });
                });
            });
        });
    });

}

// Load POS settings
function loadPosSettings(callback) {
    frappe.call({
        method: "frappe.client.get_list",
        headers: { 'X-Frappe-CSRF-Token': frappe.csrf_token },
        args: {
            doctype: "HA POS Setting",
            fields: ["ha_pos_settings_on", "ha_on_pres_enter", "default_customer", "default_price_list"],
            limit: 2
        },
        callback: function(response) {
            if (response.message && response.message.length > 0) {
                const settings = response.message[0];
                
                // Validate default customer
                if (!settings.default_customer) {
                    hideLoading();
                    frappe.msgprint({
                        title: __('POS Configuration Error'),
                        indicator: 'red',
                        message: __('Default Customer is not set in POS Settings. Please configure POS Settings before using POS.')
                    });
                    // Prevent POS from loading
                    setTimeout(function() {
                        window.location.href = '/app';
                    }, 3000);
                    return;
                }
                
                // Validate default customer has price list
                validateCustomerPriceList(settings, function(isValid) {
                    if (isValid) {
                        if (callback) callback(response.message);
                    } else {
                        hideLoading();
                        frappe.msgprint({
                            title: __('POS Configuration Error'),
                            indicator: 'red',
                            message: __('Default Customer does not have a Default Price List set. Please configure the customer before using POS.')
                        });
                        // Prevent POS from loading
                        setTimeout(function() {
                            window.location.href = '/app';
                        }, 3000);
                    }
                });
            } else {
                hideLoading();
                frappe.msgprint({
                    title: __('POS Configuration Error'),
                    indicator: 'red',
                    message: __('POS Settings not found. Please configure POS Settings before using POS.')
                });
                setTimeout(function() {
                    window.location.href = '/app';
                }, 3000);
            }
        },
        error: function(error) {
            hideLoading();
            showToast('Error loading POS settings', 'error');
            if (callback) callback([]);
        }
    });
}

// Validate that customer has a default price list
function validateCustomerPriceList(settings, callback) {
    if (!settings.default_customer) {
        if (callback) callback(false);
        return;
    }
    
    frappe.call({
        method: "frappe.client.get",
        headers: { 'X-Frappe-CSRF-Token': frappe.csrf_token },
        args: {
            doctype: "Customer",
            name: settings.default_customer,
            fields: ["name", "default_price_list"]
        },
        callback: function(response) {
            if (response.message) {
                const customer = response.message;
                if (customer.default_price_list) {
                    if (callback) callback(true);
                } else {
                    if (callback) callback(false);
                }
            } else {
                if (callback) callback(false);
            }
        },
        error: function(error) {
            if (callback) callback(false);
        }
    });
}

// Load customers
function loadCustomers(callback) {
    customerSelect.innerHTML = '<option value="">Select Customer</option>';
    frappe.call({
        method: "frappe.client.get_list",
        headers: { 'X-Frappe-CSRF-Token': frappe.csrf_token },
        args: {
            doctype: "Customer",
            fields: ["name", "customer_name"],
            limit: 100
        },
        callback: function(response) {
            if (response.message) {
                allCustomers = response.message;
                allCustomers.forEach(customer => {
                    const option = document.createElement('option');
                    option.value = customer.name;
                    option.textContent = customer.customer_name || customer.name;
                    customerSelect.appendChild(option);
                });
                if (callback) callback();
            } else {
                showToast('Failed to load customers', 'error');
                if (callback) callback();
            }
        },
        error: function(error) {
            showToast('Error loading customers', 'error');
            if (callback) callback();
        }
    });
}

// Load price lists
function loadPriceLists(callback) {
    priceListSelect.innerHTML = '<option value="">Select Price List</option>';
    
    frappe.call({
        method: "frappe.client.get_list",
        headers: { 'X-Frappe-CSRF-Token': frappe.csrf_token },
        args: {
            doctype: "Price List",
            fields: ["name", "price_list_name"],
            filters: { enabled: 1 }
        },
        callback: function(response) {
            if (response.message) {
                allPriceLists = response.message;
                allPriceLists.forEach(priceList => {
                    const option = document.createElement('option');
                    option.value = priceList.name;
                    option.textContent = priceList.price_list_name || priceList.name;
                    priceListSelect.appendChild(option);
                });
                if (callback) callback();
            } else {
                showToast('Failed to load price lists', 'error');
                if (callback) callback();
            }
        },
        error: function(error) {
            showToast('Error loading price lists', 'error');
            if (callback) callback();
        }
    });
}

// Load all items
function loadAllItems(callback) {
    console.log("getting all items");
    frappe.call({
        method: "frappe.client.get_list",
        headers: { 'X-Frappe-CSRF-Token': frappe.csrf_token },
        args: {
            doctype: "Item",
            fields: ["name", "item_name", "description", "stock_uom", "valuation_rate","simple_code"],
            limit: 1000
        },
        callback: function(response) {
            if (response.message) {
                allItems = response.message;
                if (callback) callback();
            } else {
                showToast('Failed to load items', 'error');
                if (callback) callback();
            }
        },
        error: function(error) {
            showToast('Error loading items', 'error');
            if (callback) callback();
        }
    });
}

// Set default values from settings
function setDefaultValues(data) {
    if (!data) return;
    
    // Set default customer
    if (data.default_customer) {
        // Try to find the customer option
        const customerOption = Array.from(customerSelect.options).find(
            option => option.value === data.default_customer
        );
        
        if (customerOption) {
            customerSelect.value = data.default_customer;
        } else {
            // If customer doesn't exist in options, try to load it
            frappe.call({
                method: "frappe.client.get",
                headers: { 'X-Frappe-CSRF-Token': frappe.csrf_token },
                args: {
                    doctype: "Customer",
                    name: data.default_customer
                },
                callback: function(response) {
                    if (response.message) {
                        const customer = response.message;
                        const option = document.createElement('option');
                        option.value = customer.name;
                        option.textContent = customer.customer_name || customer.name;
                        customerSelect.appendChild(option);
                        customerSelect.value = customer.name;
                    }
                }
            });
        }
    }
    
    // Set default price list
    if (data.default_price_list) {
        // Try to find the price list option
        const priceListOption = Array.from(priceListSelect.options).find(
            option => option.value === data.default_price_list
        );
        
        if (priceListOption) {
            priceListSelect.value = data.default_price_list;
        } else {
            // If price list doesn't exist in options, try to load it
            frappe.call({
                method: "frappe.client.get",
                headers: { 'X-Frappe-CSRF-Token': frappe.csrf_token },
                args: {
                    doctype: "Price List",
                    name: data.default_price_list
                },
                callback: function(response) {
                    if (response.message) {
                        const priceList = response.message;
                        const option = document.createElement('option');
                        option.value = priceList.name;
                        option.textContent = priceList.price_list_name || priceList.name;
                        priceListSelect.appendChild(option);
                        priceListSelect.value = priceList.name;
                    }
                }
            });
        }
    }
}







frappe.ready(function() {
    // Step 1: Get the currently logged-in user safely
    const current_user = frappe.session.user;
    if (!current_user) {
        console.log("No logged-in user found");
        return;
    }
    console.log("Current user:", current_user);

    // Step 2: Get the latest HA POS Setting (sorted by modified descending)
    frappe.call({
        method: "frappe.client.get_list",
        args: {
            doctype: "HA POS Setting",
            fields: ["name"],
            order_by: "modified desc",
            limit_page_length: 1
        },
        callback: function(setting_r) {
            if (!setting_r.message || setting_r.message.length === 0) {
                console.log("No HA POS Setting found");
                return;
            }

            const latest_setting_name = setting_r.message[0].name;

            // Step 3: Fetch the full parent document
            frappe.call({
                method: "frappe.client.get",
                args: {
                    doctype: "HA POS Setting",
                    name: latest_setting_name
                },
                callback: function(doc_r) {
                    const doc = doc_r.message;
                    if (!doc || !doc.user_table_selling_mode) {
                        console.log("No user_table_selling_mode found in the setting");
                        return;
                    }

                    // Step 4: Filter the child table for the current user
                    const user_modes = doc.user_table_selling_mode
                        .filter(row => row.user === current_user)
                        .map(row => row.mode);

                    // Step 5: Determine display text
                    let display_text = "Unknown";
                    if (user_modes.includes("Quotation") && user_modes.includes("Selling")) {
                        display_text = "Both";
                    } else if (user_modes.includes("Quotation")) {
                        display_text = "Quotation";
                    } else if (user_modes.includes("Selling")) {
                        display_text = "Selling";
                    }

                    // Step 6: Update the UI element
                    const mode_element = document.getElementById("selling-mode");
                    if (mode_element) {
                        mode_element.innerText = display_text;

                        // Optional: style like Frappe Quotation header
                        mode_element.style.fontWeight = "600";
                        mode_element.style.padding = "4px 8px";
                        mode_element.style.backgroundColor = "#f5f5f5";
                        mode_element.style.color = "gray";
                        mode_element.style.borderRadius = "4px";
                        mode_element.style.display = "inline-block";
                        mode_element.style.cursor = "pointer";
                    }

                    console.log("User modes:", user_modes);
                    let havano_pos_select_quotation = document.getElementById("havano-pos-select-quotation");
                    havano_pos_select_quotation.addEventListener("click", () => {showWiseCoQuotations()});
                
                }
            });
        }
    });


});






// THESE FUNCTIONS SHOW QUOTATIONS DIALOGS --------------------------------------
function showWiseCoQuotations() {
    // Fetch all quotations for wiseCo company
    let default_company = document.getElementById("default_company").value;
    console.log("default company----------------");
    console.log(default_company);
    frappe.call({
        method: "frappe.client.get_list",
        args: {
            doctype: "Quotation",
            filters: [
                ["company", "=", default_company]
            ],
            fields: ["name", "customer_name", "transaction_date", "grand_total", "status"],
            order_by: "creation desc"
        },
        callback: function(response) {
            if (response.message) {
                showQuotationDialog(response.message, default_company);
            }
        }
    });
}

function showQuotationDialog(quotations, default_company) {
    if (!quotations || quotations.length === 0) {
        frappe.msgprint(__(`No quotations found for ${default_company}`));
        return;
    }

    // Create the dialog
    const dialog = new frappe.ui.Dialog({
        title: __(`Quotations for ${default_company}`),
        // primary_action_label: __('Select Quotation'),
        // secondary_action_label: __('Cancel')
    });

    // Build HTML content with close button
    const htmlContent = `
        <div class="quotation-dialog-content">
            <div class="quotation-list-container" style="max-height: 400px; overflow-y: auto; margin: 15px 0;">
                <div class="quotation-list">
                    ${quotations.map(quotation => `
                        <div class="quotation-item" data-quotation-name="${quotation.name}" 
                             data-customer="${quotation.customer_name || 'N/A'}"
                             data-date="${quotation.transaction_date || 'N/A'}"
                             data-amount="${quotation.grand_total || 0}"
                             data-status="${quotation.status}">
                            <div class="quotation-header">
                                <strong class="quotation-name">${quotation.name}</strong>
                                <span class="quotation-status ${getStatusClass(quotation.status)}">
                                    ${quotation.status}
                                </span>
                            </div>
                            <div class="quotation-details">
                                <div>Customer: ${quotation.customer_name || 'N/A'}</div>
                                <div>Date: ${quotation.transaction_date || 'N/A'}</div>
                                <div>Amount: ${format_currency(quotation.grand_total || 0)}</div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
        <style>
            .quotation-dialog-content {
                position: relative;
            }
            .quotation-item {
                padding: 12px;
                border: 1px solid #d1d8dd;
                border-radius: 4px;
                margin-bottom: 8px;
                cursor: pointer;
                transition: all 0.2s ease;
                background: white;
            }
            .quotation-item:hover {
                background-color: #fafbfc;
                border-color: #8d98a5;
            }
            .quotation-item.selected {
                background-color: #f0f7ff;
                border-color: #2490ef;
            }
            .quotation-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 8px;
            }
            .quotation-name {
                color: #36414c;
                font-size: 13px;
            }
            .quotation-details {
                font-size: 12px;
                color: #8d98a5;
            }
            .quotation-details div {
                margin-bottom: 2px;
            }
            .quotation-status {
                padding: 2px 8px;
                border-radius: 10px;
                font-size: 10px;
                font-weight: 600;
            }
            .status-Open {
                background-color: #e8f4fd;
                color: #007bff;
            }
            .status-Submitted {
                background-color: #fff8dd;
                color: #ffc107;
            }
            .status-Ordered {
                background-color: #e7f7ed;
                color: #28a745;
            }
            .status-Lost, .status-Cancelled {
                background-color: #f8f9fa;
                color: #6c757d;
            }
            /* Close button styles */
            .modal-close-button {
                position: absolute;
                top: 10px;
                right: 15px;
                background: none;
                border: none;
                font-size: 20px;
                color: #8d98a5;
                cursor: pointer;
                padding: 5px;
                z-index: 1000;
            }
            .modal-close-button:hover {
                color: #36414c;
                background-color: #f5f7fa;
                border-radius: 50%;
            }
        </style>
    `;

    // Add HTML to dialog body
    dialog.$body.append(htmlContent);

    // Add close button to the dialog header
    const closeButton = $(`
        <button type="button" class="modal-close-button" aria-label="Close">
            &times;
        </button>
    `);
    
    // Add close button to the modal
    dialog.$wrapper.find('.modal-header').append(closeButton);

    let selectedQuotation = null;

    // Add click handler for close button
    closeButton.on('click', function() {
        console.log("Dialog closed by X button");
        dialog.hide();
    });

    // Add click handlers for quotation items
    dialog.$body.find('.quotation-item').on('click', function() {
        const $this = $(this);
        
        // Remove selected class from all items
        dialog.$body.find('.quotation-item').removeClass('selected');
        
        // Add selected class to clicked item
        $this.addClass('selected');
        
        // Store selected quotation data
        selectedQuotation = {
            name: $this.data('quotation-name'),
            customer: $this.data('customer'),
            date: $this.data('date'),
            amount: $this.data('amount'),
            status: $this.data('status')
        };
        
        console.log("Currently selected:", selectedQuotation);
    });

    // Override primary action
    dialog.set_primary_action(() => {
        if (selectedQuotation) {
            console.log("Selected Quotation:", selectedQuotation);
            frappe.show_alert({
                message: __('Selected quotation: ') + selectedQuotation.name,
                indicator: 'green'
            });
            dialog.hide();
        } else {
    
        }
    });

    // Also close when clicking outside the dialog (modal backdrop)
    dialog.$wrapper.on('click', function(e) {
        if (e.target === this) {
            console.log("Dialog closed by clicking outside");
            dialog.hide();
        }
    });

    dialog.show();
}

function getStatusClass(status) {
    return 'status-' + (status || 'Open');
}

// ------------------------------------------------------------------------------