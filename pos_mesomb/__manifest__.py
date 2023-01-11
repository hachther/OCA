# Copyright 2022 Hachther
# License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl).
{
    "name": "MeSomb PoS Payment",
    "summary": "Allows to pay with mobile payments (Mobile Money, Orange Money, Airtel Money ...) on the Point of Sale",
    "version": "14.0.1.0.1",
    "category": "Point Of Sale",
    "website": "https://mesomb.com",
    "author": "Hachther LLC <contact@hachther.com>",
    "license": "AGPL-3",
    "images": ["static/description/banner.png"],
    "depends": [
        'web',
        'point_of_sale',
    ],
    "data": [
        "security/ir.model.access.csv",
        "views/pos_mesomb_views.xml",
        "views/point_of_sale_assets.xml",
    ],
    "qweb": [
        'static/src/xml/popups/PaymentFormPopup.xml',
        'static/src/xml/popups/MeSombPaymentTransactionPopup.xml',
        'static/src/xml/pos_mesomb.xml',
        'static/src/xml/PaymentScreenPaymentLines.xml',
    ],
    'installable': True,
    'auto_install': False,
    'license': 'LGPL-3'
}
