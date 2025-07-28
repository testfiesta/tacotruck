# TacoTruck Scripts

This directory contains utility scripts for the TacoTruck project.

## Available Scripts

### `pipeline-submit-tf.ts`

A complete test pipeline script that:

1. Creates a sample calculator test file
2. Runs the tests using Vitest with JUnit reporter
3. Submits the test results to TestFiesta platform
4. Cleans up test artifacts after completion

#### Usage

You can run this script in several ways:

**Using npm script (recommended):**

```bash
npm run tf:pipe
```

#### Configuration

The script will prompt you for TestFiesta API token and organization handle if they are not provided as environment variables.

You can set these environment variables to avoid being prompted:

```bash
export TESTFIESTA_TOKEN=your_api_token
export TESTFIESTA_ORG=your_org_handle
export CLEANUP_AFTER_RUN=true  # Set to 'false' to keep artifacts
```

The script uses these configuration values:

- Test timeout: 5000ms (adjustable in the script)
- Retry attempts: 1 (adjustable in the script)
- JUnit XML format for test results

The script will:

1. Create a simple calculator test file with 5 test cases
2. Run tests using Vitest and generate a JUnit XML report
3. Submit the report to TestFiesta using the CLI

#### Customization

To modify the test file or change configuration, edit the script directly. Key configuration points include:

- `TEST_FILE_PATH`: Path where the calculator test file will be created
- `RESULTS_PATH`: Directory where test results will be stored
- `JUNIT_REPORT_PATH`: Path to the JUnit XML report file
- `BIN_PATH`: Path to the CLI binary executable
- `CLEANUP_AFTER_RUN`: Whether to clean up artifacts after running (defaults to true)

You can also customize:

- The calculator test code itself (to add more tests or create failures)
- The test runner configuration (modify the vitest command)
- The CLI submission parameters
- The cleanup behavior (automatic or with confirmation)

If the binary executable is not found, the script will automatically fall back to using `npx tacotruck` command.

### `network.ts`

A simple script demonstrating how to use the network utilities to make HTTP requests.

#### Usage

```bash
npm run request
```

## Adding New Scripts

When adding new scripts to this directory:

1. Make them executable: `chmod +x scripts/your-script.ts`
2. Add an entry to the `scripts` section in `package.json`
3. Update this README with information about your script

## Troubleshooting

If you encounter issues with the script:

- **Binary not found**: The script will automatically fall back to using `npx tacotruck`
- **Test failures**: The script will continue even if some tests fail (this is expected behavior for demo purposes)
- **Permission denied**: Make sure the script is executable (`chmod +x scripts/pipeline-submit-tf.ts`)
- **JUnit report not generated**: Check the Vitest output for errors and ensure the test directory exists
- **Connection issues**: Verify that the TestFiesta server is running and accessible
- **Cleanup issues**: If cleanup fails, you may need to manually remove test artifacts

## Cleanup Behavior

The script will clean up test artifacts after completion:

- By default, it will ask for confirmation before deleting files
- Set `CLEANUP_AFTER_RUN=false` to keep all artifacts
- Press Ctrl+C during execution to interrupt and trigger cleanup
- Files cleaned up include:
  - The calculator test file
  - The JUnit XML report
  - The test results directory (if empty)
