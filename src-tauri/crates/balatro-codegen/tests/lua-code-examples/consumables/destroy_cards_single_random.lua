-- Purpose: Snapshot for `destroy_cards_single_random` (consumable) codegen output.

SMODS.Consumable {
    key = 'c_destroy_cards_single_random',
    set = 'Tarot',
    pos = {
        x = 0,
        y = 0
    },
    config = {
        extra = { destroy_count0 = 1 }
    },
    loc_txt = {
        ['name'] = 'Destroy Cards Single Random',
        ['text'] = {
            [1] = 'Destroys one random card.'
        }
    },
    cost = 3,
    unlocked = true,
    discovered = true,
    hidden = false,
    can_repeat_soul = false,
    atlas = 'Consumables',
    loc_vars = function(self, info_queue, card)
        return {
            vars = {
                self.config.extra.destroy_count0
            }
        }
    end,
    use = function(self, card, area, copier)
        if G.hand and G.hand.cards and #G.hand.cards > 0 then local c = pseudorandom_element(G.hand.cards, pseudoseed('destroy_cards')); if c then SMODS.destroy_cards({c}) end end
        return {
            message = 'Destroyed Cards!',
            colour = G.C.RED
        }
    end,
    can_use = function(self, card)
        return true
    end
}
