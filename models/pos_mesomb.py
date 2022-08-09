from odoo import fields, models


class AccountJournal(models.Model):
    _inherit = "account.journal"
    # TODO: In 13.0 this fields should be moved to `pos.payment.method`
    # and be addod to the payment terminal selection

    mesomb_payment_terminal = fields.Boolean(string='Use MeSomb?')
    mesomb_app_key = fields.Char(
        string="Application Key",
        help="The key of your MeSomb application",
    )
    mesomb_currency_conversion = fields.Boolean(string="Currency Conversion", default=True,
                                                help = 'Rely on MeSomb to automatically convert foreign currencies')
    mesomb_test_mode = fields.Boolean(string='In test mode?', help='Run transactions in the test environment.')
    mesomb_include_fees = fields.Boolean(string='Include Fees?', default=True, help='This control if the MeSomb fees is already included in the price shown to users')


class AccountBankStatementLine(models.Model):
    _inherit = "account.bank.statement.line"

    mesomb_payer = fields.Char(string='Payer', help='The phone number of the payer')
    mesomb_country = fields.Char(string='Country', help='Country of the payment')
    mesomb_service = fields.Char(string='Service', help='Payment provider')
    mesomb_ref_no = fields.Char(string='MeSomb reference number', help='Payment reference number from MeSomb Pay')
    mesomb_record_no = fields.Char(string='MeSomb record number', help='Payment record number from MeSomb Pay')
    mesomb_invoice_no = fields.Char(string='MeSomb invoice number', help='Invoice number from MeSomb Pay')
