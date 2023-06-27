# Copyright 2023 Hachther
# License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl).
{
    'name': 'MeSomb Payment Acquirer',
    'summary': "Payment Acquirer: Allows to pay with mobile payments (Mobile Money, Orange Money, Airtel Money ...)",
    'version': "15.0.1.0.1",
    'category': 'Accounting/Payment Acquirers',
    'website': "https://mesomb.com",
    'author': "Hachther LLC <contact@hachther.com>",
    'images': ["static/description/banner.png"],
    'depends': ['payment'],
    'data': [
        'views/payment_templates.xml',
        'views/payment_mesomb_templates.xml',
        'data/payment_icon_data.xml',
        'data/payment_acquirer_data.xml',
    ],
    'application': True,
    'uninstall_hook': 'uninstall_hook',
    'assets': {
        'web.assets_frontend': [
            'payment_mesomb/static/src/js/payment_form.js',
            'payment_mesomb/static/src/css/styles.css',
        ],
    },
    'license': 'LGPL-3',
}
