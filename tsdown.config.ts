import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: [
    'src/cli/index.ts',
    'src/index.ts',
  ],
  clean: true,
  dts: true,
  format: ['cjs', 'esm'],
  exports: true,
})
