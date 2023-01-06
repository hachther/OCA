odoo.define('pos_mesomb.PaymentFormPopup', function(require) {
    'use strict';

    const {_t} = require('web.core');

    const { useState, useRef } = owl.hooks;
    const AbstractAwaitablePopup = require('point_of_sale.AbstractAwaitablePopup');
    const Registries = require('point_of_sale.Registries');
    const providers = [
        {value: 'MTN', label: 'Mobile Money', countries: ['CM']},
        {value: 'ORANGE', label: 'Orange Money', countries: ['CM']},
        {value: 'AIRTEL', label: 'Airtel Money', countries: ['NE']},
    ]

    // formerly ConfirmPopupWidget
    class PaymentFormPopup extends AbstractAwaitablePopup {
        constructor() {
            super(...arguments);
            this.state = useState({
                payer: this.props.payer,
                amount: this.props.amount,
                service: this.props.service,
            });
            this.inputRef = useRef('payer');
        }

        async confirm() {
            const payload = await this.getPayload();
            if (payload.payer?.length > 0 && payload.amount?.length > 0) {
                this.props.resolve({ confirmed: true, payload });
                this.trigger('close-popup');
            }
        }

        mounted() {
            this.inputRef.el.focus();
        }

        getPayload() {
            return {
                country: this.state.country,
                payer: this.state.payer,
                amount: this.state.amount,
                service: this.state.service,
            };
        }
    }
    PaymentFormPopup.template = 'PaymentFormPopup';
    PaymentFormPopup.defaultProps = {
        confirmText: _t('Send'),
        cancelText: _t('Cancel'),
        title: _t('Payment Confirmation'),
        services: providers,
    };

    Registries.Component.add(PaymentFormPopup);

    return PaymentFormPopup;
});
