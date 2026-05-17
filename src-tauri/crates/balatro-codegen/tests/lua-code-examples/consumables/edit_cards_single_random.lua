-- Purpose: Snapshot for `edit_cards_single_random` (consumable) codegen output.

SMODS.Consumable {
    key = 'c_edit_cards_single_random',
    set = 'Tarot',
    pos = {
        x = 0,
        y = 0
    },
    config = {
        extra = { edit_count0 = 1 }
    },
    loc_txt = {
        ['name'] = 'Edit Cards Single Random',
        ['text'] = {
            [1] = 'Edits one random card with minimal scaffolding.'
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
                self.config.extra.edit_count0
            }
        }
    end,
    use = function(self, card, area, copier)
        local _card = pseudorandom_element(G.hand.cards, pseudoseed('edit_cards'))
        if not _card then return end
        assert(SMODS.change_base(_card, nil, 'Ace'))
        return {
            colour = G.C.SECONDARY_SET.Tarot
        }
    end,
    can_use = function(self, card)
        return true
    end
}
