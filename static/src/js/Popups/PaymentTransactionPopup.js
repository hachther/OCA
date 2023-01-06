odoo.define('pos_mesomb.PaymentTransactionPopup', function(require) {
    'use strict';

    const {_t} = require('web.core');

    const { useState } = owl.hooks;
    const AbstractAwaitablePopup = require('point_of_sale.AbstractAwaitablePopup');
    const Registries = require('point_of_sale.Registries');

    class PaymentTransactionPopup extends AbstractAwaitablePopup {
        constructor() {
            super(...arguments);
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
        confirmText: _('Ok'),
        cancelText: _('Cancel'),
        title: _('Online Payment'),
        body: '',
    };

    Registries.Component.add(PaymentTransactionPopup);

    return PaymentTransactionPopup;
});
