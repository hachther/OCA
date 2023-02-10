# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import json
import logging
from datetime import date, timedelta, datetime
import hashlib, hmac
import hmac
import random
import string
from typing import Union
from urllib.parse import quote, urlparse
from datetime import date, timedelta, datetime

import requests
import werkzeug

from odoo import models, api, service
from odoo.tools.translate import _
from odoo.exceptions import UserError
from odoo.tools import DEFAULT_SERVER_DATETIME_FORMAT, misc
from requests import ConnectTimeout
from urllib3.exceptions import NewConnectionError

_logger = logging.getLogger(__name__)
api_version = 'v1.1'


class Signature:
    @staticmethod
    def sign_request(service, method, url, date, nonce, credentials, headers=None, body=None):
        """
        Method to use to compute signature used in MeSomb request
        :param service: service to use can be payment, wallet ... (the list is provide by MeSomb)
        :param method: HTTP method (GET, POST, PUT, PATCH, DELETE...)
        :param url: the full url of the request with query element https://mesomb.hachther.com/path/to/ressource?highlight=params#url-parsing
        :param date: Datetime of the request
        :param nonce: Unique string generated for each request sent to MeSomb
        :param credentials: dict containing key => value for the credential provided by MeSOmb. {'access' => access_key, 'secret' => secret_key}
        :param headers: Extra HTTP header to use in the signature
        :param body: The dict containing the body you send in your request body
        :return: Authorization to put in the header
        """
        algorithm = 'HMAC-SHA1'
        parse = urlparse(url)
        canonical_query = parse.query

        timestamp = str(int(date.timestamp()))

        # CanonicalHeaders
        if headers is None:
            headers = {}
        headers['host'] = '{}://{}'.format(parse.scheme, parse.netloc)
        headers['x-mesomb-date'] = timestamp
        headers['x-mesomb-nonce'] = nonce
        canonical_headers = '\n'.join(['{}:{}'.format(key.lower(), headers[key].strip()) for key in sorted(headers)])

        if body is None:
            body = {}
        request_params = json.dumps(body, separators=(',', ':'))

        payload_hash = hashlib.sha1(request_params.encode('utf-8')).hexdigest()

        signed_headers = ';'.join(sorted(headers))

        canonical_request = '{}\n{}\n{}\n{}\n{}\n{}'.format(method, quote(parse.path), canonical_query,
                                                            canonical_headers,
                                                            signed_headers, payload_hash)

        scope = '{}/{}/mesomb_request'.format(date.strftime('%Y%m%d'), service)
        string_to_sign = '{}\n{}\n{}\n{}'.format(algorithm, timestamp, scope,
                                                 hashlib.sha1(canonical_request.encode('utf-8')).hexdigest())

        signature = hmac.new(credentials['secret_key'].encode(), string_to_sign.encode(), hashlib.sha1).hexdigest()

        authorization_header = '{} Credential={}/{}, SignedHeaders={}, Signature={}'.format(algorithm,
                                                                                            credentials['access_key'],
                                                                                            scope,
                                                                                            signed_headers, signature)

        return authorization_header

    @staticmethod
    def generate_nonce(length=40):
        letters = string.ascii_letters + string.digits
        return ''.join(random.choice(letters) for i in range(length))


class PaymentOperation:
    def __init__(self, application_key, access_key, secret_key, host):
        self.application_key = application_key
        self.access_key = access_key
        self.secret_key = secret_key
        self.host = host

    def build_url(self, endpoint):
        return '{}/en/api/{}/{}'.format(self.host, api_version, endpoint)

    def get_authorization(self, method, endpoint, date, nonce, headers=None, body=None):
        if headers is None:
            headers = {}

        url = self.build_url(endpoint)

        credentials = {'access_key': self.access_key, 'secret_key': self.secret_key}

        return Signature.sign_request('payment', method, url, date, nonce, credentials, headers, body)

    def make_collect(self, amount, service, payer, date, nonce, country='CM', currency='XAF', fees_included=True,
                     mode='synchronous', conversion=False, location=None, customer=None, products=None, extra=None):
        """
        Collect money a use account
        [Check the documentation here](https://mesomb.hachther.com/en/api/schema/)
        :param amount: amount to collect
        :param service: MTN, ORANGE, AIRTEL
        :param payer: account number to collect from
        :param date: date of the request
        :param nonce: unique string on each request
        :param country: country CM, NE
        :param currency: code of the currency of the amount
        :param fees_included: if MeSomb fees is already included in the money you are collecting
        :param conversion: In case of foreign currently defined if you want to rely on MeSomb to convert the amount in the local currency
        :param mode: asynchronous or synchronous
        :param location: dict containing the location of the customer check the documentation
        :param customer: dict containing information of the customer check the documentation
        :param product: dict containing information of the product check the documentation
        :param extra: Extra parameter to send in the body check the API documentation
        :return: request response
        """

        endpoint = 'payment/collect/'
        url = self.build_url(endpoint)

        body = {
            'amount': amount,
            'payer': payer,
            'fees': fees_included,
            'service': service,
            'country': country,
            'currency': currency,
            'conversion': conversion
        }
        if extra is not None:
            body.update(extra)

        if location is not None:
            body['location'] = location

        if customer is not None:
            body['customer'] = customer

        if products is not None:
            body['products'] = products

        authorization = self.get_authorization('POST', endpoint, date, nonce,
                                               headers={'content-type': 'application/json'},
                                               body=body)

        headers = {
            'x-mesomb-date': str(int(date.timestamp())),
            'x-mesomb-nonce': nonce,
            'Authorization': authorization,
            'X-MeSomb-Application': self.application_key,
            'X-MeSomb-OperationMode': mode,
        }

        return requests.post(url, json=body, headers=headers)


