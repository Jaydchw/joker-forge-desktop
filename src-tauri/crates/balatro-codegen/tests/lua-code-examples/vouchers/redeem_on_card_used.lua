-- Example: redeem_on_card_used
-- Object: voucher
-- Purpose: verify card_used rules generate a redeem hook for vouchers.

SMODS.Voucher {
    key = 'v_redeem_on_card_used',
    pos = {
        x = 0,
        y = 0
    },
    config = {
        extra = { chips0 = 5 }
    },
    loc_txt = {
        ['name'] = 'Redeem On Card Used',
        ['text'] = {
            [1] = 'Gives chips when redeemed.'
        }
    },
    cost = 10,
    unlocked = true,
    discovered = true,
    no_collection = false,
    can_repeat_soul = false,
    atlas = 'Voucher',
    loc_vars = function(self, info_queue, card)
        return {
            vars = {
                self.config.extra.chips0
            }
        }
    end,
    redeem = function(self, card)
        return {
            chips = card.ability.extra.chips0
        }
    end
}
