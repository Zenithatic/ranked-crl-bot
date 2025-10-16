# Ranked CRL Discord Bot

Overview of Project:

Bot entrypoint - src/index.ts
Bot interaction loaders - src/loaders.ts
Bot commands - src/commands
Bot interactives (buttons, modals, etc) - src/interactives

Sometimes the logic is chained for a certain feature, e.g. the sendQueueButtons.js command sends an embed with the queue button (src/interactives/buttons/queue-join.ts), which opens a modal (src/interactives/modals/queuefriendlink.ts), which then does the actual queue logic
