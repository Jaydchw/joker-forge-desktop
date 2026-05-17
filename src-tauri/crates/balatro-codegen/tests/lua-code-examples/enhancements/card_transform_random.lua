-- Purpose: Snapshot for `card_transform_random` (enhancement) codegen output.

SMODS.Enhancement {
    key = 'm_card_transform_random',
    pos = {
        x = 0,
        y = 0
    },
    loc_txt = {
        ['name'] = 'Card Transform Random',
        ['text'] = {
            [1] = 'Random enhancement/edition transform fixture.'
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
    calculate = function(self, card, context)
        if context.main_scoring and context.cardarea == G.play then
            local scored_card = context.other_card
            G.E_MANAGER:add_event(Event({
            func = function()
                    local random_enhancement = SMODS.poll_enhancement({ key = 'edit_card_enhancement', guaranteed = true, no_replace = true })
                    if random_enhancement then context.other_card:set_ability(G.P_CENTERS[random_enhancement]) end
                    local random_edition = SMODS.poll_edition({ key = 'edit_card_edition', no_negative = true, guaranteed = true })
                    if random_edition then
                        context.other_card:set_edition(random_edition, true)
                    end
            card_eval_status_text(scored_card, 'extra', nil, nil, nil, {message = "Card Modified!", colour = G.C.ORANGE})
            return true
            end
            }))
            return {
                colour = G.C.BLUE
            }
        end
    end
}
