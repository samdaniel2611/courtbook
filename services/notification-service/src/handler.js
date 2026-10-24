const processedMessageIds = new Set();

function handleMessage(payload, { log, messageId } = {}) {
  // A real system would store processed message IDs durably.
  if (messageId && processedMessageIds.has(messageId)) return;
  if (messageId) processedMessageIds.add(messageId);
  log(`Booking confirmation for user ${payload.userId}: ${payload.courtName} at ${payload.startsAt}`);
}

module.exports = { handleMessage };
