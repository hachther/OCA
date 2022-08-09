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

    pos_model.load_fields("account.journal", ['mesomb_payment_terminal', 'mesomb_app_key', 'mesomb_currency_conversion', 'mesomb_test_mode']);

    pos_model.PosModel = pos_model.PosModel.extend({
        getOnlinePaymentJournals: function () {
            var self = this;
            var online_payment_journals = [];

            $.each(this.journals, function (i, val) {
                if (val.mesomb_payment_terminal) {
                    online_payment_journals.push({
                        label: self.getCashRegisterByJournalID(val.id).journal_id[1],
                        item: val.id
                    });
                }
            });

            return online_payment_journals;
        },
        getCashRegisterByJournalID: function (journal_id) {
            var cashregister_return;

            $.each(this.cashregisters, function (index, cashregister) {
                if (cashregister.journal_id[0] === journal_id) {
                    cashregister_return = cashregister;
                }
            });

            return cashregister_return;
        },
        decodeMeSombResponse: function (data) {
            // get rid of xml version declaration and just keep the RStream
            // from the response because the xml contains two version
            // declarations. One for the SOAP, and one for the content. Maybe
            // we should unpack the SOAP layer in python?
            data = JSON.parse(data);

            return {
                status: data.status || 'FAILURE',
                message: data.message || data.detail,
                amount: (data.transaction || {}).trxamount,
                payer: (data.transaction || {}).b_party,
                service: (data.transaction || {}).service,
                country: (data.transaction || {}).country,
                error: data.code,
                // card_type: tran_response.find("CardType").text(),
                // auth_code: tran_response.find("AuthCode").text(),
                // acq_ref_data: tran_response.find("AcqRefData").text(),
                // process_data: tran_response.find("ProcessData").text(),
                // invoice_no: tran_response.find("InvoiceNo").text(),
                ref_no: (data.transaction || {}).pk,
                // record_no: tran_response.find("RecordNo").text(),
                // purchase: parseFloat(tran_response.find("Purchase").text()),
                // authorize: parseFloat(tran_response.find("Authorize").text()),
            };
        }
    });

    var _paylineproto = pos_model.Paymentline.prototype;
    pos_model.Paymentline = pos_model.Paymentline.extend({
        init_from_JSON: function (json) {
            _paylineproto.init_from_JSON.apply(this, arguments);

            this.paid = json.paid;
            this.mesomb_payer = json.mesomb_payer;
            this.mesomb_service = json.mesomb_service;
            this.mesomb_service_name = json.mesomb_service_name;
            this.mesomb_country = json.mesomb_country;
            this.mesomb_ref_no = json.mesomb_ref_no;
            this.mesomb_validate_pending = json.mesomb_validate_pending;
        },
        export_as_JSON: function () {
            return _.extend(_paylineproto.export_as_JSON.apply(this, arguments), {
                paid: this.paid,
                mesomb_payer: this.mesomb_payer,
                mesomb_service: this.mesomb_service,
                mesomb_service_name: this.mesomb_service_name,
                mesomb_country: this.mesomb_country,
                mesomb_ref_no: this.mesomb_ref_no,
                mesomb_validate_pending: this.mesomb_validate_pending
            });
        },
    });

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
            this.$('input,textarea').focus();
        },
        click_confirm: function () {
            const payer = this.$('#mesomb_payer').val();
            const service = this.$('#mesomb_service').val();
            const country = this.$('#mesomb_country').val();
            if (payer.length > 0) {
                widget.credit_code_action({
                    payer,
                    service,
                    country: country || this.mesombCountry
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
        // How long we wait for the odoo server to deliver the response of
        // a Mercury transaction
        server_timeout_in_ms: 95000,

        // How many Mercury transactions we send without receiving a
        // response
        server_retries: 3,

        _get_validate_pending_line: function () {
            var i = 0;
            var lines = this.pos.get_order().get_paymentlines();

            for (i = 0; i < lines.length; i++) {
                if (lines[i].mesomb_validate_pending) {
                    return lines[i];
                }
            }

            return 0;
        },

        _does_credit_payment_line_exist: function (amount, payer, service, country) {
            var i = 0;
            var lines = this.pos.get_order().get_paymentlines();

            for (i = 0; i < lines.length; i++) {
                if (lines[i].mesomb_amount === amount &&
                    lines[i].mesomb_payer === payer &&
                    lines[i].mesomb_service === service &&
                    lines[i].mesomb_country === country) {
                    return true;
                }
            }

            return false;
        },

        retry_mesomb_transaction: function (def, response, retry_nr, can_connect_to_server, callback, args) {
            var self = this;
            var message = "";

            if (retry_nr < self.server_retries) {
                if (response) {
                    message = "Retry #" + (retry_nr + 1) + "...<br/><br/>" + response.message;
                } else {
                    message = "Retry #" + (retry_nr + 1) + "...";
                }
                def.notify({
                    message: message
                });

                setTimeout(function () {
                    callback.apply(self, args);
                }, 1000);
            } else {
                if (response) {
                    message = "Error " + response.error + ": " + lookUpCodeTransaction["TimeoutError"][response.error] + "<br/>" + response.message;
                } else {
                    if (can_connect_to_server) {
                        message = _t("No response from MeSomb (MeSomb down?)");
                    } else {
                        message = _t("No response from server (connected to network?)");
                    }
                }
                def.resolve({
                    message: message,
                    auto_close: false
                });
            }
        },

        // Handler to manage the card reader string
        credit_code_transaction: function (parsed_result, old_deferred, retry_nr) {
            var order = this.pos.get_order();
            if (order.get_due(order.selected_paymentline) < 0) {
                this.gui.show_popup('error', {
                    'title': _t('Refunds not supported'),
                    'body': _t('Credit card refunds are not supported. Instead select your credit card payment method, click \'Validate\' and refund the original charge manually through the Vantiv backend.'),
                });
                return;
            }

            if (this.pos.getOnlinePaymentJournals().length === 0) {
                return;
            }

            var self = this;

            var validate_pending_line = self._get_validate_pending_line();
            var purchase_amount = 0;

            // if (validate_pending_line) {
            //     purchase_amount = validate_pending_line.get_amount();
            // } else {
            //     purchase_amount = self.pos.get_order().get_due();
            // }
            purchase_amount = self.pos.get_order().get_due();
            const customer = self.pos.get_order().attributes?.client;
            // console.log('purchase_amount', purchase_amount);

            var transaction = {
                amount: purchase_amount,
                payer: parsed_result.payer,
                service: parsed_result.service,
                country: parsed_result.country,
                reference: self.pos.get_order().uid,
                currency: self.pos.currency.name,
                journal_id: parsed_result.journal_id,
            };
            if (customer) {
                transaction.customer = {
                    name: customer.name,
                    town: customer.city,
                    region: customer.state_id ? customer.state_id[1] : null,
                    country: customer.country_id ? customer.state_id[1] : null,
                    email: customer.email,
                    phone: customer.phone,
                    address_1: customer.address,
                    postcode: customer.zip,
                }
            }

            var def = old_deferred || new $.Deferred();
            retry_nr = retry_nr || 0;

            // show the transaction popup.
            // the transaction deferred is used to update transaction status
            // if we have a previous deferred it indicates that this is a retry
            if (!old_deferred) {
                self.gui.show_popup('payment-transaction', {
                    transaction: def
                });
                def.notify({
                    message: _t('Handling transaction...'),
                });
            }

            rpc.query({
                model: 'pos_mesomb.mesomb_transaction',
                method: 'do_payment',
                args: [transaction],
            }, {
                timeout: self.server_timeout_in_ms,
            })
                .then(function (data) {
                    // if not receiving a response from Mercury, we should retry
                    if (data === "timeout") {
                        self.retry_mesomb_transaction(def, null, retry_nr, true, self.credit_code_transaction, [parsed_result, def, retry_nr + 1]);
                        return;
                    }

                    if (data === "not setup") {
                        def.resolve({
                            message: _t("Please setup your Mercury merchant account.")
                        });
                        return;
                    }

                    if (data === "internal error") {
                        def.resolve({
                            message: _t("Odoo error while processing transaction.")
                        });
                        return;
                    }

                    var response = self.pos.decodeMeSombResponse(data);
                    response.journal_id = parsed_result.journal_id;

                    if (response.status === 'SUCCESS') {
                        // AP* indicates a duplicate request, so don't add anything for those
                        if (self._does_credit_payment_line_exist(response.amount, transaction.payer,
                            transaction.service, transaction.country)) {
                            def.resolve({
                                message: response.message,
                                auto_close: true,
                            });
                        } else {
                            // If the payment is approved, add a payment line
                            var order = self.pos.get_order();

                            if (validate_pending_line) {
                                order.select_paymentline(validate_pending_line);
                            } else {
                                order.add_paymentline(self.pos.getCashRegisterByJournalID(parsed_result.journal_id));
                            }

                            order.selected_paymentline.paid = true;
                            order.selected_paymentline.mesomb_validate_pending = false;
                            order.selected_paymentline.mesomb_amount = response.amount;
                            order.selected_paymentline.set_amount(response.amount);
                            order.selected_paymentline.mesomb_payer = response.payer;
                            order.selected_paymentline.mesomb_service = response.service;
                            order.selected_paymentline.mesomb_service_name = providers.find(p => p.value === response.service)?.label;
                            order.selected_paymentline.mesomb_country = response.country;
                            order.selected_paymentline.mesomb_ref_no = response.ref_no;
                            // order.selected_paymentline.mercury_record_no = response.record_no;
                            // order.selected_paymentline.mercury_invoice_no = response.invoice_no;
                            // order.selected_paymentline.mercury_auth_code = response.auth_code;
                            order.selected_paymentline.mesomb_data = response; // used to reverse transactions
                            order.selected_paymentline.set_credit_card_name();

                            self.order_changes();
                            self.reset_input();
                            self.render_paymentlines();
                            order.trigger('change', order); // needed so that export_to_JSON gets triggered

                            def.resolve({
                                message: response.message,
                                auto_close: true,
                            });
                        }
                    }

                    // if an error related to timeout or connectivity issues arised, then retry the same transaction
                    else {
                        // if (lookUpCodeTransaction["TimeoutError"][response.error]) { // recoverable error
                        //     self.retry_mesomb_transaction(def, response, retry_nr, true, self.credit_code_transaction, [parsed_result, def, retry_nr + 1]);
                        // } else { // not recoverable
                        // }
                        def.resolve({
                            message: "Error " + response.error + ":<br/>" + response.message,
                            auto_close: false
                        });
                    }
                })
                .fail(function (type, error) {
                    self.retry_mesomb_transaction(def, null, retry_nr, false, self.credit_code_transaction, [parsed_result, def, retry_nr + 1]);
                });
        },

        credit_code_cancel: function () {
            return;
        },

        credit_code_action: function (parsed_result) {
            var self = this;
            var online_payment_journals = this.pos.getOnlinePaymentJournals();

            if (online_payment_journals.length === 1) {
                parsed_result.journal_id = online_payment_journals[0].item;
                self.credit_code_transaction(parsed_result);
            } else { // this is for supporting another payment system like mercury
                this.gui.show_popup('selection', {
                    title: _t('Pay with: '),
                    list: online_payment_journals,
                    confirm: function (item) {
                        parsed_result.journal_id = item;
                        self.credit_code_transaction(parsed_result);
                    },
                    cancel: self.credit_code_cancel,
                });
            }
        },

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
