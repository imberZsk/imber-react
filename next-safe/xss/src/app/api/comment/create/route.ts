import prisma from '@/lib/db'

// 获取body参数
export async function POST(request: Request) {
  const body = await request.json()
  await prisma.comment.create({
    data: {
      comment: body.comment
    }
  })

  return Response.json({ success: true })
}
