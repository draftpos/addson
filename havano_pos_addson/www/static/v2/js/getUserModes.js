function UserModes(callback) {
    frappe.call({
        method: "frappe.client.get_list",
        args: {
            doctype: "HA POS Setting",
            fields: ["name", "default_payment_method", "selected_payment_methods"],
            filters: {
                ha_pos_settings_on: 1   // ✅ fetch the active POS setting
            },
            limit: 1
        },
        callback: function(response) {
            if (response.message && response.message.length > 0) {
                const settingName = response.message[0].name;

                // Now fetch the full parent document to include child table rows
                frappe.call({
                    method: "frappe.client.get",
                    args: {
                        doctype: "HA POS Setting",
                        name: settingName
                    },
                    callback: function(res2) {
                        if (res2.message) {
                            const doc = res2.message;
                            console.log("FETH USER MODES RUN ------------------------");
                            // console.log(doc);
                            const allItems = doc.user_table_selling_mode || [];
                            console.log(allItems);
                            // // save to local storage
                            localStorage.setItem("havano_pos_usermodes", JSON.stringify(allItems));

                            // if (callback) callback(allItems, doc.user_selling_mode);
                        } else {
                            showToast('No usermodes methods found', 'error');
                            if (callback) callback([]);
                        }
                    },
                    error: function() {
                        showToast('Error loading POS Setting', 'error');
                        if (callback) callback([]);
                    }
                });
            } else {
                showToast('No active POS Setting found', 'error');
                if (callback) callback([]);
            }
        },
        error: function() {
            showToast('Error loading settings', 'error');
            if (callback) callback([]);
        }
    });
}

// usage
// UserModes(function(allItems, user_table_selling_mode) {
//     console.log("USER PAYMENT MODES HAS RUN ------------------");
//     console.log("Default Payment Method:", user_table_selling_mode);
//     console.log("Selected Payment Methods:", allItems);
// });

UserModes();
