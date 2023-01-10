odoo.define('pos_mesomb.MeSombPaymentTransactionPopup', function (require) {
    'use strict';

    const {_t} = require('web.core');

    const {useState} = owl.hooks;
    const AbstractAwaitablePopup = require('point_of_sale.AbstractAwaitablePopup');
    const Registries = require('point_of_sale.Registries');

    class MeSombPaymentTransactionPopup extends AbstractAwaitablePopup {
        constructor() {
            super(...arguments);
            this.state = useState({message: '', confirmButtonIsShown: false});
        }

        mounted() {
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

    MeSombPaymentTransactionPopup.template = 'MeSombPaymentTransactionPopup';
    MeSombPaymentTransactionPopup.defaultProps = {
        confirmText: _t('Ok'),
        cancelText: _t('Cancel'),
        title: _t('Online Payment'),
        body: '',
    };

    Registries.Component.add(MeSombPaymentTransactionPopup);

    return MeSombPaymentTransactionPopup;
});
