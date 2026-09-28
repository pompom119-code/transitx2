const wait = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms))

export const authService = {
  async loginWithGoogle() {
    throw new Error('Google 驗證尚未連接，請使用訪客或本機示範登入。')
  },
  async loginWithEmail(email, password, mode = 'login') {
    await wait(650)
    if (!email.includes('@') || password.length < 6) throw new Error('請輸入有效 Email，密碼至少 6 個字元。')
    return { id: `demo-email-${email.toLowerCase()}`, name: email.split('@')[0], email, provider: 'demo-email' }
  },
  async guest() {
    await wait(260)
    return { id: 'guest-local', name: '訪客旅人', email: '', provider: 'guest' }
  },
}
