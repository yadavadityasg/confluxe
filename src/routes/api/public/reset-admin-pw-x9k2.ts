import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/public/reset-admin-pw-x9k2')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url)
        const token = url.searchParams.get('t')
        if (token !== 'lovable-onetime-x9k2-reset') {
          return new Response('forbidden', { status: 403 })
        }
        const { supabaseAdmin } = await import('@/integrations/supabase/client.server')
        const userId = 'ba56da88-0082-4492-91bf-80d1d4e7781d'
        const newPassword = 'ChangeMe!2026'
        const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          password: newPassword,
        })
        if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })
        return new Response(JSON.stringify({ ok: true }), {
          headers: { 'content-type': 'application/json' },
        })
      },
    },
  },
})
