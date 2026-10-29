const enter = document.querySelector('#enter');
const status = document.querySelector('#entry-status');
try {
  const response = await fetch(new URL('./entry-config.json', import.meta.url), {cache: 'no-store', credentials: 'omit'});
  if (!response.ok) throw new Error('Entry unavailable');
  const {backendOrigin} = await response.json();
  if (!backendOrigin) {
    status.textContent = '书页正在准备，稍后再来翻阅。';
  } else {
    const backend = new URL(backendOrigin);
    if (backend.protocol !== 'https:' || !/^[a-z0-9-]+\.onrender\.com$/.test(backend.hostname) || backend.username || backend.password || backend.pathname !== '/' || backend.search || backend.hash || backend.port) throw new Error('Invalid entry');
    const destination = new URL('/login', backend);
    enter.href = destination.href;
    enter.removeAttribute('aria-disabled');
    enter.removeAttribute('tabindex');
    enter.referrerPolicy = 'no-referrer';
    status.textContent = '请使用获准的家人账号登录后阅读。';
  }
} catch {
  status.textContent = '暂时没能打开书页，请稍后重试。';
}
