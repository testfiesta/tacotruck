import * as p from '@clack/prompts'

/**
 * Formats a date in YYYY-MM-DD format using Intl.DateTimeFormat
 */
export function formatDateYYYYMMDD(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/**
 * Validates a date string in YYYY-MM-DD format
 * @returns Error message if invalid, undefined if valid
 */
export function validateDateFormat(value: string): string | undefined {
  if (!value)
    return 'Date is required'

  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    return 'Invalid date format. Use YYYY-MM-DD'

  const date = new Date(value)
  if (Number.isNaN(date.getTime()))
    return 'Invalid date'

  return undefined
}

/**
 * Validates that end date is after start date
 */
export function validateEndDate(startDate: string, endDate: string): string | undefined {
  const start = new Date(startDate)
  const end = new Date(endDate)

  if (end < start)
    return 'End date must be after start date'

  return undefined
}

/**
 * Prompts user for a date input with validation
 */
export async function promptForDate(
  message: string,
  defaultDate?: Date,
  additionalValidation?: (value: string) => string | undefined,
): Promise<string | symbol> {
  const today = defaultDate || new Date()
  const formattedDate = formatDateYYYYMMDD(today)

  return await p.text({
    message,
    placeholder: formattedDate,
    validate: (value) => {
      const formatError = validateDateFormat(value)
      if (formatError)
        return formatError

      if (additionalValidation) {
        const additionalError = additionalValidation(value)
        if (additionalError)
          return additionalError
      }

      return undefined
    },
  })
}
