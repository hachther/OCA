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
    @http.route('/payment/mesomb/provider_info', type='json', auth='public')
    def mesomb_provider_info(self, provider_id):
        """ Return public information on the provider.

        :param int provider_id: The provider handling the transaction, as a `payment.provider` id
        :return: Public information on the provider, namely: the state and client key
        :rtype: str
        """
        provider_sudo = request.env['payment.provider'].sudo().browse(provider_id).exists()
        return {
            'state': provider_sudo.state,
            'application_key': provider_sudo.mesomb_app_key,
        }

    @http.route('/payment/mesomb/payment', type='json', auth='public')
    def send_payment(self, reference, service, payer, provider_id, currency_id, access_token, converted_amount,
                     partner_id):
        # Check that the transaction details have not been altered. This allows preventing users
        # from validating transactions by paying less than agreed upon.
        if not payment_utils.check_access_token(
                access_token, reference, converted_amount, partner_id
        ):
            raise ValidationError("MeSomb: " + _("Received tampered payment request data."))

        # Make the payment request to Adyen
        provider_sudo = request.env['payment.provider'].sudo().browse(provider_id).exists()
        tx_sudo = request.env['payment.transaction'].sudo().search([('reference', '=', reference)])
        # data['memo'] = "Odoo " + service.common.exp_version()['server_version']
        currency = request.env['res.currency'].browse(currency_id).name
        data = {
            # 'merchantAccount': self.provider_id.adyen_merchant_account,
            'payer': payer,
            'service': service,
            'country': 'CM',
            'amount': converted_amount,
            'currency': currency,
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
            # 'products': [
            #     {
            #         'name': reference,
            #         'amount': converted_amount,
            #         'quantity': 1,
            #     }
            # ],
            'source': 'Odoo ',
            'location': {
                'ip': payment_utils.get_customer_ip_address(),
            }
        }

        # Force the capture delay on Adyen side if the provider is not configured for capturing
        # payments manually. This is necessary because it's not possible to distinguish
        # 'AUTHORISATION' events sent by Adyen with the merchant account's capture delay set to
        # 'manual' from events with the capture delay set to 'immediate' or a number of hours. If
        # the merchant account is configured to capture payments with a delay but the provider is
        # not, we force the immediate capture to avoid considering authorized transactions as
        # captured on Odoo.
        if not provider_sudo.capture_manually:
            data.update(captureDelayHours=0)

        response = None
        try:
            r = provider_sudo._mesomb_make_request(
                endpoint='payment/collect/',
                payload=data,
                method='POST'
            )
            response = r.json()
            r.raise_for_status()

            # Handle the payment request response
            _logger.info("payment request response: %s", pprint.pformat(response))
            tx_sudo._handle_notification_data(
                'mesomb', dict(response, merchantReference=reference),  # Match the transaction
            )
            return json.dumps(response)
        except requests.exceptions.RequestException:
            _logger.exception("Error wit MeSomb service %s", json.dumps(response))
            raise ValidationError(
                "Detail: " + response.get('detail', _("Could not establish the connection to the API.")))
        except Exception as e:
            _logger.error("error during the payment: %s", json.dumps(response))
            response['success'] = False
            return json.dumps(response)
