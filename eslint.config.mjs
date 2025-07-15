import antfu from '@antfu/eslint-config'

export default antfu({
  formatters: true,
  rules: {
    'no-console': 'warn',
    'node/prefer-global/process': 'warn',
  },
  ignores: ['configs/*.json', 'dist'],
})
