import frappe

def execute():
    # Load Item DocType
    item = frappe.get_doc("DocType", "Item")

    # Check if the field already exists
    exists = any(f.fieldname == "simple_code" for f in item.fields)

    if not exists:
        item.append("fields", {
            "fieldname": "simple_code",
            "label": "Simple Code",
            "fieldtype": "Data",
            "insert_after": "stock_uom"
        })
        item.save()

    frappe.clear_cache()
