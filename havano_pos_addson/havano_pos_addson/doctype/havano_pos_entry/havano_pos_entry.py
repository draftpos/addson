import frappe
from frappe.model.document import Document
from frappe.utils import nowdate


class HavanoPOSEntry(Document):
    def validate(self):
        if self.amount and self.amount < 0:
            frappe.throw("Amount cannot be negative.")

        if not self.payment_method:
            frappe.throw("Payment Method is required.")

        # if self.shift_name:
        #     exists = frappe.db.exists(
        #         "Havano POS Shift",  
        #         {"shift_name": self.shift_name}
        #     )
        #     if not exists:
        #         frappe.throw(f"Shift {self.shift_name} does not exist.")
@frappe.whitelist()
def save_pos_entries(payments, total_of_all_items):
    """
    Insert multiple Havano POS Entry records at once.
    Ensures each invoice is handled independently and
    last payment covers remaining balance.
    """
    import json

    if isinstance(payments, str):
        payments = json.loads(payments)

    total_of_all_items = float(total_of_all_items or 0)
    base_currency = "USD"
    current_amount=0
    current_amount = total_of_all_items
    results = []
    shift_updates = {}

    # Filter valid payments
    valid_payments = [
        p for p in payments
        if p.get("shift_name") and p.get("payment_method") and p.get("amount") and float(p.get("amount")) > 0
    ]
    current_amount = total_of_all_items

    total_valid = len(valid_payments)

    if total_valid == 0:
        frappe.throw("No valid payments provided.")

    methods_settings=get_payment_methods()
    user_settings = get_user_settings_dict()
    print(user_settings)
    print(user_settings.get("cost_center"))  # access any field easily



    for idx, p in enumerate(valid_payments):
        print(f"Processing payment {idx + 1}/{len(valid_payments)}:")
        print(json.dumps(p, indent=4))  # Pretty-print the dict

        invoice_number = p.get("invoice_number")
        currency = p.get("currency") or "USD"
        raw_amount = float(p.get("amount") or 0)

        pm_settings = methods_settings.get(p.get("payment_method").upper())  # ensure uppercase
        if pm_settings:
            exchange_rate = pm_settings['exchange_rate']
            current_currency = pm_settings['currency']
            current_account = pm_settings['account']
            current_symbol = pm_settings['currency_symbol']
            print("Exchange rate:", exchange_rate)
        else:
            frappe.throw(f"Payment method {payment_method} not found in settings")



        # Always reinit base_amount
        base_amount = 0.0

        # Convert to base currency
        if currency != base_currency:
            base_amount = round(raw_amount / exchange_rate, 2)  # example conversion
        else:
            base_amount = raw_amount

        # Handle last payment properly
        if idx == total_valid - 1:
            base_amount = round(current_amount, 2)
        else:
            base_amount = min(base_amount, current_amount)

        # Safety: never negative
        if base_amount < 0:
            base_amount = 0

        # Subtract after calculation
        current_amount = round(current_amount - base_amount, 2)

  
     

        if base_amount > 0:
            doc = frappe.get_doc({
                "doctype": "Havano POS Entry",
                "invoice_number": invoice_number,
                "invoice_date": p.get("invoice_date") or nowdate(),
                "payment_method": p.get("payment_method"),
                "amount": base_amount if currency == base_currency else base_amount * exchange_rate,
                "currency": currency,
                "base_amount": base_amount,
                "base_currency": base_currency,
                "shift_name": p.get("shift_name")
            })
            doc.insert(ignore_permissions=True)
            doc.submit()
            frappe.db.commit()
            results.append(doc.name)

            a=create_payment_entry(
                company=user_settings["company"],
                payment_type="Receive",
                party_type="Customer",
                party=user_settings.get("customer"),
                paid_from=user_settings.get("default_account"),
                paid_from_currency=base_currency,
                paid_to=current_account,
                paid_to_currency=current_currency,
                paid_amount=base_amount,               # invoice currency
                received_amount=base_amount * exchange_rate,         # actual cash received
                source_exchange_rate=1.0,      # USD -> USD
                target_exchange_rate=exchange_rate,     # 1 USD = 30 ZIG
                mode_of_payment= p.get("payment_method"),
                reference_doctype="Sales Invoice",
                reference_name=invoice_number
            )
            print(a)

            # Track shift totals
            shift_name = p.get("shift_name")
            shift_updates[shift_name] = shift_updates.get(shift_name, 0.0) + base_amount

    # --- Update shift totals ---
    for shift_name, total_added in shift_updates.items():
        try:
            shift_doc = frappe.get_doc("Havano POS Shift", shift_name)
            current_total = float(shift_doc.total_sales or 0)
            shift_doc.total_sales = str(current_total + total_added)
            opening_amt = float(shift_doc.opening_amount or 0)
            shift_doc.expected_amount = str(opening_amt + current_total + total_added)
            shift_doc.save(ignore_permissions=True)
            frappe.db.commit()
        except Exception as e:
            frappe.log_error(f"Error updating shift {shift_name}: {e}", "POS Shift Update")

    return {
        "status": 200,
        "created": results,
        "remaining_balance": current_amount,
        "shift_summary": shift_updates
    }

