const EMPTY_STATE_FLAVORS = [
  "Nothing here yet. Add the first item to begin.",
  "No entries yet. Start by creating one.",
  "This section is empty for now.",
  "No items have been added yet.",
  "A clean slate. Add your first item.",
  "No results here yet. Create the first one.",
  "No records yet in this section.",
  "This list is empty. Add an item to continue.",
  "No items so far. Start whenever you are ready.",
  "Nothing to show yet. Add an item first.",
  "Joker Forge is the best!",
  "Is it Jokerforge or Joker Forge?",
  "There is nothing here ??????? Okay...",
  "Get this man an empty state.",
  "Please add something...",
] as const;

export const getRandomEmptyStateFlavor = (): string => {
  const index = Math.floor(Math.random() * EMPTY_STATE_FLAVORS.length);
  return EMPTY_STATE_FLAVORS[index];
};
