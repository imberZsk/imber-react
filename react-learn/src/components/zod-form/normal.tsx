'use client'

import { useState } from 'react'

export default function FormWithoutReactHookForm() {
  // 处理输入框字段
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  // 处理提交中状态
  const [isSubmitting, setIsSubmitting] = useState(false)
  // 处理错误
  const [errors, setErrors] = useState<string[]>([])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    //  1. 阻止默认行为
    e.preventDefault()

    // 2. 处理提交中状态
    setIsSubmitting(true)

    // 3. 前端校验
    if (password !== confirmPassword) {
      setErrors(['两次密码不一致'])
      setIsSubmitting(false)
      return
    }

    // 4. 模拟提交数据
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // 5. 重置表单
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setIsSubmitting(false)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-y-2 p-4">
      {errors.length > 0 && (
        <ul>
          {errors.map((error) => (
            <li
              key={error}
              className="bg-red-100 text-red-500 px-4 py-2 rounded"
            >
              {error}
            </li>
          ))}
        </ul>
      )}
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        type="email"
        required
        placeholder="Email"
        className="px-4 py-2 rounded shadow-sm ring-1 ring-inset ring-gray-300"
      />
      <input
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        type="password"
        required
        placeholder="Password"
        className="px-4 py-2 rounded shadow-sm ring-1 ring-inset ring-gray-300"
      />
      <input
        value={confirmPassword}
        onChange={(e) => setConfirmPassword(e.target.value)}
        type="password"
        required
        placeholder="Confirm password"
        className="px-4 py-2 rounded shadow-sm ring-1 ring-inset ring-gray-300"
      />

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
