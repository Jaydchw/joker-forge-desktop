-- Example: calculate_and_use
-- Object: consumable
-- Purpose: verify separate calculate/use hooks are emitted for different triggers.

SMODS.Consumable {
    key = 'c_calculate_and_use',
    set = 'Tarot',
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
        ['name'] = 'Calculate And Use',
        ['text'] = {
            [1] = 'Has both calculate and use hooks.'
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
                self.config.extra.chips0,
                self.config.extra.mult0
            }
        }
    end,
    calculate = function(self, card, context)
        if context.joker_main then
            return {
                chips = card.ability.extra.chips0
            }
        end
    end,
    use = function(self, card, area, copier)
        local used_card = copier or card
        return {
            mult = card.ability.extra.mult0
        }
    end,
    can_use = function(self, card)
        return true
    end
}
