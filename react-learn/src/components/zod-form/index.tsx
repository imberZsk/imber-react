'use client'

import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, type FieldValues } from 'react-hook-form'
import { ZodSchema } from './zod-types'

export default function FormWithReactHookFormAndZod() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset
  } = useForm({
    resolver: zodResolver(ZodSchema)
  })

  const onSubmit = async (data: FieldValues) => {
    await new Promise((resolve) => setTimeout(resolve, 1000))
    console.log(data)
    reset()
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex flex-col gap-y-2 p-4"
    >
      <input
        {...register('email')}
        type="email"
        placeholder="邮箱"
        className="px-4 py-2 rounded shadow-sm ring-1 ring-inset ring-gray-300"
      />
      {errors.email && (
        <p className="text-red-500">{`${errors.email.message}`}</p>
      )}

      <input
        {...register('password')}
        type="password"
        placeholder="密码"
        className="px-4 py-2 rounded shadow-sm ring-1 ring-inset ring-gray-300"
      />
      {errors.password && (
        <p className="text-red-500">{`${errors.password.message}`}</p>
      )}

      <input
        {...register('confirmPassword')}
        type="password"
        placeholder="确认密码"
        className="px-4 py-2 rounded shadow-sm ring-1 ring-inset ring-gray-300"
      />
      {errors.confirmPassword && (
        <p className="text-red-500">{`${errors.confirmPassword.message}`}</p>
      )}

      <button
        disabled={isSubmitting}
        type="submit"
        className="bg-blue-500 disabled:bg-gray-500 py-2 rounded text-white"
      >
        注册
      </button>
    </form>
  )
}
