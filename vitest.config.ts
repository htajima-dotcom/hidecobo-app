import { defineConfig } from "vitest/config";

// 実データの fixtures（個人情報）はリポジトリに含めないため、無い環境ではテスト0件でも成功にする
export default defineConfig({ test: { passWithNoTests: true } });
