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
    var custom_modes="";
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
                        display_text = "Quotation Only";
                        document.getElementById("payment_bttn").innerText = "Quotation";
                        
                    } else if (user_modes.includes("Selling")) {
                        display_text = "Selling Only";
                        
                    }


                    // Step 6: Update the UI element
                    const mode_element = document.getElementById("selling-mode");
                    if (mode_element) {
                        mode_element.innerText = display_text;

                        // Optional: style like Frappe Quotation header
                        mode_element.style.fontWeight = "600";
                        mode_element.style.padding = "4px 8px";
                        mode_element.style.backgroundColor = "#f5f5f5";
                        mode_element.style.borderRadius = "4px";
                        mode_element.style.display = "inline-block";
                        mode_element.style.cursor = "pointer";
                    }

                    console.log("User modes:", user_modes);
                    custom_modes=
                    
                    // Add click event to show Frappe-style UI
                    mode_element.addEventListener("click", () => {
                        showSellingModeDialog(user_modes);
                    });
                }
            });
        }
    });

    function showSellingModeDialog(user_modes) {
        // Build available modes
        const availableModes = [];
        
        if (user_modes.includes("Selling")) {
            availableModes.push({
                value: "Selling",
                label: "Selling Mode",
                description: "Process sales transactions and generate invoices",
                icon: "fa fa-shopping-cart",
                color: "#28a745"
            });
        }
        
        if (user_modes.includes("Quotation")) {
            availableModes.push({
                value: "Quotation", 
                label: "Quotation Mode",
                description: "Create and manage quotations for customers",
                icon: "fa fa-file-text",
                color: "#17a2b8"
            });
        }

        if (availableModes.length === 0) {
            frappe.msgprint(__('No selling modes available for your user.'));
            return;
        }

        if (availableModes.length === 1) {
            // If only one mode is available, auto-select it
            handleModeSelection(availableModes[0].value);
            return;
        }

        // Create dialog using frappe.msgprint with custom HTML
        let dialog_html = `
            <div class="mode-selection-dialog">
                <div class="mode-selection-container">
                    ${availableModes.map((mode, index) => `
                        <div class="mode-card ${index === 0 ? 'active' : ''}" data-mode="${mode.value}">
                            <div class="mode-icon" style="color: ${mode.color}">
                                <i class="${mode.icon}"></i>
                            </div>
                            <div class="mode-content">
                                <div class="mode-title">${mode.label}</div>
                                <div class="mode-description">${mode.description}</div>
                            </div>
                            <div class="mode-check">
                                <i class="fa fa-check text-primary"></i>
                            </div>
                        </div>
                    `).join('')}
                </div>
                <div class="mode-dialog-actions">
                    <button class="btn btn-primary btn-confirm">Confirm Selection</button>
                    <button class="btn btn-secondary btn-cancel">Cancel</button>
                </div>
            </div>
            <style>
                .mode-selection-dialog {
                    min-width: 400px;
                    padding: 10px 0;
                }
                .mode-selection-container {
                    margin-bottom: 20px;
                }
                .mode-card {
                    display: flex;
                    align-items: center;
                    padding: 12px 15px;
                    border: 1px solid #d1d8dd;
                    border-radius: 6px;
                    margin-bottom: 10px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    background: white;
                }
                .mode-card:hover {
                    border-color: #8d98a5;
                    background: #fafbfc;
                }
                .mode-card.active {
                    border-color: #2490ef;
                    background: #f0f7ff;
                }
                .mode-icon {
                    font-size: 20px;
                    margin-right: 15px;
                    width: 40px;
                    text-align: center;
                }
                .mode-content {
                    flex: 1;
                }
                .mode-title {
                    font-weight: 600;
                    color: #36414c;
                    margin-bottom: 2px;
                }
                .mode-description {
                    font-size: 12px;
                    color: #8d98a5;
                }
                .mode-check {
                    display: none;
                    color: #2490ef;
                }
                .mode-card.active .mode-check {
                    display: block;
                }
                .mode-dialog-actions {
                    display: flex;
                    gap: 10px;
                    justify-content: flex-end;
                }
            </style>
        `;

        // Create custom dialog
        const dialog = new frappe.ui.Dialog({
            title: __('Select Selling Mode'),
            primary_action_label: __('Confirm'),
            secondary_action_label: __('Cancel')
        });

        // Add custom HTML to dialog body
        dialog.$body.append(dialog_html);

        let selected_mode = availableModes[0].value;

        // Add click handlers for mode cards
        dialog.$body.find('.mode-card').on('click', function() {
            const $this = $(this);
            dialog.$body.find('.mode-card').removeClass('active');
            $this.addClass('active');
            selected_mode = $this.data('mode');
        });

        // Override primary action
        dialog.set_primary_action(() => {
            handleModeSelection(selected_mode);
            dialog.hide();
        });

        dialog.show();
    }

    function handleModeSelection(selectedMode) {
        console.log("Selected mode:", selectedMode);
        
        // Update the display text
        const mode_element = document.getElementById("selling-mode");
        if (mode_element) {
            mode_element.innerText = selectedMode === "Quotation" ? "Quotation Mode" : "Selling Mode";
            
        }

        // Show success message
        frappe.show_alert({
            message: __(`Switched to ${selectedMode} mode`),
            indicator: 'green'
        });

        // Here you can add additional logic based on the selected mode
        if (selectedMode === "Quotation") {
            enableQuotationMode();
        } else {
            enableSellingMode();
        }
    }

    function enableQuotationMode() {
        // Add your Quotation mode logic here
        console.log("Quotation mode enabled");
        
        frappe.show_alert({
            message: __('Quotation features are now active'),
            indicator: 'blue'
        });
    }

    function enableSellingMode() {
        // Add your Selling mode logic here
        console.log("Selling mode enabled");
        
        frappe.show_alert({
            message: __('Selling features are now active'),
            indicator: 'green'
        });
    }

    function changePaymentsButton(){
          var mode_element = document.getElementById("selling-mode");
          console.log("------------------mode"+mode_element.innerText);
          if (mode_element.innerText === "Quotation Only") {
              document.getElementById("payment_bttn").innerText = "Receive Payment";
          }
          else{
            console.log("ssssssssssssssssssss");
          
          }
    }
    changePaymentsButton();
});