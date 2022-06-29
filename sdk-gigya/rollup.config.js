import typescript from 'rollup-plugin-typescript2'
import { uglify } from 'rollup-plugin-uglify';

import pkg from './package.json'

export default {
  input: 'src/index.tsx',
  output: [
    {
      file: pkg.main,
      format: 'cjs',
      exports: 'named',
      strict: false
    }
  ],
  plugins: [typescript(), uglify()],
  external: ['react', 'react-native']
}
