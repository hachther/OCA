odoo.define('pos_mesomb.models', function (require) {
    var models = require('point_of_sale.models');
    var PaymentMeSomb = require('pos_mesomb.payment');

    models.register_payment_method('mesomb', PaymentMeSomb);
    models.load_fields("pos.payment.method", ['pos_mesomb_config_id']);

    const superPaymentline = models.Paymentline.prototype;
    models.Paymentline = models.Paymentline.extend({
        initialize: function(attr, options) {
            superPaymentline.initialize.call(this,attr,options);
            // this.terminalServiceId = this.terminalServiceId  || null;
        },
        init_from_JSON: function (json) {
            superPaymentline.init_from_JSON.apply(this,arguments);

            this.paid = json.paid;
            this.mesomb_payer = json.mesomb_payer;
            this.mesomb_service = json.mesomb_service;
            this.mesomb_service_name = json.mesomb_service_name;
            this.mesomb_country = json.mesomb_country;
            this.mesomb_ref_no = json.mesomb_ref_no;
            this.mesomb_validate_pending = json.mesomb_validate_pending;
        },
        export_as_JSON: function () {
            const json = superPaymentline.export_as_JSON.call(this);
            json.paid = this.paid;
            json.mesomb_payer = this.mesomb_payer;
            json.mesomb_service = this.mesomb_service;
            json.mesomb_service_name = this.mesomb_service_name;
            json.mesomb_country = this.mesomb_country;
            json.mesomb_ref_no = this.mesomb_ref_no;
            json.mesomb_validate_pending = this.mesomb_validate_pending;
            return json;
        },
        set_payer_name: function () {
            if (this.mesomb_payer) {
                this.name = `${this.mesomb_service_name} (${this.mesomb_payer.substr(3)})`;
            }
        },
        is_done: function () {
            var res = superPaymentline.is_done.apply(this);
            return res && !this.mesomb_validate_pending;
        },
        export_for_printing: function () {
            const result = superPaymentline.export_for_printing.apply(this, arguments);
            result.mesomb_data = this.mesomb_data;
            // result.mercury_auth_code = this.mercury_auth_code;
            return result;
        }
    });

    models.PosModel = models.PosModel.extend({
        getOnlinePaymentMethods: function () {
            var online_payment_methods = [];
            $.each(this.payment_methods, function (i, payment_method) {
                if (payment_method.pos_mesomb_config_id) {
                    online_payment_methods.push({label: payment_method.name, item: payment_method.id});
                }
            });

            return online_payment_methods;
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
    });

    var _order_super = models.Order.prototype;
    models.Order = models.Order.extend({
        electronic_payment_in_progress: function() {
            var res = _order_super.electronic_payment_in_progress.apply(this, arguments);
            return res || this.get_paymentlines().some(line => line.mesomb_validate_pending);
        },
    });

});