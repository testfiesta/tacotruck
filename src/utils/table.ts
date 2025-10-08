import type { TableConstructorOptions } from 'cli-table3'
import Table from 'cli-table3'

/**
 * Default table style configuration
 */
export const defaultTableStyle = {
  head: ['cyan', 'bold'],
  border: [],
}

/**
 * Creates a CLI table with default styling
 */
export function createTable(options: TableConstructorOptions = {}): Table.Table {
  // Apply default styles if not overridden
  if (!options.style) {
    options.style = defaultTableStyle
  }

  return new Table(options)
}

/**
 * Creates a standard table for entity listing
 */
export function createListTable(headers: string[], columnWidths?: number[]): Table.Table {
  return createTable({
    head: headers,
    colWidths: columnWidths,
  })
}

/**
 * Creates a standard table for entity details
 */
export function createDetailsTable(columnWidths?: number[]): Table.Table {
  return createTable({
    colWidths: columnWidths || [20, 60],
  })
}

/**
 * Formats a value for display in a table
 * Handles objects by converting them to JSON
 */
export function formatTableValue(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2)
    }
    catch (error) {
      return String(error instanceof Error ? error.message : error)
    }
  }

  return String(value)
}
