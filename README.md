# ヒデ工房 社内専用 勤怠・給与アプリ

構成案: https://claude.ai/artifact/HrCUMCFXwMtcEipjZZyAq9

## いまあるもの

- `src/attendance/` 日ごとの区分・出退勤時刻から月の勤怠集計を作る。既存Excel「X月度」シートの式を移したもの。
- `src/payroll/` 給与計算エンジン。既存Excel「給与計算_X月度」の各列の式を移したもの。
- `fixtures/` 既存Excelから取り出した入力と計算結果。氏名・給与を含むためリポジトリには入れず、プロジェクトの共有フォルダ `app/fixtures/` に保管している。
- `test/attendance-golden.test.ts` 勤怠集計がExcelと一致するかを確かめるテスト（15名×6か月）。
- `supabase/migrations/` データベースの設計と権限（RLS）。スタッフは本人の行だけ、経理担当は本人分＋確定した給与仕訳、権限者（3名）は全員分を見られ、設定や役割も変えられる。
- `db-test/` 権限のテスト。ローカルのPostgreSQLで `npm run test:db`。
- `test/payroll-golden.test.ts` 給与がExcelの結果と1円単位で一致するかを確かめるテスト（18名×6か月）。

## 使い方

```
npm install
npm test          # Excelとの一致テスト
npm run typecheck
npm run fixtures -- /path/to/*.xlsx fixtures   # Excelから給与の期待値を取り直す
python3 -I scripts/extract_attendance.py /path/to/*.xlsx fixtures   # 勤怠の期待値を取り直す
```
