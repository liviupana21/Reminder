const DEFAULT_TIME_ZONE = process.env.REMINDER_TIME_ZONE || 'Europe/Bucharest';
const DEFAULT_LOOKAHEAD_MINUTES = Number(process.env.REMINDER_LOOKAHEAD_MINUTES || 5);

function getTimeParts(date = new Date(), timeZone = DEFAULT_TIME_ZONE) {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(date);
  const hour = Number(parts.find((part) => part.type === 'hour').value);
  const minute = Number(parts.find((part) => part.type === 'minute').value);
  const weekday = new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(date);
  const weekdayIndex = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);

  return {
    hour,
    minute,
    day: weekdayIndex,
    currentMinutes: hour * 60 + minute
  };
}

function getReminderSchedule(reminder, now = new Date(), timeZone = DEFAULT_TIME_ZONE) {
  const { day } = getTimeParts(now, timeZone);

  if (reminder.type === 'world-boss') {
    const weekend = day === 0 || day === 6;
    return weekend ? [10 * 60, 18 * 60, 22 * 60] : [10 * 60, 22 * 60];
  }

  if (reminder.type === 'elite-boss') {
    return [1 * 60, 5 * 60, 9 * 60, 13 * 60, 17 * 60, 21 * 60, 25 * 60];
  }

  if (reminder.type === 'map-boss') {
    return [0, 2 * 60, 4 * 60, 6 * 60, 8 * 60, 10 * 60, 12 * 60, 14 * 60, 16 * 60, 18 * 60, 20 * 60, 22 * 60];
  }

  return [];
}

function shouldSendReminder(reminder, now = new Date(), timeZone = DEFAULT_TIME_ZONE, lookAheadMinutes = DEFAULT_LOOKAHEAD_MINUTES) {
  if (!reminder.enabled) return false;

  const schedule = getReminderSchedule(reminder, now, timeZone);
  if (schedule.length) {
    const { currentMinutes } = getTimeParts(now, timeZone);
    return schedule.some((targetMinutes) => currentMinutes === targetMinutes - lookAheadMinutes);
  }

  if (!reminder.reminderTime) return false;

  const [hours, minutes] = reminder.reminderTime.split(':').map(Number);
  const targetMinutes = hours * 60 + minutes;
  const { currentMinutes } = getTimeParts(now, timeZone);
  return currentMinutes === targetMinutes - lookAheadMinutes;
}

function buildReactionRoleMessageText(reactionConfig = {}) {
  const customMessage = (reactionConfig.messageText || '').trim();
  return customMessage || '';
}

module.exports = {
  DEFAULT_TIME_ZONE,
  DEFAULT_LOOKAHEAD_MINUTES,
  getTimeParts,
  getReminderSchedule,
  shouldSendReminder,
  buildReactionRoleMessageText
};
