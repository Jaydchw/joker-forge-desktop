-- Purpose: Snapshot for `create_and_destroy` (voucher) codegen output.

SMODS.Voucher {
    key = 'v_create_and_destroy',
    pos = {
        x = 0,
        y = 0
    },
    config = {
        extra = { create_cards_count0 = 1 }
    },
    loc_txt = {
        ['name'] = 'Create And Destroy',
        ['text'] = {
            [1] = 'Voucher fixture with creation/destruction effects.'
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
                self.config.extra.create_cards_count0
            }
        }
    end,
    redeem = function(self, card)
        do
            SMODS.add_card({ set = 'Base' })
            if #G.consumeables.cards > 0 then local c = pseudorandom_element(G.consumeables.cards, pseudoseed('destroy_consumable')); if c then SMODS.destroy_cards({c}) end end
            return {
                message = 'Added Cards!',
                colour = G.C.GREEN,
                extra = {
                    message = 'Destroyed Consumable!',
                    colour = G.C.RED
                }
            }
        end
    end
}
