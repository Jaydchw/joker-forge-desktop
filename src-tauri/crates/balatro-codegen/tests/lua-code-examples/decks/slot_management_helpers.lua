-- Purpose: Snapshot for `slot_management_helpers` (deck) codegen output.

SMODS.Back {
    key = 'b_slot_management_helpers',
    pos = {
        x = 0,
        y = 0
    },
    config = {
        extra = {
            consumable_slots0 = 1,
            hand_size0 = 1
        }
    },
    loc_txt = {
        ['name'] = 'Slot Management Helpers',
        ['text'] = {
            [1] = 'Uses slot management effects.'
        }
    },
    unlocked = true,
    discovered = true,
    no_collection = false,
    atlas = 'Enhancers',
    loc_vars = function(self, info_queue, card)
        return {
            vars = {
                self.config.extra.consumable_slots0,
                self.config.extra.hand_size0
            }
        }
    end,
    calculate = function(self, card, context)
        if context.main_eval then
            return {
                func = function()
                    G.consumeables.config.card_limit = G.consumeables.config.card_limit + back.ability.extra.consumable_slots0
                    card_eval_status_text(context.blueprint_card or card, 'extra', nil, nil, nil, {message = "+"..tostring(back.ability.extra.consumable_slots0)..' Consumable Slot', colour = G.C.GREEN})
                    return true
                end,
                colour = G.C.GREEN,
                extra = {
                    func = function()
                        card_eval_status_text(context.blueprint_card or card, 'extra', nil, nil, nil, {message = "+"..tostring(back.ability.extra.hand_size0)..' Hand Limit', colour = G.C.BLUE})
                        
                        G.hand:change_size(back.ability.extra.hand_size0)
                        return true
                    end,
                    colour = G.C.BLUE
                }
            }
        end
    end
}
