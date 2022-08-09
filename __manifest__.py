# Copyright 2021 Tecnativa - David Vidal
# License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl).
{
    "name": "MeSomb PoS Payment",
    "summary": "Allows to pay with mobile payments (Mobile Money, Orange Money, Airtel Money ...) on the Point of Sale",
    "version": "12.0.1.0.0",
    "category": "Point Of Sale",
    "author": "Hachther LLC",
    "license": "AGPL-3",
    "depends": [
        'web',
        'point_of_sale',
    ],
    "data": [
        "views/pos_mesomb_templates.xml",
        "views/pos_mesomb_views.xml",
    ],
    "qweb": [
        'static/src/xml/pos_mesomb.xml'
    ],
    'installable': True,
    'auto_install': False,
    'license': 'LGPL-3',
}
