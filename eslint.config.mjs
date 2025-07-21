import antfu from '@antfu/eslint-config'

export default antfu({
  formatters: true,
  rules: {
    'no-console': 'warn',
    'node/prefer-global/process': 'off',
  },
  ignores: ['configs/*.json', 'dist', '.vscode'],
})
