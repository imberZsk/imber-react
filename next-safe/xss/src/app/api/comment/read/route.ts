import prisma from '@/lib/db'

// query参数
export async function GET() {
  const comments = await prisma.comment.findMany()

  return Response.json({
    data: comments
  })
}
