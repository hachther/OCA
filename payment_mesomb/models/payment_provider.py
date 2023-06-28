import logging
import re
from datetime import datetime
from urllib.parse import quote, urlparse
import string

import requests

from odoo import _, api, fields, models
from odoo.exceptions import ValidationError

from odoo.addons.payment_mesomb.utils import Signature, generate_nonce

api_version = 'v1.1'

class PaymentProvider(models.Model):
    _inherit = 'payment.provider'

    code = fields.Selection(
        selection_add=[('mesomb', "MeSomb")], ondelete={'mesomb': 'set default'})
    mesomb_app_key = fields.Char(string="Application Key", help="The key of your MeSomb application")
    mesomb_access_key = fields.Char('Access Key', help="The access key provided by MeSomb")
    mesomb_secret_key = fields.Char('Secret Key', help="The secret key provided by MeSomb")
    mesomb_currency_conversion = fields.Boolean(string="Currency Conversion", default=True,
                                                help='Rely on MeSomb to automatically convert foreign currencies')
    mesomb_test_mode = fields.Boolean(string='In test mode?', help='Run transactions in the test environment.')
    mesomb_include_fees = fields.Boolean(string='Include Fees?', default=True,
                                         help='This control if the MeSomb fees are already included in the price shown to users')

    # === COMPUTE METHODS ===#

    def _compute_feature_support_fields(self):
        """ Override of `payment` to enable additional features. """
        super()._compute_feature_support_fields()
        self.filtered(lambda p: p.code == 'mesomb').update({
            'support_fees': True,
            'support_manual_capture': False,
            'support_refund': 'partial',
            'support_tokenization': False,
        })

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