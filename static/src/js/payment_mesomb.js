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

/*
odoo.define("pos_mesomb.screens", function (require) {
    "use strict";

    var core = require('web.core');
    var rpc = require('web.rpc');
    var screens = require('point_of_sale.screens');
    var gui = require('point_of_sale.gui');
    var pos_model = require('point_of_sale.models');

    var _t = core._t;

    var PopupWidget = require('point_of_sale.popups');
    var ScreenWidget = screens.ScreenWidget;
    var PaymentScreenWidget = screens.PaymentScreenWidget;

    var widget = null;
    var providers = [
        {value: 'MTN', label: 'Mobile Money', countries: ['CM']},
        {value: 'ORANGE', label: 'Orange Money', countries: ['CM']},
        {value: 'AIRTEL', label: 'Airtel Money', countries: ['NE']},
    ]
    var countryCode = {
        'Niger': 'NE',
        'Cameroon': 'CM',
        'Cameroun': 'CM'
    }

    var MeSombPopupWidget = PopupWidget.extend({
        template: 'MeSombPopupWidget',
        events: _.extend({}, PopupWidget.prototype.events, {
            'click .confirm': 'click_confirm',
            'keydown': 'on_keydown',
            // 'blur .packlot-line-input': 'lose_input_focus'
        }),
        show: function (options) {
            options = options || {};
            this._super(options);

            this.renderElement();
            this.$('input,textarea')[0].focus();
        },
        click_confirm: function () {
            const payer = this.$('#mesomb_payer').val();
            const service = this.$('#mesomb_service').val();
            const country = this.$('#mesomb_country').val();
            const amount = parseFloat(this.$('#mesomb_amount').val() || '0');
            if (payer.length > 0 && amount > 0) {
                widget.credit_code_action({
                    payer,
                    service,
                    country: country || this.mesombCountry,
                    amount
                });
                this.gui.close_popup();
            }
        },
        on_keydown: function (ev) {
            var input = $(ev.target);
            if (input) {
                var val = input.val();
                if (ev.which >= 48 && ev.which <= 57) {
                    val = `${val}${ev.key}`;
                }
                if (ev.which === 8 && val.length > 0) {
                    val = val.substring(0, val.length - 1);
                }
                input.val(val);
            }
        }
        //
        // init: function () {
        //     // alert(1);
        //     const self = this;
        //     this.cancelBtn = document.getElementById('pos-btn-cancel');
        //     // const btnCancel = document.getElementById('pos-btn-cancel');
        //     // console.dir($('#pos-btn-cancel'));
        //     $(this.cancelBtn).on('click', function () {
        //         self.gui.close_popup();
        //     })
        // },
    });
    gui.define_popup({name: 'mesomb_info', widget: MeSombPopupWidget});

    var MeSombTransactionPopupWidget = PopupWidget.extend({
        template: 'MeSombTransactionPopupWidget',
        show: function (options) {
            var self = this;
            this._super(options);
            options.transaction.then(function (data) {
                if (data.auto_close) {
                    setTimeout(function () {
                        self.gui.close_popup();
                    }, 2000);
                } else {
                    self.close();
                    self.$el.find('.popup').append('<div class="footer"><div class="button cancel">Ok</div></div>');
                }

                self.$el.find('p.body').html(data.message);
            }).progress(function (data) {
                self.$el.find('p.body').html(data.message);
            });
        }
    });
    gui.define_popup({name: 'mesomb-transaction', widget: MeSombTransactionPopupWidget});

    ScreenWidget.include({
        credit_error_action: function () {
            this.gui.show_popup('error-barcode', _t('Go to payment screen to use cards'));
        },

        show: function () {
            this._super();
            if (this.pos.getOnlinePaymentJournals().length !== 0) {
                this.pos.barcode_reader.set_action_callback('credit', _.bind(this.credit_error_action, this));
            }
        }
    });

    PaymentScreenWidget.include({
        click_paymentmethods: function (id) {
            var i;
            var order = this.pos.get_order();
            var cashregister = null;
            for (i = 0; i < this.pos.cashregisters.length; i++) {
                if (this.pos.cashregisters[i].journal_id[0] === id) {
                    cashregister = this.pos.cashregisters[i];
                    break;
                }
            }
            if (cashregister.journal.mesomb_payment_terminal) {
                var mesomb_validate_pending = false;
                var lines = order.get_paymentlines();

                for (i = 0; i < lines.length; i++) {
                    if (lines[i].cashregister.journal.mesomb_payment_terminal && lines[i].mesomb_validate_pending) {
                        mesomb_validate_pending = true;
                    }
                }

                if (mesomb_validate_pending) {
                    this.gui.show_popup('error', {
                        'title': _t('Error'),
                        'body': _t('One MeSomb payment is already pending validation'),
                    });
                } else {
                    this._super(id);
                    if (order.get_due(order.selected_paymentline) > 0) {
                        order.selected_paymentline.mesomb_validate_pending = true;
                        this.render_paymentlines();
                        order.trigger('change', order); // needed so that export_to_JSON gets triggered

                        this.gui.show_popup('mesomb_info', {
                            title: _t('Payment Confirmation'),
                            services: this.mesombCountry ? providers.filter(s => s.countries.includes(this.mesombCountry)) : providers,
                            countries: this.mesombCountry ? null : [{value: 'CM', label: _t('Cameroon')}, {value: 'NE', label: _t('Niger')}],
                            amount: order.get_due(),
                        });
                    }
                }
            } else {
                this._super(id);
            }
        },

        show: function () {
            this._super();
            widget = this;
            this.mesombCountry = null;
            if (this.pos.company.country) {
                this.mesombCountry = countryCode[this.pos.company.country.name];
            }
            // if (this.pos.getOnlinePaymentJournals().length !== 0) {
            //     this.pos.barcode_reader.set_action_callback('credit', _.bind(this.credit_code_action, this));
            // }
        },

        validate_order: function (force_validation) {
            if (this.pos.get_order().is_paid() && !this.invoicing) {
                var lines = this.pos.get_order().get_paymentlines();

                for (var i = 0; i < lines.length; i++) {
                    if (lines[i].mesomb_validate_pending) {
                        this.pos.get_order().remove_paymentline(lines[i]);
                        this.render_paymentlines();
                    }
                }
            }

            this._super(force_validation);
        }
    });
});
*/
