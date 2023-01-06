# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.
import json
import logging
from datetime import date, timedelta, datetime

import requests
import werkzeug

from odoo import models, api, service
from odoo.tools.translate import _
from odoo.exceptions import UserError
from odoo.tools import DEFAULT_SERVER_DATETIME_FORMAT, misc

_logger = logging.getLogger(__name__)


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
            raise UserError(_("No MeSomb configuration associated with the payment method."))

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

    def _do_request(self, template, data):
        from pymesomb.operations import PaymentOperation
        from pymesomb.signature import Signature
        from pymesomb import settings

        if not data['application_key']:
            return "not setup"

        settings.host = 'http://host.docker.internal:8000' if data.pop('test_mode') else 'https://mesomb.hachther.com'
        operation = PaymentOperation(data.pop('application_key'), data.pop('access_key'), data.pop('secret_key'))

        try:
            r = operation.make_collect(data.pop('amount'), data.pop('service'), data.pop('payer'),
                                       datetime.now(), Signature.generate_nonce(),
                                       country=data.pop('country'), currency=data.pop('currency', 'XAF'),
                                       fees_included=data.pop('fees_included'),
                                       conversion=data.pop('currency_conversion'), customer=data.pop('customer', None),
                                       extra={'products': data.pop('products', None), 'reference': data.pop('reference', None)})
            response = json.dumps({
                'success': r.success,
                'message': r.message,
                'data': r.data
            })
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
