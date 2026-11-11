const encode = bytes => btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join('')).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const decode = value => Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0))
const encoder = new TextEncoder()
const keyFor = secret => crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])

export async function issueDownloadTicket(payload, secret) {
  const body = encode(encoder.encode(JSON.stringify(payload)))
  const signature = await crypto.subtle.sign('HMAC', await keyFor(secret), encoder.encode(body))
  return `${body}.${encode(new Uint8Array(signature))}`
}

export async function verifyDownloadTicket(ticket, secret, expected, now = Date.now()) {
  try {
    if (typeof ticket !== 'string' || ticket.length > 9000 || !/^[\w-]+\.[\w-]+$/.test(ticket))
      return null
    const [body, signature] = ticket.split('.')
    if (!await crypto.subtle.verify('HMAC', await keyFor(secret), decode(signature), encoder.encode(body)))
      return null
    const value = JSON.parse(new TextDecoder().decode(decode(body)))
    if (value.ip !== expected.ip || value.hostname !== expected.hostname || !Number.isSafeInteger(value.expires) || value.expires <= now || value.expires > now + 120000 || typeof value.resource !== 'string')
      return null
    return value
  }
  catch { return null }
}
