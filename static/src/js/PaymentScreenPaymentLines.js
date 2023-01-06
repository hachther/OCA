odoo.define('pos_mesomb.PaymentScreenPaymentLines', function (require) {
    'use strict';

    const PaymentScreenPaymentLines = require('point_of_sale.PaymentScreenPaymentLines');
    const Registries = require('point_of_sale.Registries');

    const PosMeSombPaymentLines = (PaymentScreenPaymentLines) =>
        class extends PaymentScreenPaymentLines {
            /**
             * @override
             */
            selectedLineClass(line) {
                return Object.assign({}, super.selectedLineClass(line), {
                    o_pos_mesomb_validate_pending: line.mesomb_validate_pending,
                });
            }
            /**
             * @override
             */
            unselectedLineClass(line) {
                return Object.assign({}, super.unselectedLineClass(line), {
                    o_pos_mesomb_validate_pending: line.mesomb_validate_pending,
                });
            }
        };

    Registries.Component.extend(PaymentScreenPaymentLines, PosMeSombPaymentLines);

    return PaymentScreenPaymentLines;
});
