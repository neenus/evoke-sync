const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export interface DescriptionInput {
  serviceType: string;
  practitionerName: string;
  supervisorDetails: string;
  sessionLength: number;
  sessionDates: string[];
  month: string; // month name e.g. "March"
}

export function generateDescription(input: DescriptionInput): string {
  const { serviceType, practitionerName, supervisorDetails, sessionLength, sessionDates, month } =
    input;

  const sortedDates = [...new Set(sessionDates)]
    .sort((a, b) => parseInt(a) - parseInt(b))
    .join(', ');

  const monthLabel = MONTH_NAMES.find(
    (m) => m.toLowerCase() === month.toLowerCase(),
  ) ?? month;

  return (
    `${serviceType} with ${practitionerName} under direct supervision of ${supervisorDetails}.\n` +
    `Dates of service: ${sessionLength} minutes on each of ${monthLabel} ${sortedDates}`
  );
}
