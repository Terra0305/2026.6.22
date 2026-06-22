document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href]');
  if (!link) return;

  const href = link.getAttribute('href');
  if (!href || href.startsWith('#') || /^(https?:|mailto:|tel:)/i.test(href)) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

  event.preventDefault();
  const destination = new URL(href, window.location.href);
  window.location.assign(destination.href);
});
