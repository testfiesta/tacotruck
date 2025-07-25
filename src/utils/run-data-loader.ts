import type { Result } from './result'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { err, ok } from './result'

import XUnitParser from './xunit-parser'

export interface RunData {
  [key: string]: any
}

export function loadRunData(dataPath: string): Result<RunData, Error> {
  try {
    const resolvedPath = path.resolve(process.cwd(), dataPath)
    if (!fs.existsSync(resolvedPath)) {
      return err(new Error(`Data file not found: ${resolvedPath}`))
    }

    const fileContent = fs.readFileSync(resolvedPath, 'utf8')
    const ext = path.extname(resolvedPath).toLowerCase()

    if (ext === '.json') {
      return ok(JSON.parse(fileContent))
    }
    else if (ext === '.xml') {
      const xmlParser = new XUnitParser()
      const parsedData = xmlParser.parseContent(fileContent, {
        integration: 'test',
      })
      return ok(parsedData)
    }
    else {
      return err(new Error(`Unsupported file format: ${ext}. Only JSON and XML files are supported.`))
    }
  }
  catch (error) {
    return err(error instanceof Error ? error : new Error(`Failed to load run data: ${String(error)}`))
  }
}
