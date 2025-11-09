import frappe
from frappe import _

@frappe.whitelist()
def get_customers():
    """Get all active customers"""
    customers = frappe.get_all("Customer",
        fields=["name", "customer_name"],
        filters={"disabled": 0},
        order_by="customer_name"
    )
    return customers

@frappe.whitelist()
def get_price_lists():
    """Get all selling price lists"""
    price_lists = frappe.get_all("Price List",
        fields=["name", "price_list_name"],
        filters={"enabled": 1, "selling": 1},
        order_by="name"
    )
    return price_lists

@frappe.whitelist()
def search_items(search_term=None):
    """Search for items by name or code"""
    filters = {"disabled": 0}
    
    if search_term:
        filters["item_name"] = ["like", f"%{search_term}%"]
    
    items = frappe.get_all("Item",
        fields=["name", "item_code", "item_name", "description", "stock_uom", "standard_rate"],
        filters=filters,
        order_by="item_name",
        limit=20
    )
    return items


@frappe.whitelist()
def get_item_groups():
    """Get all item groups that contain at least one item (regardless of having subgroups)"""
    # Get all item groups with their item count
    item_groups = frappe.db.sql("""
        SELECT 
            ig.name,
            ig.item_group_name,
            (SELECT COUNT(*) 
             FROM `tabItem` i 
             WHERE i.item_group = ig.name 
             AND i.disabled = 0) as item_count
        FROM `tabItem Group` ig
        ORDER BY ig.item_group_name
    """, as_dict=True)
    
    # Filter to only include groups that have at least one item
    # Include groups even if they have subgroups
    filtered_groups = [
        {
            "name": group.name,
            "item_group_name": group.item_group_name
        }
        for group in item_groups
        if group.item_count > 0
    ]
    
    return filtered_groups

@frappe.whitelist()
def get_items_by_group(item_group=None, page=0, page_size=20):
    """Get items by item group with pagination"""
    try:
        page = int(page)
        page_size = int(page_size)
        start = page * page_size
        
        filters = {"disabled": 0}
        
        if item_group:
            filters["item_group"] = item_group
        
        # Get total count
        total_count = frappe.db.count("Item", filters=filters)
        
        # Get items with pagination
        items = frappe.get_all("Item",
            fields=["name", "item_name", "simple_code","description", "stock_uom", "valuation_rate", "item_group"],
            filters=filters,
            order_by="item_name",
            start=start,
            page_length=page_size
        )
        
        return {
            "items": items,
            "total_count": total_count,
            "page": page,
            "page_size": page_size,
            "total_pages": (total_count + page_size - 1) // page_size if page_size > 0 else 0
        }
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Get Items By Group Error")
        return {
            "items": [],
            "total_count": 0,
            "page": 0,
            "page_size": page_size,
            "total_pages": 0,
            "error": str(e)
        }




@frappe.whitelist()
def get_default_company():
    print("-------------company-------------------------------")
    """
    Returns the default company for the current site or user
    """
    try:
        company = frappe.defaults.get_user_default("Company") or frappe.defaults.get_global_default("default_company")
        return {"company_name": company}
    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "Get Default Company Error")
        return {"company_name": ""}
