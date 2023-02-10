odoo.define('pos_mesomb.PaymentTransactionPopup', function(require) {
    'use strict';

    const { _lt } = require('@web/core/l10n/translation');

    const { useState } = owl;
    const AbstractAwaitablePopup = require('point_of_sale.AbstractAwaitablePopup');
    const Registries = require('point_of_sale.Registries');

    class PaymentTransactionPopup extends AbstractAwaitablePopup {
        setup() {
            super.setup();
            this.state = useState({ message: '', confirmButtonIsShown: false });
            this.props.transaction.then(data => {
                if (data.auto_close) {
                    setTimeout(() => {
                        this.confirm();
                    }, 2000)
                } else {
                    this.state.confirmButtonIsShown = true;
                }
                this.state.message = data.message;
            }).progress(data => {
                this.state.message = data.message;
            })
        }
    }
    PaymentTransactionPopup.template = 'MeSombPaymentTransactionPopup';
    PaymentTransactionPopup.defaultProps = {
        confirmText: _lt('Ok'),
        cancelText: _lt('Cancel'),
        title: _lt('Online Payment'),
        body: '',
    };

    Registries.Component.add(PaymentTransactionPopup);

    return PaymentTransactionPopup;
});
