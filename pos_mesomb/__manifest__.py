# Copyright 2023 Hachther
# License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl).
{
    "name": "MeSomb PoS Payment",
    "summary": "Allows to pay with mobile payments (Mobile Money, Orange Money, Airtel Money ...) on the Point of Sale",
    "version": "15.0.1.0.2",
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
    ],
    'installable': True,
    'auto_install': False,
    'assets': {
        'point_of_sale.assets': [
            'pos_mesomb/static/src/css/**/*.css',
            'pos_mesomb/static/src/js/**/*.js',
            'pos_mesomb/static/src/xml/**/*.xml',
        ],
    },
    'license': 'LGPL-3'
}
