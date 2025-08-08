# TacoTruck

[![ci](https://github.com/testfiesta/tacotruck/actions/workflows/ci.yml/badge.svg)](https://github.com/testfiesta/tacotruck/actions/workflows/ci.yml)

Tacotruck exists to make it easy to move quality data to wherever you need it. Whether you are looking to report test results to your various quality systems or trying to migrate historical data between test case management tools, tacotruck provides a simple, easily extendable interface for doing so.

### Table of Contents

- 🚀 [Getting Started](#getting-started)
- 📖 [Documentation](#documentation)
- 💙 [Contribute](#contribute)
- 🏠 [Local Development](#local-development)
- 🔗 [Follow Us](#follow-us)
- ⚖️ [License](#license)

---

## <a name="getting-started">🚀 Getting Started</a>

### Usage as a CLI

```bash
npm install -g @tacotruck/cli
```

```bash
tacotruck testfiesta run:submit --data ./results.xml --organization <YOUR_ORG_HANDLE> --token <YOUR_TF_TOKEN> --project <YOUR_PROJECT_KEY>
```

### Usage as a library

```bash
npm install tacotruck
```

```typescript
import { TestFiestaClient, TestRailClient } from 'tacotruck'

const tfClient = new TestFiestaClient({
  apiKey: '<YOUR_TF_API_KEY>',
  organization: '<YOUR_TF_ORGANIZATION_HANDLE>',
  baseUrl: 'http://testfiesta.com',
})

const trClient = new TestRailClient({
  username: '<YOUR_TR_USERNAME>',
  password: '<YOUR_TR_PASSWORD>',
  baseUrl: 'http://<username>.testrails.com',
})

await tfClient.createProject()
await trClient.createProject()
```

### Example usage with various testing frameworks
**Elixir**
- [Elixir](https://github.com/testfiesta/demo-elixir-tf)

**Golang**
- testing - TODO
- Testify - TODO

**Java**
- JUnit - TODO
- TestNG - TODO

**JS / TS**
- [Bun](https://github.com/testfiesta/demo-bun-tf)
- [Deno](https://github.com/testfiesta/demo-deno-tf)
- [Mocha](https://github.com/testfiesta/demo-mocha-tf)
- [Jest](https://github.com/testfiesta/demo-jest-tf)
- [Vitest](https://github.com/testfiesta/demo-vitest-tf)
- Selenium - TODO
- Cypress - TODO
- Playwright - TODO
- Puppeteer - TODO

**.NET**
- C# - TODO

**Python**
- [PyTest](https://github.com/testfiesta/demo-pytest-tf)

**Ruby**
- Minitest - TODO
- [Rspec](https://github.com/testfiesta/demo-rspec-tf)

**Rust**
- cargo - TODO
- polish - TODO

**PHP**
- [PHPUnit](https://github.com/testfiesta/demo-phpunit-tf)
- [PestPHP](https://github.com/testfiesta/demo-pestphp-tf)

**Mobile**
- Appium - TODO




## <a name="documentation">📖 Documentation</a>

We highly recommend you take a look at the [Testfiesta docs](https://docs.testfieta.com) for more information.

## <a name="contribute">💙 Contribute</a>

We invite you to contribute and help improve Tacotruck 💙

Here are a few ways you can get involved:

- **Reporting Bugs:** If you come across any bugs or issues, please check out the [reporting bugs guide](https://docs.testfiesta.com/community/reporting-bugs) to learn how to submit a bug report.
- **Suggestions:** Have ideas to enhance Tacotruck? We'd love to hear them! Check out the [contribution guide](https://docs.testfiesta.com/tacotruck/community/contributions#guide) to share your suggestions.
- **Questions:** If you have questions or need assistance, the [getting help guide](https://docs.testfiesta.com/tacotruck/community/getting-help) provides resources to help you out.

## <a name="local-development">🏠 Local Development</a>

Follow the docs to [Set Up Your Local Development Environment](https://docs.testfiesta.com/tacotruck/community/contributions#setup) to contribute to the framework and documentation.

## <a name="follow-us">🔗 Follow Us</a>

## <a name="license">⚖️ License</a>
