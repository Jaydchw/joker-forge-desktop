-- Purpose: verify both calculate and apply hooks for deck triggers.

SMODS.Back {
    key = 'b_apply_and_calculate',
    pos = {
        x = 0,
        y = 0
    },
    config = {
        extra = {
            chips0 = 2,
            mult0 = 3
        }
    },
    loc_txt = {
        ['name'] = 'Apply And Calculate',
        ['text'] = {
            [1] = 'Has both calculate and apply hooks.'
        }
    },
    unlocked = true,
    discovered = true,
    no_collection = false,
    atlas = 'Enhancers',
    loc_vars = function(self, info_queue, card)
        return {
            vars = {
                self.config.extra.chips0,
                self.config.extra.mult0
            }
        }
    end,
    calculate = function(self, card, context)
        if context.main_eval then
            return {
                chips = back.ability.extra.chips0
            }
        end
    end,
    apply = function(self, back)
        return {
            mult = back.ability.extra.mult0
        }
    end
}
