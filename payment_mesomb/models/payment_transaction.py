import logging
import pprint

from odoo import _, api, fields, models
from odoo.exceptions import ValidationError
from odoo.addons.payment import utils as payment_utils
from odoo.addons.payment_mesomb.const import CURRENCY_DECIMALS

_logger = logging.getLogger(__name__)
api_version = 'v1.1'

class PaymentTransaction(models.Model):
    _inherit = 'payment.transaction'

    # === BUSINESS METHODS ===#
    def _get_specific_processing_values(self, processing_values):
        """ Override of payment to return MeSomb-specific processing values.

        Note: self.ensure_one() from `_get_processing_values`

        :param dict processing_values: The generic processing values of the transaction
        :return: The dict of acquirer-specific processing values
        :rtype: dict
        """
        res = super()._get_specific_processing_values(processing_values)
        if self.provider != 'mesomb':
            return res

        converted_amount = payment_utils.to_minor_currency_units(
            self.amount, self.currency_id, CURRENCY_DECIMALS.get(self.currency_id.name)
        )
        return {
            'converted_amount': converted_amount,
            'access_token': payment_utils.generate_access_token(
                processing_values['reference'],
                converted_amount,
                processing_values['partner_id']
            )
        }

    @api.model
    def _get_tx_from_feedback_data(self, provider, data):
        """ Override of payment to find the transaction based on Stripe data.

        :param str provider: The provider of the acquirer that handled the transaction
        :param dict data: The feedback data sent by the provider
        :return: The transaction if found
        :rtype: recordset of `payment.transaction`
        :raise: ValidationError if inconsistent data were received
        :raise: ValidationError if the data match no transaction
        """
        tx = super()._get_tx_from_feedback_data(provider, data)
        if provider != 'mesomb':
            return tx

        reference = data.get('merchantReference')
        if not reference:
            raise ValidationError("MeSomb: " + _("Received data with missing merchant reference"))

        tx = self.search([('reference', '=', reference), ('provider', '=', 'mesomb')])
        if not tx:
            raise ValidationError(
                "MeSomb: " + _("No transaction found matching reference %s.", reference)
            )
        return tx

    def _process_feedback_data(self, data):
        """ Override of payment to process the transaction based on dummy data.

        Note: self.ensure_one()

        :param dict data: The dummy feedback data
        :return: None
        :raise: ValidationError if inconsistent data were received
        """
        super()._process_feedback_data(data)
        if self.provider != "mesomb":
            return

        _logger.info("process feedback data:\n%s", pprint.pformat(data))

        status = data.get('status')
        success = data.get('success', False)

        if not success:
            raise ValidationError("MeSomb: " + _("The transaction has failed, check your information and try again"))

        if status == 'PENDING':
            self._set_pending()
        elif status == 'SUCCESS':
            self._set_done()
        elif status == 'FAIL':
            _logger.warning("An error occurred on transaction with reference %s (reason: %s)", self.reference, data.get('message'))
            self._set_error(
                _("An error occurred during the processing of your payment. Please try again.")
            )
