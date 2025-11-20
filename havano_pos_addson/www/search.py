import frappe
from frappe import _
from frappe.utils import flt, now_datetime
from frappe.utils import format_datetime



@frappe.whitelist()
def ping():
    """
    Lightweight endpoint to keep session alive.
    """
    return "ok"


@frappe.whitelist()
def search_items(search_term, search_type="name"):
    """
    Search Items by name, item_name, or simple_code.
    For simple_code search, match the first 7 digits.
    """
    search_term = (search_term or "").strip()
    if not search_term:
        return []

    fields = ["name", "simple_code", "item_name", "description", "stock_uom", "valuation_rate", "scale_type"]

    if search_type != "code":
        # Normal search: name, item_name, simple_code contains term
        items = frappe.get_all(
            "Item",
            fields=fields,
            filters={
                "or": [
                    ["name", "like", f"%{search_term}%"],
                    ["item_name", "like", f"%{search_term}%"],
                    ["simple_code", "like", f"%{search_term}%"]
                ]
            },
            limit=20
        )
    else:
        # Code search: simple_code starts with first 7 digits OR name contains term
        search_prefix = search_term[:7] if len(search_term) > 7 else search_term

        items = frappe.db.sql(
            """
            SELECT name, simple_code, item_name, description, stock_uom, valuation_rate, scale_type
            FROM `tabItem`
            WHERE simple_code LIKE %(prefix)s OR name LIKE %(term)s
            LIMIT 20
            """,
            {"prefix": f"{search_prefix}%", "term": f"%{search_term}%"},
            as_dict=True
        )

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
def get_user_settings_dict():
    current_user = frappe.session.user
    settings = frappe.get_doc("HA POS Setting", "SETTINGS-01")
    
    # Check what’s actually in the table
    print("Child table rows:", settings.user_table_settin)
    
    for row in settings.user_table_settin:
        print(row.user, row.full_name, row.default_account)

    # Find the row
    user_row = next((row for row in settings.user_table_settin if row.user == current_user), None)
    
    if not user_row:
        return 

    # Convert row to dict
    user_dict = {field: getattr(user_row, field) for field in user_row.meta.get_valid_columns()}
    return user_dict



@frappe.whitelist()
def get_invoice_json(invoice_name):
    if get_user_settings_dict():
        """
        Returns a structured JSON for a given Sales Invoice
        """
        try:
            invoice = frappe.get_doc("Sales Invoice", invoice_name)

            company = frappe.get_doc("Company", invoice.company)

            # Build item list
            items = []
            for item in invoice.items:
                items.append({
                    "ProductName": item.item_name,
                    "productid": item.item_code,
                    "Qty": flt(item.qty),
                    "Price": flt(item.rate),
                    "Amount": flt(item.amount),
                    "tax_type": item.tax_type if hasattr(item, "tax_type") else "VAT",
                    "tax_rate": str(item.tax_rate) if hasattr(item, "tax_rate") else "15.0",
                    "tax_amount": str(item.tax_amount) if hasattr(item, "tax_amount") else "0.00"
                })

            data = {
                "CompanyName": company.company_name,
                "CompanyAddress": company.default_address or "",
                "City": company.city or "",
                "State": company.state or "",
                "postcode": company.pincode or "",
                "contact": company.phone or "",
                "CompanyEmail": company.email_id or "",
                "TIN": company.tax_id or "",
                "VATNo": company.vat or "",
                "Tel": company.phone or "",
                "InvoiceNo": invoice.name,
                "InvoiceDate":str(invoice.creation),
                "CashierName": invoice.owner,
                "CustomerName": invoice.customer_name,
                "CustomerContact": invoice.contact_display or invoice.customer_name,
                "CustomerTradeName": getattr(invoice, "customer_trade_name", None),
                "CustomerEmail": invoice.contact_email or None,
                "CustomerTIN": getattr(invoice, "tax_id", None),
                "CustomerVAT": getattr(invoice, "vat_number", None),
                "Customeraddress": invoice.customer_address or None,
                "itemlist": items,
                "AmountTendered": str(invoice.paid_amount),
                "Change": str(invoice.outstanding_amount),
                "Currency": invoice.currency,
                "Footer": "Thank you for your purchase!",
                "MultiCurrencyDetails": [
                    {
                        "Key": invoice.currency,
                        "Value": flt(invoice.grand_total)
                    }
                ],
                "DeviceID": getattr(invoice, "device_id", "None"),
                "DeviceSerial": getattr(invoice, "device_serial", ""),
                "FiscalDay": "",
                "ReceiptNo": "",
                "CustomerRef": getattr(invoice, "customer_ref", "None"),
                "VCode": "",
                "QRCode": "",
                "DiscAmt": str(flt(invoice.discount_amount)),
                "Subtotal": flt(invoice.base_net_total),
                "TotalVat": str(flt(invoice.total_taxes_and_charges)),
                "GrandTotal": flt(invoice.grand_total),
                "TaxType": "Standard VAT",
                "PaymentMode": invoice.payment_terms_template or "Cash"
            }

            return data

        except frappe.DoesNotExistError:
            frappe.throw("Sales Invoice {0} does not exist".format(invoice_name))
        except Exception as e:
            frappe.throw("Error generating invoice JSON: {0}".format(str(e)))


import frappe

@frappe.whitelist()
def get_item_price_by_simple_code(simple_code, price_list="Standard Selling"):
    """
    Returns the item info and price from a specific price list based on the simple_code
    """
    # Get the item by simple_code
    item = frappe.db.get_value(
        "Item",
        {"simple_code": simple_code},
        ["name", "item_name", "stock_uom"],
        as_dict=True
    )
    if not item:
        return {"error": "Item not founds"}

    # Get the actual price from the price list
    price = frappe.db.get_value(
        "Item Price",
        {"item_code": item.name, "price_list": price_list},
        "price_list_rate"
    ) or 0.0

    return {
        "item_code": item.name,
        "item_name": item.item_name,
        "uom": item.stock_uom or "Nos",
        "price": price
    }


@frappe.whitelist()
def create_quotation(customer, items, company=None):
    """
    Creates a Quotation from POS item rows
    items = [{item_code, qty, rate, amount}]
    """

    try:
        items = frappe.parse_json(items)

        if not company:
            company = frappe.db.get_single_value("Global Defaults", "default_company")

        quotation = frappe.new_doc("Quotation")
        quotation.quotation_to = "Customer"
        quotation.party_name = customer
        quotation.company = company

        for it in items:
            quotation.append("items", {
                "item_code": get_item_id(it.get("item_code")),
                "qty": it.get("qty"),
                "rate": it.get("rate"),
            })

        quotation.save(ignore_permissions=True)

        return {
            "status": "success",
            "quotation_name": quotation.name
        }

    except Exception as e:
        frappe.log_error(frappe.get_traceback(), "POS Create Quotation Error")
        return {
            "status": "failed",
            "error": str(e)
        }


@frappe.whitelist()
def get_item_id(simple_code):
    """
    Returns the item 'name' (ID) for a given simple code.
    """
    if not simple_code:
        return {"error": "No simple code provided"}

    item = frappe.get_all(
        "Item",
        filters={"simple_code": simple_code},
        fields=["name"],
        limit=1
    )

    if item:
        return item[0].get("name")
    else:
        return {"error": f"No item found for simple code {simple_code}"}
