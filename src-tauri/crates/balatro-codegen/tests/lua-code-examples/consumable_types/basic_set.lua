-- Purpose: verify custom consumable-set objects compile with expected fields.

SMODS.ConsumableType {
    key = 'coolset',
    primary_colour = HEX('666666'),
    secondary_colour = HEX('666666'),
    collection_rows = {
        4,
        5
    },
    shop_rate = 1,
    loc_txt = {
        name = 'Cool Set',
        collection = 'Cool Cards'
    },
    cards = {}
}
