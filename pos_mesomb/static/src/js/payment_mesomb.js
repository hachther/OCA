odoo.define('pos_mesomb.payment', function (require) {
    "use strict";

    var core = require('web.core');
    var rpc = require('web.rpc');
    var PaymentInterface = require('point_of_sale.PaymentInterface');
    const {Gui} = require('point_of_sale.Gui');

    var _t = core._t;

    var PaymentMeSomb = PaymentInterface.extend({
    });

    return PaymentMeSomb;
});