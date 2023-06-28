from datetime import datetime
from urllib.parse import quote, urlparse
import string

import requests
from odoo import _, api, fields, models
from odoo.exceptions import UserError
from odoo.exceptions import ValidationError

from odoo.addons.payment_mesomb.utils import Signature, generate_nonce

api_version = 'v1.1'


class PaymentAcquirer(models.Model):
    _inherit = 'payment.acquirer'

    provider = fields.Selection(
        selection_add=[('mesomb', "MeSomb")], ondelete={'mesomb': 'set default'})
    mesomb_app_key = fields.Char(string="Application Key", help="The key of your MeSomb application")
    mesomb_access_key = fields.Char('Access Key', help="The access key provided by MeSomb")
    mesomb_secret_key = fields.Char('Secret Key', help="The secret key provided by MeSomb")
    mesomb_currency_conversion = fields.Boolean(string="Currency Conversion", default=True,
                                                help='Rely on MeSomb to automatically convert foreign currencies')
    mesomb_test_mode = fields.Boolean(string='In test mode?', help='Run transactions in the test environment.')
    mesomb_include_fees = fields.Boolean(string='Include Fees?', default=True,
                                         help='This control if the MeSomb fees are already included in the price shown to users')

    @api.constrains('state', 'mesomb_app_key', 'mesomb_access_key', 'mesomb_secret_key')
    def _check_state_of_connected_account_is_never_test(self):
        """ Check that the acquirer of a connected account can never been set to 'test'.

        This constraint is defined in the present module to allow the export of the translation
        string of the `ValidationError` should it be raised by modules that would fully implement
        Stripe Connect.

        Additionally, the field `state` is used as a trigger for this constraint to allow those
        modules to indirectly trigger it when writing on custom fields. Indeed, by always writing on
        `state` together with writing on those custom fields, the constraint would be triggered.

        :return: None
        """
        for acquirer in self:
            if acquirer.state == 'test' and acquirer._mesomb_has_connected_account():
                raise ValidationError(_(
                    "You cannot set the acquirer to Test Mode while linked to your MeSomb "
                    "account."
                ))

    def _mesomb_has_connected_account(self):
        """ Return whether the acquirer is linked to a connected Stripe account.

        Note: This method serves as a hook for modules that would fully implement Stripe Connect.
        Note: self.ensure_one()

        :return: Whether the acquirer is linked to a connected Stripe account
        :rtype: bool
        """
        self.ensure_one()
        return False

    # === BUSINESS METHODS ===#
    def build_url(self, endpoint):
        host = 'http://host.docker.internal:8000' if self.state == 'test' else 'https://mesomb.hachther.com'
        return '{}/en/api/{}/{}'.format(host, api_version, endpoint)

    def get_authorization(self, method, endpoint, date, nonce, headers=None, body=None):
        if headers is None:
            headers = {}

        url = self.build_url(endpoint)

        credentials = {'access_key': self.mesomb_access_key, 'secret_key': self.mesomb_secret_key}

        return Signature.sign_request('payment', method, url, date, nonce, credentials, headers, body)

    def _mesomb_make_request(self, endpoint, method='POST', payload=None, mode='synchronous'):
        # endpoint = 'payment/collect/'
        url = self.build_url(endpoint)
        nonce = generate_nonce()
        date = datetime.now()
        reference = payload.pop('reference')

        if payload:
            payload['conversion'] = self.mesomb_currency_conversion
            payload['include_fees'] = self.mesomb_include_fees

        authorization = self.get_authorization(method, endpoint, date, nonce,
                                               headers={'content-type': 'application/json'},
                                               body=payload)

        headers = {
            'x-mesomb-date': str(int(date.timestamp())),
            'x-mesomb-nonce': nonce,
            'Authorization': authorization,
            'X-MeSomb-Application': self.mesomb_app_key,
            'X-MeSomb-OperationMode': mode,
            'X-MeSomb-TrxID': reference,
        }

        return requests.request(method, url, json=payload, headers=headers, timeout=60)

    def _get_default_payment_method_id(self):
        self.ensure_one()
        if self.provider != 'mesomb':
            return super()._get_default_payment_method_id()
        return self.env.ref('payment_mesomb.payment_method_mesomb').id
