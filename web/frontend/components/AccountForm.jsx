import { useState, useCallback } from "react";

import {
  Form,
  FormLayout,
  TextField,
  Button,
  LegacyCard,
  Select,
} from "@shopify/polaris";
import {
  ContextualSaveBar,
  Loading,
  useToast,
  ResourcePicker,
  useNavigate,
} from "@shopify/app-bridge-react";

import { useAuthenticatedFetch } from "../hooks";

/* Import custom hooks for forms */
import { useForm, useField, notEmpty } from "@shopify/react-form";
// DBはenumを想定
const ORDER_COUNT_PER_MONTHS = [
  { value: "", label: '選択してください' },
  { value: "1", label: '~10' },
  { value: "2", label: '11~100' },
  { value: "3", label: '101~1000' },
]

export function AccountForm() {
  const { show } = useToast();
  const fetch = useAuthenticatedFetch();

  // form
  const {
    fields: {
      email, company, password, passwordConfirmation, orderCountPerMonth,
      overview, orderAveragePrice
    },
    submit, submitting, dirty, reset, submitErrors, makeClean,
  } = useForm({
    fields: {
      email: useField({
        value: "",
        validates: [
          notEmpty("メールアドレスを入力してください"),
          (value) => {
            if (!value.match(/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i))
              return "メールアドレスの形式が正しくありません";
          }
        ]
      }),
      company: useField(""),
      password: useField({
        value: "",
        validates: [
          notEmpty("パスワードを入力してください"),
          (value) => {
            if (!value.match(/^(?=.*?[a-z])(?=.*?\d)[a-z\d]{6,}$/i))
              return "パスワードは半角英数字1文字以上を含み、かつ6文字以上で入力してください";
          }
        ]
      }),
      passwordConfirmation: useField({
        value: "",
        validates: [
          notEmpty("パスワードを入力してください"),
          (value) => {
            if (value !== password.value)
              return "パスワードが一致しません";
          }
        ]
      }),
      orderCountPerMonth: useField({
        value: "",
        validates: [notEmpty("月間の注文数を選択してください")]
      }),
      overview: useField({
        value: "",
        validates: [notEmpty("ストア概要を入力してください")]
      }),
      orderAveragePrice: useField({
        value: "",
        validates: [notEmpty("購入平均単価を入力してください")]
      })
    },
    onSubmit: async (fieldValues) => {
      try {
        const url = "/api/account"
        const method = "POST";
        const response = await fetch(url, {
          method,
          body: JSON.stringify(fieldValues),
          headers: { "Content-Type": "application/json" },
        });

        console.log(response)
        if (!response.ok) {
          show('登録に失敗しました。', { duration: 3000 })
          return {status: 'fail', errors: [{message: '登録に失敗しました。'}]}; 
        }

        reset()
        show("登録に成功しました。", { duration: 3000 })

        return { status: 'success' };
      } catch (error) {
        show(error.message, { duration: 3000 })

        return {status: 'fail', errors: [{message: 'bad form data'}]}; 
      }
    },
  });

  return (
    <>
      {submitting && <Loading />}
      <LegacyCard title="アカウント登録">
        <LegacyCard.Section title="登録ストアドメイン">
          <Form onSubmit={submit}>
            <FormLayout>
              <TextField
                {...email}
                id="email"
                name="email"
                type="email"
                label="登録メールアドレス"
                requiredIndicator
                autoComplete="email"
              />
              <TextField
                {...company}
                id="company"
                name="company"
                type="text"
                label="会社名(個人事業主の方は個人と入力してください)"
                autoComplete="company-name"
              />
              <TextField
                {...password}
                id="password"
                name="password"
                type="password"
                label="パスワード(半角英数字1文字以上を含み、かつ6文字以上)"
                requiredIndicator
                autoComplete="new-password"
              />
              <TextField
                {...passwordConfirmation}
                id="password_confirmation"
                name="password_confirmation"
                type="password"
                label="パスワードの確認"
                requiredIndicator
                autoComplete="new-password"
              />
              <TextField
                {...overview}
                id="overview"
                name="overview"
                type="text"
                label="ストアの概要"
                requiredIndicator
                multiline={5}
                autoComplete="store-overview"
              />

              <FormLayout.Group>
                <Select
                  {...orderCountPerMonth}
                  id="order_count_per_month"
                  name="order_count_per_month"
                  label="月間の注文数"
                  requiredIndicator
                  options={ORDER_COUNT_PER_MONTHS.map((option) => {
                    return { label: option.label, value: option.value }
                  })}
                />
                <TextField
                  {...orderAveragePrice}
                  id="order_average_price"
                  name="order_average_price"
                  type="number"
                  label="購入平均単価（円）"
                  requiredIndicator
                  autoComplete="off"
                />
              </FormLayout.Group>

              <Button submit loading={submitting} disabled={submitting}>
                アプリ利用申請
              </Button>
            </FormLayout>
          </Form>
        </LegacyCard.Section>
      </LegacyCard>
    </>
  )
}
