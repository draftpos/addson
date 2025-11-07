import frappe
from frappe import _


@frappe.whitelist()
def search_items(search_term, search_type="name"):
    """
    Search Items by name, item_name, or simple_code.
    For simple_code search, match the first 7 digits.
    """
    search_term = search_term.strip()

    if search_type == "code":
        # Only search simple_code starting with the first 7 digits
        if len(search_term) > 7:
            search_prefix = search_term[:7]
        else:
            search_prefix = search_term

        filters = [["Item", "simple_code", "like", f"{search_prefix}%"]]
    else:
        filters = [
            ["Item", "name", "like", f"%{search_term}%"],
            "or",
            ["Item", "item_name", "like", f"%{search_term}%"],
            "or",
            ["Item", "simple_code", "like", f"%{search_term}%"]
        ]

    items = frappe.db.get_all(
        "Item",
        fields=["name", "item_name", "description", "stock_uom", "valuation_rate", "scale_type", "simple_code"],
        filters=filters,
        limit=20
    )

    # Always return at least one match if prefix matches
    return items




@frappe.whitelist()
def get_print_template():
    """
    Returns the 'print_template' value for the HA POS Setting record SETTINGS-01
    """
    try:
        setting = frappe.get_doc("HA POS Setting", "SETTINGS-01")
        return setting.print_template

    except frappe.DoesNotExistError:
        frappe.throw(*("HA POS Setting record SETTINGS-01 does not exist"))
    except Exception as e:
        frappe.throw(*("Error fetching print template: {0}").format(str(e)))



@frappe.whitelist()
def get_invoice_json(invoice_name):
    """
    Given an invoice name, return all fields as JSON.
    """
    try:
        invoice = frappe.get_doc("Sales Invoice", invoice_name)
        return invoice.as_dict()  # Returns all fields as JSON
    except frappe.DoesNotExistError:
        return {"error": "Invoice not found"}
