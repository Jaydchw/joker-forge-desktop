-- Example: card_scored_bonus
-- Object: edition
-- Purpose: verify edition scoring trigger emits calculate hook and payload.

SMODS.Edition {
    key = 'e_card_scored_bonus',
    config = {
        extra = { chips0 = 5 }
    },
    in_shop = true,
    weight = 1,
    apply_to_float = false,
    disable_shadow = false,
    disable_base_shader = false,
    loc_txt = {
        ['name'] = 'Card Scored Bonus Edition',
        ['label'] = 'Card Scored Bonus Edition',
        ['text'] = {
            [1] = 'Adds chips on card scored.'
        }
    },
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
    get_weight = function(self)
        return G.GAME.edition_rate * self.weight
    end,
    calculate = function(self, card, context)
        if context.pre_joker or context.main_scoring and context.cardarea == G.play then
            return {
                chips = card.ability.extra.chips0
            }
        end
    end
}
