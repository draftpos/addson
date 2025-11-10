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



