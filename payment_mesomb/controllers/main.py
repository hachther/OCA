import json
import logging
import pprint

import requests
from odoo import _, http
from odoo.exceptions import ValidationError
from odoo.http import request
from odoo.addons.payment import utils as payment_utils

_logger = logging.getLogger(__name__)

class MeSombController(http.Controller):
    @http.route('/payment/mesomb/acquirer_info', type='json', auth='public')
    def mesomb_acquirer_info(self, acquirer_id):
        """ Return public information on the acquirer.

        :param int acquirer_id: The acquirer handling the transaction, as a `payment.acquirer` id
        :return: Public information on the acquirer, namely: the state and client key
        :rtype: str
        """
        acquirer_sudo = request.env['payment.acquirer'].sudo().browse(acquirer_id).exists()
        return {
            'state': acquirer_sudo.state,
            'application_key': acquirer_sudo.mesomb_app_key,
        }

    @http.route('/payment/mesomb/payment', type='json', auth='public')
    def send_payment(self, reference, service, payer, acquirer_id, currency_id, access_token, converted_amount, partner_id):
        # Check that the transaction details have not been altered. This allows preventing users
        # from validating transactions by paying less than agreed upon.
        if not payment_utils.check_access_token(
                access_token, reference, converted_amount, partner_id
        ):
            raise ValidationError("MeSomb: " + _("Received tampered payment request data."))

        # Make the payment request to Adyen
        acquirer_sudo = request.env['payment.acquirer'].sudo().browse(acquirer_id).exists()
        tx_sudo = request.env['payment.transaction'].sudo().search([('reference', '=', reference)])
        # data['memo'] = "Odoo " + service.common.exp_version()['server_version']
        data = {
            # 'merchantAccount': self.acquirer_id.adyen_merchant_account,
            'payer': payer,
            'service': service,
            'country': 'CM',
            'amount': converted_amount,
            'currency': request.env['res.currency'].browse(currency_id).name,
            'reference': reference,
            'customer': {
                'town': tx_sudo.partner_city or None,
                'country': tx_sudo.partner_country_id.code or None,
                'address': tx_sudo.partner_address or None,
                'region': tx_sudo.partner_state_id.name or None,
                'email': tx_sudo.partner_email or None,
                'name': tx_sudo.partner_name,
                'phone': tx_sudo.partner_phone or None,
            },
            'products': [
                {
                    'name': reference,
                    'amount': converted_amount,
                    'quantity': 1,
                }
            ],
            'source': 'Odoo ',
            # 'location': {
            #     'ip': payment_utils.get_customer_ip_address(),
            # }
        }

        response = None
        try:
            r = acquirer_sudo._mesomb_make_request(
                endpoint='payment/collect/',
                payload=data,
                method='POST'
            )
            response = r.json()
            r.raise_for_status()

            # Handle the payment request response
            _logger.info("payment request response: %s", pprint.pformat(response))
            request.env['payment.transaction'].sudo()._handle_feedback_data(
                'mesomb', dict(response, merchantReference=reference),  # Match the transaction
            )
            return json.dumps(response)
        except requests.exceptions.RequestException:
            _logger.exception("Unable to communicate with MeSomb")
            raise ValidationError("MeSomb: " + _("Could not establish the connection to the API."))
        except Exception as e:
            _logger.error("error during the payment: %s", json.dumps(response))
            response['success'] = False
            return json.dumps(response)
