odoo.define('pos_mesomb.PaymentFormPopup', function(require) {
    'use strict';

    const { _lt } = require('@web/core/l10n/translation');

    const { useState, useRef, onMounted } = owl;
    const AbstractAwaitablePopup = require('point_of_sale.AbstractAwaitablePopup');
    const Registries = require('point_of_sale.Registries');
    const providers = [
        {value: 'MTN', label: 'Mobile Money', countries: ['CM']},
        {value: 'ORANGE', label: 'Orange Money', countries: ['CM']},
        {value: 'AIRTEL', label: 'Airtel Money', countries: ['NE']},
    ]

    // formerly ConfirmPopupWidget
    class PaymentFormPopup extends AbstractAwaitablePopup {
        setup() {
            super.setup();
            this.state = useState({
                payer: this.props.payer,
                amount: this.props.amount,
                service: this.props.service,
            });
            this.inputRef = useRef('payer');
            onMounted(this.onMounted);
        }

        async confirm() {
            const payload = this.getPayload();
            if (payload.payer?.length > 0 && parseInt(payload.amount) > 0) {
                this.props.resolve({ confirmed: true, payload });
                super.confirm();
            }
        }

        onMounted() {
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
        confirmText: _lt('Send'),
        cancelText: _lt('Cancel'),
        title: _lt('Payment Confirmation'),
        services: providers,
    };

    Registries.Component.add(PaymentFormPopup);

    return PaymentFormPopup;
});
