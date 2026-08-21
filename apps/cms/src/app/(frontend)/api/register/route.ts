import { NextRequest, NextResponse } from 'next/server'
import { getPayload } from 'payload'
import config from '@payload-config'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const companyName = String(body.companyName || '').trim()
    const email = String(body.email || '').trim().toLowerCase()
    const password = String(body.password || '')

    if (companyName.length < 2) {
      return NextResponse.json({ error: 'Укажите название компании' }, { status: 400 })
    }
    if (!email.includes('@')) {
      return NextResponse.json({ error: 'Укажите корректный email' }, { status: 400 })
    }
    if (password.length < 8) {
      return NextResponse.json({ error: 'Пароль должен быть не короче 8 символов' }, { status: 400 })
    }

    const payload = await getPayload({ config })

    const existing = await payload.find({
      collection: 'users',
      where: { email: { equals: email } },
      limit: 1,
      overrideAccess: true,
    })
    if (existing.totalDocs > 0) {
      return NextResponse.json({ error: 'Этот email уже зарегистрирован' }, { status: 409 })
    }

    const company = await payload.create({
      collection: 'tenants',
      data: {
        name: companyName,
        plan: 'starter',
        limits: { maxAgents: 5, maxAccounts: 3 },
      },
      overrideAccess: true,
    })

    const user = await payload.create({
      collection: 'users',
      data: {
        email,
        password,
        role: 'admin',
        tenant: company.id,
      },
      overrideAccess: true,
    })

    return NextResponse.json({
      ok: true,
      companyId: company.id,
      userId: user.id,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
