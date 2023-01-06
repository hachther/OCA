from odoo import fields, models
import logging

from odoo import fields, models, api, _
from odoo.exceptions import ValidationError

_logger = logging.getLogger(__name__)


class PosMeSombConfiguration(models.Model):
    _name = 'pos_mesomb.configuration'
    _description = 'Point of Sale MeSomb Configuration'

    name = fields.Char(required=True, help='Name of this MeSomb configuration')
    mesomb_app_key = fields.Char(
        string="Application Key",
        help="The key of your MeSomb application",
    )
    mesomb_access_key = fields.Char('Access Key', help="The access key provided by MeSomb")
    mesomb_secret_key = fields.Char('Secret Key', help="The secret key provided by MeSomb")
    mesomb_currency_conversion = fields.Boolean(string="Currency Conversion", default=True,
                                                help='Rely on MeSomb to automatically convert foreign currencies')
    mesomb_test_mode = fields.Boolean(string='In test mode?', help='Run transactions in the test environment.')
    mesomb_include_fees = fields.Boolean(string='Include Fees?', default=True,
                                         help='This control if the MeSomb fees is already included in the price shown to users')


class PosPaymentMethod(models.Model):
    _inherit = 'pos.payment.method'
    pos_mesomb_config_id = fields.Many2one('pos_mesomb.configuration', string='MeSomb Credentials',
                                            help='The configuration of MeSomb used for this journal')

    def _get_payment_terminal_selection(self):
        return super(PosPaymentMethod, self)._get_payment_terminal_selection() + [('mesomb', 'MeSomb')]

    @api.onchange('use_payment_terminal')
    def _onchange_use_payment_terminal(self):
        super(PosPaymentMethod, self)._onchange_use_payment_terminal()
        if self.use_payment_terminal != 'mesomb':
            self.pos_mesomb_config_id = False

    # @api.constrains('mesomb_terminal_identifier')
    # def _check_mesomb_terminal_identifier(self):
    #     for payment_method in self:
    #         if not payment_method.mesomb_terminal_identifier:
    #             continue
    #         existing_payment_method = self.search([('id', '!=', payment_method.id),
    #                                                ('mesomb_terminal_identifier', '=',
    #                                                 payment_method.mesomb_terminal_identifier)],
    #                                               limit=1)
    #         if existing_payment_method:
    #             raise ValidationError(_('Terminal %s is already used on payment method %s.')
    #                                   % (
    #                                   payment_method.mesomb_terminal_identifier, existing_payment_method.display_name))


class PoSPayment(models.Model):
    _inherit = "pos.payment"

    mesomb_payer = fields.Char(string='Payer', help='The phone number of the payer')
    mesomb_country = fields.Char(string='Country', help='Country of the payment')
    mesomb_service = fields.Char(string='Service', help='Payment provider')
    mesomb_ref_no = fields.Char(string='MeSomb reference number', help='Payment reference number from MeSomb Pay')
    mesomb_record_no = fields.Char(string='MeSomb record number', help='Payment record number from MeSomb Pay')
    mesomb_invoice_no = fields.Char(string='MeSomb invoice number', help='Invoice number from MeSomb Pay')


class PosOrder(models.Model):
    _inherit = "pos.order"

    @api.model
    def _payment_fields(self, order, ui_paymentline):
        fields = super(PosOrder, self)._payment_fields(order, ui_paymentline)

        fields.update({
            'mesomb_payer': ui_paymentline.get('mesomb_payer'),
            'mesomb_country': ui_paymentline.get('mesomb_country'),
            'mesomb_service': ui_paymentline.get('mesomb_service'),
            'mesomb_ref_no': ui_paymentline.get('mesomb_ref_no'),
            'mesomb_record_no': ui_paymentline.get('mesomb_record_no'),
            'mesomb_invoice_no': ui_paymentline.get('mesomb_invoice_no')
        })

        return fields
