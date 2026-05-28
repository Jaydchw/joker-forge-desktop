-- Purpose: verify seal scoring trigger emits calculate hook and payload.

SMODS.Seal {
    key = 's_card_scored_bonus',
    pos = {
        x = 0,
        y = 0
    },
    config = {
        extra = { chips0 = 5 }
    },
    badge_colour = HEX('FF0000'),
    loc_txt = {
        ['name'] = 'Card Scored Bonus Seal',
        ['label'] = 'Card Scored Bonus Seal',
        ['text'] = {
            [1] = 'Adds chips on card scored.'
        }
    },
    atlas = 'centers',
    unlocked = true,
    discovered = true,
    no_collection = false,
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
                    chips = card.ability.seal.extra.chips0
                }
            end
        end
    end
}
