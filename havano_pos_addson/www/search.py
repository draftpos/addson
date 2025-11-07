import frappe


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
