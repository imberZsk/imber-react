import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import ResponsiveDisplay from './components/ResponsiveDisplay'
import HybridResponsive from './components/HybridResponsive'

const prisma = new PrismaClient()

async function getOrCreateDefaultUser() {
  let user = await prisma.user.findFirst({
    where: { email: 'default@example.com' }
  })

  if (!user) {
    user = await prisma.user.create({
      data: {
        email: 'default@example.com',
        name: '默认用户'
      }
    })
  }

  return user
}

async function getPosts() {
  return await prisma.post.findMany({
    include: {
      author: true
    }
  })
}

async function createPost(formData: FormData) {
  'use server'
  const title = formData.get('title') as string
  const content = formData.get('content') as string

  const user = await getOrCreateDefaultUser()

  await prisma.post.create({
    data: {
      title,
      content,
      authorId: user.id
    }
  })

  revalidatePath('/')
}

async function deletePost(formData: FormData) {
  'use server'
  const id = Number(formData.get('id'))

  await prisma.post.delete({
    where: {
      id
    }
  })

  revalidatePath('/')
}

export default async function Home() {
  const isMobile = (await headers())
    .get('user-agent')
    ?.toLowerCase()
    .includes('mobile')

  const posts = await getPosts()

  return (
    <div className="grid grid-rows-[auto_1fr] gap-8 min-h-screen p-8">
      {/* 方案1: CSS 媒体查询 DOM 成倍增长 */}
      <div className="block md:hidden">我是移动端才能看到的 (CSS)</div>
      <div className="hidden md:block">我是PC端才能看到的 (CSS)</div>

      {/* 方案2: 客户端组件 无 SEO */}
      <ResponsiveDisplay />

      {/* 方案3: 混合方案 - 服务端渲染内容，客户端响应式切换 */}
      <HybridResponsive
        initialIsMobile={isMobile || false}
        mobileContent={<div>我是移动端才能看到的 (混合方案)</div>}
        desktopContent={<div>我是PC端才能看到的 (混合方案)</div>}
      />

      <div className="max-w-2xl mx-auto w-full">
        <h1 className="text-2xl font-bold mb-4">创建新文章</h1>
        <form action={createPost} className="space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium">
              标题
            </label>
            <input
              type="text"
              id="title"
              name="title"
              className="mt-1 block w-full rounded-md border text-black border-gray-300 shadow-sm p-2"
              required
            />
          </div>
          <div>
            <label htmlFor="content" className="block text-sm font-medium">
              内容
            </label>
            <textarea
              id="content"
              name="content"
              rows={4}
              className="mt-1 block w-full rounded-md border text-black border-gray-300 shadow-sm p-2"
              required
            />
          </div>
          <button
            type="submit"
            className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
          >
            发布文章
          </button>
        </form>
      </div>

      <div className="max-w-2xl mx-auto w-full">
        <h2 className="text-2xl font-bold mb-4">文章列表</h2>
        <div className="space-y-4">
          {posts.map((post) => (
            <div key={post.id} className="border rounded-lg p-4">
              <h3 className="text-xl font-semibold">{post.title}</h3>
              <p className="text-gray-600 mt-2">{post.content}</p>
              <div className="mt-4 flex justify-between items-center">
                <span className="text-sm text-gray-500">
                  作者: {post.author.name || '未知'}
                </span>
                <form action={deletePost}>
                  <input type="hidden" name="id" value={post.id} />
                  <button
                    type="submit"
                    className="bg-red-500 text-white px-3 py-1 rounded-md hover:bg-red-600 text-sm"
                  >
                    删除
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
