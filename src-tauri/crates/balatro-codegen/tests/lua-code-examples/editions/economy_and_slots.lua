-- Purpose: Snapshot for `economy_and_slots` (edition) codegen output.

SMODS.Edition {
    key = 'e_economy_and_slots',
    config = {
        extra = {
            interest_cap0 = 1,
            consumable_slots0 = 1
        }
    },
    in_shop = true,
    weight = 1,
    apply_to_float = false,
    disable_shadow = false,
    disable_base_shader = false,
    loc_txt = {
        ['name'] = 'Economy And Slots',
        ['label'] = 'Economy And Slots',
        ['text'] = {
            [1] = 'Edition fixture for economy and slots effects.'
        }
    },
    unlocked = true,
    discovered = true,
    no_collection = false,
    loc_vars = function(self, info_queue, card)
        return {
            vars = {
                self.config.extra.interest_cap0,
                self.config.extra.consumable_slots0
            }
        }
    end,
    get_weight = function(self)
        return G.GAME.edition_rate * self.weight
    end,
    calculate = function(self, card, context)
        if context.pre_joker or context.main_scoring and context.cardarea == G.play then
            G.GAME.interest_cap = G.GAME.interest_cap + card.ability.extra.interest_cap0
            return {
                message = 'Interest Cap Changed',
                colour = G.C.MONEY,
                extra = {
                    func = function()
                        G.consumeables.config.card_limit = G.consumeables.config.card_limit + card.ability.extra.consumable_slots0
                        card_eval_status_text(context.blueprint_card or card, 'extra', nil, nil, nil, {message = "+"..tostring(card.ability.extra.consumable_slots0)..' Consumable Slot', colour = G.C.GREEN})
                        return true
                    end,
                    colour = G.C.GREEN
                }
            }
        end
    end
}
