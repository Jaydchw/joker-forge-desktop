-- Purpose: verify scoring trigger emits calculate hook and payload.

SMODS.Enhancement {
    key = 'm_card_scored_bonus',
    pos = {
        x = 0,
        y = 0
    },
    config = {
        bonus = 5,
        extra = { chips0 = 5 }
    },
    loc_txt = {
        ['name'] = 'Card Scored Bonus',
        ['text'] = {
            [1] = 'Adds chips on card scored.'
        }
    },
    atlas = 'centers',
    any_suit = false,
    replace_base_card = false,
    no_rank = false,
    no_suit = false,
    always_scores = false,
    unlocked = true,
    discovered = true,
    no_collection = false,
    weight = 1,
    loc_vars = function(self, info_queue, card)
        return {
            vars = {
                self.config.extra.chips0
            }
        }
    end,
    calculate = function(self, card, context)
        if context.main_scoring and context.cardarea == G.play then
            do
                return {
                    chips = card.ability.extra.chips0
                }
            end
        end
    end
}
