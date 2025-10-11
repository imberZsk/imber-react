'use client'

import { useForm, type FieldValues } from 'react-hook-form'

export default function FormWithReactHookForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    getValues
  } = useForm()

  const onSubmit = async (data: FieldValues) => {
    // 1. 模拟提交数据
    await new Promise((resolve) => setTimeout(resolve, 1000))

    console.log(data, getValues())

    // 2. 重置表单
    reset()
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-y-2 p-4"
    >
      <input
        {...register('email', {
          required: '请填写 Email'
        })}
        type="email"
        placeholder="邮箱"
        className="px-4 py-2 rounded shadow-sm ring-1 ring-inset ring-gray-300"
      />
      {errors.email && (
        <p className="text-red-500">{`${errors.email.message}`}</p>
      )}

      <input
        {...register('password', {
          required: '请填写密码',
          minLength: {
            value: 5,
            message: '密码最少设置 5 个字符'
          }
        })}
        type="password"
        placeholder="密码"
        className="px-4 py-2 rounded shadow-sm ring-1 ring-inset ring-gray-300"
      />
      {errors.password && (
        <p className="text-red-500">{`${errors.password.message}`}</p>
      )}

      <input
        {...register('confirmPassword', {
          required: '请填写确认密码',
          validate: (value) => value === getValues('password') || '密码必须一致'
        })}
        type="password"
        placeholder="确认密码"
        className="px-4 py-2 rounded shadow-sm ring-1 ring-inset ring-gray-300"
      />
      {errors.confirmPassword && (
        <p className="text-red-500">{`${errors.confirmPassword.message}`}</p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="bg-indigo-600 disabled:bg-gray-500 py-2 rounded text-white"
      >
        注册
      </button>
    </form>
  )
}