class MeSombTransaction(models.Model):
    _name = 'pos_mesomb.mesomb_transaction'
    _description = 'Point of Sale MeSomb Transaction'

    def _get_pos_session(self):
        pos_session = self.env['pos.session'].search([('state', '=', 'opened'), ('user_id', '=', self.env.uid)],
                                                     limit=1)
        if not pos_session:
            raise UserError(_("No opened point of sale session for user %s found.") % self.env.user.name)

        pos_session.login()

        return pos_session

    def _get_pos_mesomb_config(self, config, payment_method_id):
        payment_method = config.current_session_id.payment_method_ids.filtered(lambda pm: pm.id == payment_method_id)

        if payment_method and payment_method.pos_mesomb_config_id:
            return payment_method.pos_mesomb_config_id
        else:
            raise UserError(_("No MeSomb configuration is associated with the payment method."))

    def _setup_request(self, data):
        # todo: in master make the client include the pos.session id and use that
        pos_session = self._get_pos_session()

        config = pos_session.config_id
        pos_mesomb_config = self._get_pos_mesomb_config(config, data['payment_method_id'])

        data['operator_id'] = pos_session.user_id.login
        data['application_key'] = pos_mesomb_config.sudo().mesomb_app_key
        data['access_key'] = pos_mesomb_config.sudo().mesomb_access_key
        data['secret_key'] = pos_mesomb_config.sudo().mesomb_secret_key
        data['test_mode'] = pos_mesomb_config.sudo().mesomb_test_mode
        data['fees_included'] = pos_mesomb_config.sudo().mesomb_include_fees
        data['currency_conversion'] = pos_mesomb_config.sudo().mesomb_currency_conversion
        data['memo'] = "Odoo " + service.common.exp_version()['server_version']

    def _do_request(self, template, data):
        if not data['application_key']:
            return "not setup"

        host = 'http://host.docker.internal:8000' if data.pop('test_mode') else 'https://mesomb.hachther.com'
        operation = PaymentOperation(data.pop('application_key'), data.pop('access_key'), data.pop('secret_key'), host)

        try:
            r = operation.make_collect(data.pop('amount'), data.pop('service'), data.pop('payer'),
                                       datetime.now(), Signature.generate_nonce(),
                                       country=data.pop('country'), currency=data.pop('currency', 'XAF'),
                                       fees_included=data.pop('fees_included'),
                                       conversion=data.pop('currency_conversion'), customer=data.pop('customer', None),
                                       products=data.pop('products', None),
                                       extra={'reference': data.pop('reference', None), 'source': data.pop('memo', None)})
            r.raise_for_status()
            response = r.text
        except Union[ConnectTimeout, NewConnectionError] as e:
            return 'timeout'
        except Exception as e:
            response = json.dumps({'success': False, 'message': str(e)})

        # response = '{"success":true,"message":"The payment has been successfully done!","redirect":"https://meudoctaweb.hachther.com","transaction":{"pk":"debbb3f5-2fc7-402b-9263-c1454b3e2996","status":"SUCCESS","type":"PAYMENT","amount":45.59,"fees":1.41,"b_party":"237400001019","message":"By Meudocta Shop","service":"MTN","reference":null,"ts":"2022-08-09T06:18:00.136288Z","direction":1,"country":"CM","currency":"USD","customer":{},"product":{},"location":{"town":"Douala"},"trxamount":47.0},"reference":"","status":"SUCCESS"}'

        return response

    def _do_reversal_or_voidsale(self, data, is_voidsale):
        try:
            self._setup_request(data)
        except UserError:
            return "internal error"

        data['is_voidsale'] = is_voidsale
        response = self._do_request('pos_mesomb.mesomb_voidsale', data)
        return response

    @api.model
    def do_payment(self, data):
        try:
            self._setup_request(data)
        except UserError as e:
            _logger.exception('Unable to setup mesomb request', e)
            return "internal error"

        response = self._do_request('pos_mesomb.mesomb_transaction', data)
        return response

    @api.model
    def do_reversal(self, data):
        return self._do_reversal_or_voidsale(data, False)

    @api.model
    def do_voidsale(self, data):
        return self._do_reversal_or_voidsale(data, True)

    def do_return(self, data):
        try:
            self._setup_request(data)
        except UserError:
            return "internal error"

        response = self._do_request('pos_mesomb.mesomb_return', data)
        return response

    # One time (the ones we use) Mesomb tokens are required to be
    # deleted after 6 months
    @api.model
    def cleanup_old_tokens(self):
        expired_creation_date = (date.today() - timedelta(days=6 * 30)).strftime(DEFAULT_SERVER_DATETIME_FORMAT)

        for order in self.env['pos.order'].search([('create_date', '<', expired_creation_date)]):
            order.ref_no = ""
            order.record_no = ""