@frappe.whitelist()
def create_payment_entry(
    *,
    company,
    payment_type,
    party_type,
    party,
    paid_from,
    paid_from_currency,
    paid_to,
    paid_to_currency,
    paid_amount,
    received_amount,
    source_exchange_rate=1.0,
    target_exchange_rate=1.0,
    mode_of_payment=None,
    posting_date=None,
    reference_doctype=None,
    reference_name=None
):
    """
    Creates and submits a Payment Entry in ERPNext with named parameters only.
    Supports multi-currency payments with explicit exchange rates.
    """
    try:
        from frappe.utils import nowdate

        posting_date = posting_date or nowdate()

        payment_entry = frappe.get_doc({
            "doctype": "Payment Entry",
            "company": company,
            "payment_type": payment_type,
            "party_type": party_type,
            "party": party,
            "paid_from": paid_from,
            "paid_from_account_currency": paid_from_currency,
            "paid_to": paid_to,
            "paid_to_account_currency": paid_to_currency,
            "paid_amount": paid_amount,
            "received_amount": received_amount,
            "source_exchange_rate": source_exchange_rate,
            "target_exchange_rate": target_exchange_rate,
            "mode_of_payment": mode_of_payment,
            "posting_date": posting_date
        })

        # Add reference properly as child table
        if reference_doctype and reference_name:
            payment_entry.append("references", {
                "reference_doctype": reference_doctype,
                "reference_name": reference_name,
                "allocated_amount": paid_amount  # allocation is always in invoice currency
            })

        payment_entry.flags.ignore_permissions = True
        payment_entry.insert()
        payment_entry.submit()  # <-- Submit the document
        frappe.db.commit()

        return {
            "status": 200,
            "message": "Payment Entry created and submitted successfully",
            "data": payment_entry.name
        }

    except Exception as e:
        frappe.db.rollback()
        frappe.log_error(frappe.get_traceback(), "Payment Entry Creation Error")
        return {
            "status": 400,
            "message": str(e),
            "data": None
        }

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
        frappe.throw(f"No settings found for user {current_user}")

    # Convert row to dict
    user_dict = {field: getattr(user_row, field) for field in user_row.meta.get_valid_columns()}
    return user_dict


@frappe.whitelist()
def get_payment_methods():
    settings = frappe.get_doc("HA POS Setting", "SETTINGS-01")
    pm_dict = {}
    for pm in settings.selected_payment_methods:
        pm_dict[pm.mode_of_payment.upper()] = {
            "exchange_rate": pm.exchange_rate,
            "currency": pm.currency.upper(),
            "currency_symbol": pm.currency_symbol,
            "account": pm.account
        }
    return pm_dict


