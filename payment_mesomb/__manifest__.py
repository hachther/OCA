{
    'name': 'MeSomb Payment Acquirer',
    'version': '1.0',
    'category': 'Accounting/Payment Acquirers',
    'sequence': 390,
    'summary': 'Payment Acquirer: MeSomb Implementation',
    'description': """
Allows to pay with mobile payments (Mobile Money, Orange Money, Airtel Money ...) on the Point of Sale
""",
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
