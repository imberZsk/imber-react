import { PrismaClient } from '@prisma/client'
import { NextRequest } from 'next/server'

const prisma = new PrismaClient()
export async function GET(request: NextRequest) {
  console.log(request.url)
  const searchParams = request.nextUrl.searchParams
  const fromUid = 27
  const uid = searchParams.get('to')
  const amount = searchParams.get('amount')

  await prisma.money.updateMany({
    where: {
      uid: Number(fromUid)
    },
    data: {
      amount: {
        decrement: Number(amount)
      }
    }
  })

  await prisma.money.updateMany({
    where: {
      uid: Number(uid)
    },
    data: {
      amount: {
        increment: Number(amount)
      }
    }
  })

  return Response.json({ success: 'success' })
}