# @frappe.whitelist()
# def send_invoice_to_django_agent(docname):
#     print("send_invoice_to_django_agent   HAS RUN -----------------------------------")
#     import requests, base64

#     pdf_bytes = frappe.get_print("Sales Invoice", docname, "Standard", as_pdf=True)
#     pdf_b64 = base64.b64encode(pdf_bytes).decode("utf-8")

#     url = "http://127.0.0.1:5002/api/save-invoice"
#     payload = {"name": docname, "pdf": pdf_b64}

#     resp = requests.post(url, json=payload, timeout=15)
#     resp.raise_for_status()
#     return resp.json()





# import frappe, os, base64

# @frappe.whitelist()
# def save_invoice_pdf(docname):
#     # Generate PDF bytes
#     pdf_data = frappe.get_print("Sales Invoice", docname, "Standard", as_pdf=True)

#     # Ensure folder exists
#     folder = frappe.get_site_path("public", "files", "InvoiceFolder")
#     os.makedirs(folder, exist_ok=True)

#     # Save file on server
#     file_path = os.path.join(folder, f"{docname}.pdf")
#     with open(file_path, "wb") as f:
#         f.write(pdf_data)

#     # Return relative URL (browser can open this)
#     return f"/files/InvoiceFolder/{docname}.pdf"


# import frappe, requests, json, os
# from frappe.utils import nowdate, now

# @frappe.whitelist()
# def send_invoice_json_to_agent(docname):
#     # Load Sales Invoice
#     doc = frappe.get_doc("Sales Invoice", docname)

#     # Build JSON structure
#     invoice_json = {
#         "CompanyLogoPath": "/files/logo.png",
#         "CompanyName": frappe.db.get_single_value("Global Defaults", "default_company"),
#         "CompanyAddress": frappe.db.get_value("Company", doc.company, "address") or "",
#         "postcode": "",
#         "waiter_id": "",   # fill if needed
#         "contact": doc.contact_display or "",
#         "CompanyEmail": frappe.db.get_value("Company", doc.company, "email") or "",
#         "TIN": "",   # optional
#         "VATNo": "",
#         "Tel": frappe.db.get_value("Company", doc.company, "phone_no") or "",
#         "InvoiceNo": doc.name,
#         "InvoiceDate": str(doc.posting_date),
#         "CashierName": frappe.session.user,
#         "CustomerName": doc.customer_name,
#         "Customeraddress": doc.customer_address or "",
#         "itemlist": [
#             {
#                 "ProductName": i.item_name,
#                 "productid": i.item_code,
#                 "Qty": float(i.qty),
#                 "Price": float(i.rate),
#                 "Amount": float(i.amount),
#                 "vat": float(i.taxes_and_charges or 0),
#             }
#             for i in doc.items
#         ],
#         "AmountTendered": str(doc.paid_amount or 0),
#         "Change": str((doc.paid_amount or 0) - (doc.grand_total or 0)),
#         "QRCodePath": "",
#         "QRCodePath2": "",
#         "Currency": doc.currency,
#         "Footer": "Thank you for your business!",
#         "MultiCurrencyDetails": [],
#         "DeviceID": frappe.local.site,
#         "FiscalDay": str(nowdate()),
#         "ReceiptNo": doc.name,
#         "CustomerRef": doc.customer or "",
#         "VCode": "",
#         "QRCode": "",
#         "DiscAmt": float(doc.discount_amount or 0),
#         "GrandTotal": float(doc.grand_total or 0),
#         "TaxType": "VAT",
#         "PaymentMode": ",".join([p.mode_of_payment for p in doc.payments]) if doc.payments else "",
#     }

  
#     resp = requests.post(
#         "http://127.0.0.1:5002/api/save-invoice-json",
#         json={"name": docname, "data": invoice_json},
#         timeout=15,
#     )

#     return resp.json()




