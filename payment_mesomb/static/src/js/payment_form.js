/* global MeSombCheckout */
odoo.define('payment_mesomb.payment_form', require => {
    'use strict';

    const core = require('web.core');
    const checkoutForm = require('payment.checkout_form');
    const manageForm = require('payment.manage_form');

    const _t = core._t;

    const placholders = {
        MTN: _t('Mobile Money Number'),
        ORANGE: _t('Orange Money Number'),
        AIRTEL: _t('Airtel Money Number'),
    };

    $('body').on('change', 'input[name=mesomb_service]', function (evt) {
        const service = evt.target.value;
        if (service) {
            $('#mesomb_payer').attr('placeholder', placholders[service])
        }
    });

    const meSombMixin = {

        _displayError: function (title, description = '', error = '') {
            $('#confirm-box').hide();
            return this._super(...arguments);
        },

        //--------------------------------------------------------------------------
        // Private
        //--------------------------------------------------------------------------

        /**
         * Simulate a feedback from a payment provider and redirect the customer to the status page.
         *
         * @override method from payment.payment_form_mixin
         * @private
         * @param {string} code - The provider of the acquirer
         * @param {number} providerId - The id of the acquirer handling the transaction
         * @param {object} processingValues - The processing values of the transaction
         * @return {Promise}
         */
        _processDirectPayment: function (code, providerId, processingValues) {
            if (code !== 'mesomb') {
                return this._super(...arguments);
            }
            $('#confirm-box').show();

            const service = $('[name=mesomb_service]:checked').val();
            const payer = $('[name=mesomb_payer]').val();
            return this._rpc({
                route: '/payment/mesomb/payment',
                params: {
                    provider_id: providerId,
                    converted_amount: processingValues.converted_amount,
                    currency_id: processingValues.currency_id,
                    partner_id: processingValues.partner_id,
                    access_token: processingValues.access_token,
                    // browser_info: state.data.browserInfo,
                    reference: processingValues.reference,
                    service,
                    payer,
                },
            }).then((response) => {
                const data = JSON.parse(response);
                if (data.status === 'SUCCESS') {
                    window.location = '/payment/status';
                } else {
                    this._displayError(
                        _t("Processing Error"),
                        _t("Error during the payment processing."),
                        data.detail
                    );
                }
            }).guardedCatch((error) => {
                error.event.preventDefault();
                this._displayError(
                    _t("Server Error"),
                    _t("We are not able to process your payment."),
                    error.message.data.message
                );
            });
        },

        /**
         * Prepare the inline form of Test for direct payment.
         *
         * @override method from payment.payment_form_mixin
         * @private
         * @param {string} provider - The provider of the selected payment option's acquirer
         * @param {integer} paymentOptionId - The id of the selected payment option
         * @param {string} flow - The online payment flow of the selected payment option
         * @return {Promise}
         */
        _prepareInlineForm: function (provider, paymentOptionId, flow) {
            if (provider !== 'mesomb') {
                return this._super(...arguments);
            }

            // Check if instantiation of the drop-in is needed
            if (flow === 'token') {
                return Promise.resolve(); // No drop-in for tokens
            } else if (this.mesombDropin && this.mesombDropin.acquirerId === paymentOptionId) {
                this._setPaymentFlow('direct'); // Overwrite the flow even if no re-instantiation
                return Promise.resolve(); // Don't re-instantiate if already done for this acquirer
            }

            this._setPaymentFlow('direct');
            return Promise.resolve();
        },
    };
    checkoutForm.include(meSombMixin);
    manageForm.include(meSombMixin);
});
