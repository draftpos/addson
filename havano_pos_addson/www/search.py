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



import frappe
from frappe.utils import flt, now_datetime

@frappe.whitelist()
def get_invoice_json(invoice_name):
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
            "InvoiceDate": str(invoice.posting_date),
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
