# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from datetime import date, timedelta

import requests
import werkzeug

from odoo import models, api, service
from odoo.tools.translate import _
from odoo.exceptions import UserError
from odoo.tools import DEFAULT_SERVER_DATETIME_FORMAT, misc


class MeSombTransaction(models.Model):
    _name = 'pos_mesomb.mesomb_transaction'
    _description = 'Point of Sale MeSomb Transaction'

    def _get_pos_session(self):
        pos_session = self.env['pos.session'].search([('state', '=', 'opened'), ('user_id', '=', self.env.uid)], limit=1)
        if not pos_session:
            raise UserError(_("No opened point of sale session for user %s found.") % self.env.user.name)

        pos_session.login()

        return pos_session

    def _get_pos_mesomb_config(self, config, journal_id):
        journal = config.journal_ids.filtered(lambda r: r.id == journal_id)

        if journal and journal.mesomb_payment_terminal:
            return {
                'mesomb_app_key': journal.mesomb_app_key,
                'mesomb_currency_conversion': journal.mesomb_currency_conversion,
                'mesomb_test_mode': journal.mesomb_test_mode,
                'mesomb_include_fees': journal.mesomb_include_fees,
            }
        else:
            raise UserError(_("No MeSomb configuration associated with the journal."))

    def _setup_request(self, data):
        # todo: in master make the client include the pos.session id and use that
        pos_session = self._get_pos_session()

        config = pos_session.config_id
        pos_mesomb_config = self._get_pos_mesomb_config(config, data['journal_id'])

        data.update({
            'app_key': pos_mesomb_config['mesomb_app_key'],
            'conversion': pos_mesomb_config['mesomb_currency_conversion'],
            'test_mode': pos_mesomb_config['mesomb_test_mode'],
            'fees': pos_mesomb_config['mesomb_include_fees'],
        })

        # data['operator_id'] = pos_session.user_id.login
        # data['merchant_id'] = pos_mercury_config.sudo().merchant_id
        # data['merchant_pwd'] = pos_mercury_config.sudo().merchant_pwd
        # data['memo'] = "Odoo " + service.common.exp_version()['server_version']

    def _do_request(self, template, data):
        if not data['app_key']:
            return "not setup"

        url = 'http://192.168.8.100:8000/api/v1.0/payment/online/' if data.pop('test_mode') else 'https://mesomb.hachther.com/api/v1.0/payment/online/'

        headers = {
            'X-MeSomb-Application': data.pop('app_key'),
            'Content-Type': 'application/json',
            'Accept-Language': 'fr'
        }

        try:
            r = requests.post(url, json=data, headers=headers, timeout=65)
            # r.raise_for_status()
            response = werkzeug.utils.unescape(r.content.decode())
        except Exception as e:
            print(e)
            response = "timeout"
        print(response)

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
        except UserError:
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
