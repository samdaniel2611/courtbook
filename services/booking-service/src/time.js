function isOnTheHour(date, timeZone) {
  if (!(date instanceof Date) || !Number.isFinite(date.getTime())) return false;
  if (date.getUTCSeconds() !== 0 || date.getUTCMilliseconds() !== 0) return false;

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    minute: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const minute = parts.find((part) => part.type === 'minute')?.value;
  return minute === '00';
}

module.exports = { isOnTheHour };
