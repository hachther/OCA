odoo.define('pos_mesomb.PaymentScreen', function(require) {
    "use strict";

    const { _t } = require('web.core');
    const PaymentScreen = require('point_of_sale.PaymentScreen');
    const Registries = require('point_of_sale.Registries');
    const NumberBuffer = require('point_of_sale.NumberBuffer');

    const providers = [
        {value: 'MTN', label: 'Mobile Money', countries: ['CM']},
        {value: 'ORANGE', label: 'Orange Money', countries: ['CM']},
        {value: 'AIRTEL', label: 'Airtel Money', countries: ['NE']},
    ]

    var countryCode = {
        'Niger': 'NE',
        'Cameroon': 'CM',
        'Cameroun': 'CM'
    }

    const PosMeSombPaymentScreen = (PaymentScreen) => class extends PaymentScreen {
        setup() {
            super.setup();
            // How long we wait for the odoo server to deliver the response of
            // a Mercury transaction
            this.server_timeout_in_ms = 95000;

            // How many Mercury transactions we send without receiving a
            // response
            this.server_retries = 3;
            this.mesombCountry = this.env.pos.company.country.code
            // onMounted(() => {
            //     // const pendingPaymentLine = this.currentOrder.paymentlines.find(
            //     //     paymentLine => paymentLine.payment_method.use_payment_terminal === 'mesomb' &&
            //     //         (!paymentLine.is_done() && paymentLine.get_payment_status() !== 'pending')
            //     // );
            //     // if (pendingPaymentLine) {
            //     //     const paymentTerminal = pendingPaymentLine.payment_method.payment_terminal;
            //     //     paymentTerminal.set_most_recent_service_id(pendingPaymentLine.terminalServiceId);
            //     //     pendingPaymentLine.set_payment_status('waiting');
            //     //     paymentTerminal.start_get_status_polling().then(isPaymentSuccessful => {
            //     //         if (isPaymentSuccessful) {
            //     //             pendingPaymentLine.set_payment_status('done');
            //     //             pendingPaymentLine.can_be_reversed = paymentTerminal.supports_reversals;
            //     //         } else {
            //     //             pendingPaymentLine.set_payment_status('retry');
            //     //         }
            //     //     });
            //     // }
            // });
        }

        /**
         * Finish any pending input before trying to validate.
         *
         * @override
         */
        async validateOrder(isForceValidate) {
            NumberBuffer.capture();
            return super.validateOrder(...arguments);
        }

        _does_credit_payment_line_exist(amount, payer, service, country) {
            const lines = this.env.pos.get_order().get_paymentlines();

            for (let i = 0; i < lines.length; i++) {
                if (lines[i].mesomb_amount === amount &&
                    lines[i].mesomb_payer === payer &&
                    lines[i].mesomb_service === service &&
                    lines[i].mesomb_country === country) {
                    return true;
                }
            }

            return false;
        }

        async addNewPaymentLine({ detail: paymentMethod }) {
            if (paymentMethod.use_payment_terminal !== 'mesomb') {
                return super.addNewPaymentLine(...arguments);
            }
            const order = this.env.pos.get_order();
            let mesomb_validate_pending = this.paymentLines.findIndex(l => l.payment_method.use_payment_terminal === 'mesomb' && l.mesomb_validate_pending) >= 0;
            // console.dir(lines);
            if (mesomb_validate_pending) {
                this.showPopup('ErrorPopup', {
                    title: _t('Error'),
                    body: _t('One MeSomb payment is already pending validation'),
                });
                return
            }
            const res = super.addNewPaymentLine(...arguments);
            if (order.get_due(order.selected_paymentline) > 0) {
                order.selected_paymentline.mesomb_validate_pending = true;
            //     // this.render_paymentlines();
            //     // order.trigger('change', order); // needed so that export_to_JSON gets triggered
            //
                const services = this.mesombCountry ? providers.filter(s => s.countries.includes(this.mesombCountry)) : providers;
                const ret = await this.showPopup('PaymentFormPopup', {
                    services,
                    service: services[0]?.value,
                    countries: this.mesombCountry ? null : [{value: 'CM', label: _t('Cameroon')}, {value: 'NE', label: _t('Niger')}],
                    amount: order.get_due(),
                    payer: order.attributes?.client?.phone,
                });
                if (ret.confirmed) {
                    this.credit_code_action({
                        ...ret.payload,
                        country: ret.payload.country || this.mesombCountry,
                    });
                } else {
                    order.remove_paymentline(order.selected_paymentline)
                }
            }
        }

        _get_validate_pending_line () {
            var i = 0;
            var lines = this.env.pos.get_order().get_paymentlines();

            for (i = 0; i < lines.length; i++) {
                if (lines[i].mesomb_validate_pending) {
                    return lines[i];
                }
            }

            return 0;
        }

        credit_code_action(parsed_result) {
            var online_payment_methods = this.env.pos.getOnlinePaymentMethods();

            if (online_payment_methods.length === 0) {
                this.showPopup('ErrorPopup', {
                    'title': _t('Missing Configuration'),
                    'body': _t("MeSomb service configuration is missing please check your configuration in settings and try again."),
                });
            } else if (online_payment_methods.length === 1) {
                parsed_result.payment_method_id = online_payment_methods[0].item;
                this.credit_code_transaction(parsed_result);
            } else {
                // this is for supporting another payment system like mercury
                const selectionList = online_payment_methods.map((paymentMethod) => ({
                    id: paymentMethod.item,
                    label: paymentMethod.label,
                    isSelected: false,
                    item: paymentMethod.item,
                }));
                this.showPopup('SelectionPopup', {
                    title: this.env._t('Pay with: '),
                    list: selectionList,
                }).then(({ confirmed, payload: selectedPaymentMethod }) => {
                    if (confirmed) {
                        parsed_result.payment_method_id = selectedPaymentMethod;
                        this.credit_code_transaction(parsed_result);
                    } else {
                        this.credit_code_cancel();
                    }
                });
            }
        }

        // Handler to manage the card reader string
        credit_code_transaction(parsed_result, old_deferred, retry_nr) {
            var order = this.env.pos.get_order();
            if (order.get_due(order.selected_paymentline) < 0) {
                this.showPopup('ErrorPopup', {
                    'title': _t('Refunds not supported'),
                    'body': _t("Payment refunds are not supported. Instead, select your cash payment method, click 'Validate' and refund the original charge manually through the MeSomb backend."),
                });
                return;
            }

            if (this.env.pos.getOnlinePaymentMethods().length === 0) {
                return;
            }
            const self = this;

            const validate_pending_line = this._get_validate_pending_line();
            // let purchase_amount;
            //
            // if (validate_pending_line) {
            //     purchase_amount = validate_pending_line.get_amount();
            // } else {
            //     purchase_amount = self.env.pos.get_order().get_due();
            // }
            const customer = order.attributes?.client;

            var transaction = {
                amount: parsed_result.amount,
                payer: parsed_result.payer,
                service: parsed_result.service,
                country: parsed_result.country,
                reference: order.uid,
                currency: this.env.pos.currency.name,
                journal_id: parsed_result.journal_id,
                payment_method_id: parsed_result.payment_method_id,
                products: order.get_orderlines().map(l => ({id: l.product.default_code, quantity: l.quantity, amount: l.price * l.quantity, name: l.product.display_name, category: l.product.categ?.name}))
            };
            if (customer) {
                transaction.customer = {
                    name: customer.name,
                    town: customer.city,
                    region: customer.state_id ? customer.state_id[1] : null,
                    country: customer.country_id ? customer.state_id[1] : null,
                    email: customer.email,
                    phone: customer.phone,
                    address: customer.address,
                    postcode: customer.zip,
                }
            }

            var def = old_deferred || new $.Deferred();
            retry_nr = retry_nr || 0;

            // show the transaction popup.
            // the transaction deferred is used to update transaction status
            // if we have a previous deferred it indicates that this is a retry
            if (!old_deferred) {
                this.showPopup('PaymentTransactionPopup', {
                    transaction: def
                });
                def.notify({
                    message: _t('Handling transaction...'),
                });
            }

            this.rpc({
                model: 'pos_mesomb.mesomb_transaction',
                method: 'do_payment',
                args: [transaction],
            }, {
                timeout: this.server_timeout_in_ms,
            })
                .then(function (data) {
                    // if not receiving a response from Mercury, we should retry
                    if (data === "timeout") {
                        self.retry_mesomb_transaction(def, null, retry_nr, true, self.credit_code_transaction, [parsed_result, def, retry_nr + 1]);
                        return;
                    }

                    if (data === "not setup") {
                        def.resolve({
                            message: _t("Please setup your MeSomb account.")
                        });
                        return;
                    }

                    if (data === "internal error") {
                        def.resolve({
                            message: _t("Odoo error while processing transaction.")
                        });
                        return;
                    }

                    const {status, data: response, message} = self.env.pos.decodeMeSombResponse(data);
                    const order = self.env.pos.get_order();

                    if (status === 'SUCCESS') {
                        response.payment_method_id = parsed_result.payment_method_id;
                        // AP* indicates a duplicate request, so don't add anything for those
                        if (self._does_credit_payment_line_exist(response.trxamount, transaction.payer,
                            transaction.service, transaction.country)) {
                            def.resolve({
                                message: response.message,
                                auto_close: true,
                            });
                        } else {
                            // If the payment is approved, add a payment line

                            if (validate_pending_line) {
                                order.select_paymentline(validate_pending_line);
                            } else {
                                order.add_paymentline(
                                    self.payment_methods_by_id[parsed_result.payment_method_id]
                                );
                            }

                            order.selected_paymentline.paid = true;
                            order.selected_paymentline.mesomb_validate_pending = false;
                            order.selected_paymentline.mesomb_amount = response.trxamount;
                            order.selected_paymentline.set_amount(response.trxamount);
                            order.selected_paymentline.mesomb_payer = response.b_party;
                            order.selected_paymentline.mesomb_service = response.service;
                            order.selected_paymentline.mesomb_service_name = providers.find(p => p.value === response.service)?.label;
                            order.selected_paymentline.mesomb_country = response.country;
                            order.selected_paymentline.mesomb_ref_no = response.name;
                            order.selected_paymentline.mesomb_record_no = response.pk;
                            // order.selected_paymentline.mercury_invoice_no = response.invoice_no;
                            // order.selected_paymentline.mercury_auth_code = response.auth_code;
                            order.selected_paymentline.mesomb_data = response; // used to reverse transactions
                            order.selected_paymentline.set_payer_name();
                            order.selected_paymentline.set_payment_status('done');

                            NumberBuffer.reset();
                            // order.trigger('change', order); // needed so that export_to_JSON gets triggered
                            self.render();

                            def.resolve({
                                message,
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
                        order.selected_paymentline.set_payment_status('failed');
                        def.resolve({
                            message,
                            auto_close: false
                        });
                    }
                })
                .catch(function (e) {
                    console.dir(e);
                    // self.retry_mesomb_transaction(
                    //     def,
                    //     null,
                    //     retry_nr,
                    //     false,
                    //     self.credit_code_transaction,
                    //     [parsed_result, def, retry_nr + 1]
                    // );
                });
        }

        retry_mesomb_transaction(def, response, retry_nr, can_connect_to_server, callback, args) {
            var self = this;
            var message = "";

            if (retry_nr < this.server_retries) {
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
                this.currentOrder.selected_paymentline.set_payment_status('failed');
                def.resolve({
                    message: message,
                    auto_close: false
                });
            }
        }

        credit_code_cancel() {
            return;
        }

        /**
         * @override
         */
        deletePaymentLine(event) {
            const { cid } = event.detail;
            const line = this.paymentLines.find((line) => line.cid === cid);
            if (line.mesomb_data) {
                this.do_reversal(line, false);
            } else {
                super.deletePaymentLine(event);
            }
        }
    };

    Registries.Component.extend(PaymentScreen, PosMeSombPaymentScreen);

    return PaymentScreen;
});
