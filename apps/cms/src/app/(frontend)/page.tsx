import Link from 'next/link'

export default function HomePage() {
  return (
    <div className="shell">
      <header className="topbar">
        <Link href="/" className="brand">
          Диалоги
        </Link>
        <div className="topbar-actions">
          <Link href="/login" className="btn btn-ghost">
            Войти
          </Link>
          <Link href="/register" className="btn btn-primary">
            Создать кабинет
          </Link>
        </div>
      </header>

      <section className="hero">
        <div>
          <h1>Помощники сами пишут клиентам в Telegram</h1>
          <p>
            Подключите номер, опишите сценарий разговора — и помощник ведёт переписку. Если нужно,
            сотрудник подключается сам.
          </p>
          <div className="row" style={{ marginTop: 22 }}>
            <Link href="/register" className="btn btn-primary">
              Начать бесплатно
            </Link>
            <Link href="/admin" className="btn btn-ghost">
              Открыть кабинет
            </Link>
          </div>
        </div>

        <div className="hero-card">
          <h2>Что делать после регистрации</h2>
          <ol className="steps">
            <li>
              <span className="step-num">1</span>
              <div>
                <strong>Подключите номер Telegram</strong>
                <div>Это обычный аккаунт, с которого будут уходить сообщения</div>
              </div>
            </li>
            <li>
              <span className="step-num">2</span>
              <div>
                <strong>Составьте сценарий</strong>
                <div>Как здороваться, что предлагать, когда звать человека</div>
              </div>
            </li>
            <li>
              <span className="step-num">3</span>
              <div>
                <strong>Добавьте контакты и запустите переписку</strong>
                <div>Следите за диалогами и при необходимости отвечайте сами</div>
              </div>
            </li>
          </ol>
        </div>
      </section>
    </div>
  )
}
