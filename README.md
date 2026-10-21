# ヒデ工房 社内専用 勤怠・給与アプリ

構成案: https://claude.ai/artifact/HrCUMCFXwMtcEipjZZyAq9

## いまあるもの

- `src/attendance/` 日ごとの区分・出退勤時刻から月の勤怠集計を作る。既存Excel「X月度」シートの式を移したもの。
- `src/payroll/` 給与計算エンジン。既存Excel「給与計算_X月度」の各列の式を移したもの。
- `fixtures/` 既存Excelから取り出した入力と計算結果。氏名・給与を含むためリポジトリには入れず、プロジェクトの共有フォルダ `app/fixtures/` に保管している。
- `test/attendance-golden.test.ts` 勤怠集計がExcelと一致するかを確かめるテスト（15名×6か月）。
- `supabase/migrations/` データベースの設計と権限（RLS）。スタッフは本人の行だけ、経理担当は本人分＋確定した給与仕訳、権限者（3名）は全員分を見られ、設定や役割も変えられる。
- `db-test/` 権限のテスト。ローカルのPostgreSQLで `npm run test:db`。
- `app/` 画面（Next.js）。ログインはメールのリンク方式で、登録済みの人だけ入れる。
  - 打刻（`/`）、自分の勤怠と修正・有休・半休の申請（`/me/attendance`）、給与明細（`/me/payslips`、確定した月だけ）
  - 管理（`/admin`、権限者のみ）：今日の出勤状況、申請の承認（承認すると勤怠に反映）、給与計算（下書き→手入力→確定）
  - 経理（`/accounting`、権限者と経理担当）：確定した給与の仕訳（科目ごとの合計）とマネーフォワード用CSVの書き出し
- `lib/payroll-run.ts` 月度の計算（勤怠集計→給与計算→明細の保存）と確定（給与仕訳の作成）。
- `test/payroll-golden.test.ts` 給与がExcelの結果と1円単位で一致するかを確かめるテスト（18名×6か月）。

## 使い方

```
npm install
npm test          # Excelとの一致テスト
npm run typecheck
cp .env.example .env.local   # Supabase の URL とキーを書く
npm run dev                  # http://localhost:3000 で画面を確認
npm run fixtures -- /path/to/*.xlsx fixtures   # Excelから給与の期待値を取り直す
python3 -I scripts/extract_attendance.py /path/to/*.xlsx fixtures   # 勤怠の期待値を取り直す
```
