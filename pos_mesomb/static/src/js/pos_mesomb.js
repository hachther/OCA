odoo.define('pos_mesomb.pos_mesomb', function (require) {
    var { PosGlobalState, Order, Payment } = require('point_of_sale.models');
    const Registries = require('point_of_sale.Registries');

    const PosMeSombPosGlobalState = (PosGlobalState) => class PosMeSombPosGlobalState extends PosGlobalState {
        getOnlinePaymentMethods () {
            var online_payment_methods = [];
            $.each(this.payment_methods, function (i, payment_method) {
                if (payment_method.pos_mesomb_config_id) {
                    online_payment_methods.push({label: payment_method.name, item: payment_method.id});
                }
            });

            return online_payment_methods;
        }

        // getCashRegisterByJournalID (journal_id) {
        //     var cashregister_return;
        //
        //     $.each(this.cashregisters, function (index, cashregister) {
        //         if (cashregister.journal_id[0] === journal_id) {
        //             cashregister_return = cashregister;
        //         }
        //     });
        //
        //     return cashregister_return;
        // }

        decodeMeSombResponse(data) {
            // get rid of xml version declaration and just keep the RStream
            // from the response because the xml contains two version
            // declarations. One for the SOAP, and one for the content. Maybe
            // we should unpack the SOAP layer in python?
            data = JSON.parse(data);

            return {
                status: data.status,
                message: data.message || data.detail,
                data: data.transaction,
                // amount: data.transaction?.trxamount,
                // payer: data.transaction?.b_party,
                // service: data.transaction?.service,
                // country: data.transaction?.country,
                // error: data.code,
                // card_type: tran_response.find("CardType").text(),
                // auth_code: tran_response.find("AuthCode").text(),
                // acq_ref_data: tran_response.find("AcqRefData").text(),
                // process_data: tran_response.find("ProcessData").text(),
                // invoice_no: tran_response.find("InvoiceNo").text(),
                ref_no: data.transaction?.name,
                record_no: data.transaction?.pk,
                // purchase: parseFloat(tran_response.find("Purchase").text()),
                // authorize: parseFloat(tran_response.find("Authorize").text()),
            };
        }
    }
    Registries.Model.extend(PosGlobalState, PosMeSombPosGlobalState);

    const PosMeSombPayment = (Payment) => class PosMeSombPayment extends Payment {
        // initialize: function(attr, options) {
        //     superPaymentline.initialize.call(this,attr,options);
        //     // this.terminalServiceId = this.terminalServiceId  || null;
        // },
        init_from_JSON(json) {
            super.init_from_JSON(...arguments);

            this.paid = json.paid;
            this.mesomb_payer = json.mesomb_payer;
            this.mesomb_service = json.mesomb_service;
            this.mesomb_service_name = json.mesomb_service_name;
            this.mesomb_country = json.mesomb_country;
            this.mesomb_ref_no = json.mesomb_ref_no;
            this.mesomb_validate_pending = json.mesomb_validate_pending;

            this.set_payer_name();
        }
        export_as_JSON() {
            return _.extend(super.export_as_JSON(...arguments), {
                paid: this.paid,
                mesomb_payer: this.mesomb_payer,
                mesomb_service: this.mesomb_service,
                mesomb_service_name: this.mesomb_service_name,
                mesomb_country: this.mesomb_country,
                mesomb_validate_pending: this.mesomb_validate_pending,
            })
        }
        set_payer_name () {
            if (this.mesomb_payer) {
                this.name = `${this.mesomb_service_name} (${this.mesomb_payer.substr(3)})`;
            }
        }
        is_done () {
            var res = super.is_done(...arguments);
            return res && !this.mesomb_validate_pending;
        }
        export_for_printing () {
            const result = super.export_for_printing(...arguments);
            result.mesomb_data = this.mesomb_data;
            // result.mercury_auth_code = this.mercury_auth_code;
            return result;
        }
    }
    Registries.Model.extend(Payment, PosMeSombPayment);

    const PosMeSombOrder = (Order) => class PosMeSombOrder extends Order {
        electronic_payment_in_progress() {
            var res = super.electronic_payment_in_progress(...arguments);
            return res || this.get_paymentlines().some(line => line.mesomb_validate_pending);
        }
    }
    Registries.Model.extend(Order, PosMeSombOrder);
});
