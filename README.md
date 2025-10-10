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

#### Using npx (recommended)

```bash
npx @testfiesta/tacotruck
```

```bash
npx @testfiesta/tacotruck testfiesta run:submit --data ./results.xml --organization <YOUR_ORG_HANDLE> --token <YOUR_TF_TOKEN> --project <YOUR_PROJECT_KEY>
```

### Usage as a library

```bash
npm install @testfiesta/tacotruck
```

```typescript
import { TestFiestaClient, TestRailClient } from 'tacotruck'

const tfClient = new TestFiestaClient({
  apiKey: '<YOUR_TF_API_KEY>',
  organizationHandle: '<YOUR_TF_ORGANIZATION_HANDLE>',
  baseUrl: 'http://api.testfiesta.com',
})

const trClient = new TestRailClient({
  apiKey: '<YOUR_TR_USERNAME>:<YOUR_TR_PASSWORD>',
  baseUrl: 'http://<username>.testrails.com',
})
```

### Example usage with various testing frameworks

Check out [tacotruck-examples](https://github.com/testfiesta/tacotruck-examples) for examples of using `tacotruck` with your favorite language and framework.

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
