import { defineConfig } from 'vite'
import 'dotenv/config'

const BASE_URL = process.env.BASE_URL || '/';

export default defineConfig({
  base: `${BASE_URL}`,
})
