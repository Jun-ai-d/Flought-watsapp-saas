(function () {
  'use strict';

  var script = document.currentScript;
  if (!script) return;

  var token = script.getAttribute('data-token');
  if (!token) {
    console.error('[Flought] Missing data-token on widget script');
    return;
  }

  var apiUrl = script.getAttribute('data-api-url');
  if (!apiUrl) {
    var src = script.src || '';
    try {
      var origin = new URL(src).origin;
      apiUrl = origin.replace(/:\d+$/, '') === origin ? origin.replace(/\/$/, '') : origin;
    } catch (_e) {
      apiUrl = '';
    }
  }
  apiUrl = (apiUrl || '').replace(/\/$/, '');

  var sessionKey = 'flought_widget_session';
  var sessionId = localStorage.getItem(sessionKey);
  if (!sessionId) {
    sessionId = 'widget_' + Math.random().toString(36).slice(2, 15);
    localStorage.setItem(sessionKey, sessionId);
  }

  var businessName = 'Chat';
  fetch(apiUrl + '/api/widget/token-info?token=' + encodeURIComponent(token))
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) { if (d && d.business_name) businessName = d.business_name; })
    .catch(function () {});

  var root = document.createElement('div');
  root.id = 'flought-widget-root';
  root.style.cssText = 'position:fixed;bottom:24px;right:24px;z-index:2147483646;font-family:system-ui,sans-serif;font-size:14px;';
  document.body.appendChild(root);

  var bubble = document.createElement('button');
  bubble.type = 'button';
  bubble.setAttribute('aria-label', 'Open chat');
  bubble.style.cssText =
    'width:56px;height:56px;border-radius:50%;border:none;background:#00B2FF;color:#fff;cursor:pointer;box-shadow:0 4px 12px rgba(0,0,0,.15);font-size:24px;line-height:1;';
  bubble.textContent = '💬';

  var panel = document.createElement('div');
  panel.style.cssText =
    'display:none;position:absolute;bottom:72px;right:0;width:350px;max-width:calc(100vw - 48px);height:500px;max-height:calc(100vh - 96px);background:#fff;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,.18);border:1px solid #e5e7eb;flex-direction:column;overflow:hidden;';

  var header = document.createElement('div');
  header.style.cssText =
    'padding:16px;background:#00B2FF;color:#fff;display:flex;justify-content:space-between;align-items:center;';
  header.innerHTML =
    '<div><strong style="display:block;font-size:14px;">AI Assistant</strong><span style="font-size:10px;opacity:.85;">' +
    businessName +
    '</span></div>';

  var closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = '×';
  closeBtn.style.cssText = 'background:none;border:none;color:#fff;font-size:22px;cursor:pointer;line-height:1;';
  header.appendChild(closeBtn);

  var messages = document.createElement('div');
  messages.style.cssText = 'flex:1;overflow-y:auto;padding:16px;background:#f9fafb;';

  var form = document.createElement('form');
  form.style.cssText = 'display:flex;gap:8px;padding:12px;border-top:1px solid #e5e7eb;background:#fff;';

  var input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Type your message...';
  input.style.cssText =
    'flex:1;border:1px solid #e5e7eb;border-radius:999px;padding:8px 14px;font-size:14px;outline:none;';

  var sendBtn = document.createElement('button');
  sendBtn.type = 'submit';
  sendBtn.textContent = '→';
  sendBtn.style.cssText =
    'width:36px;height:36px;border-radius:50%;border:none;background:#00B2FF;color:#fff;cursor:pointer;font-size:16px;';

  form.appendChild(input);
  form.appendChild(sendBtn);

  panel.style.display = 'none';
  panel.style.flexDirection = 'column';
  panel.appendChild(header);
  panel.appendChild(messages);
  panel.appendChild(form);
  root.appendChild(panel);
  root.appendChild(bubble);

  function appendMessage(text, isBot) {
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;margin-bottom:12px;' + (isBot ? 'justify-content:flex-start;' : 'justify-content:flex-end;');
    var bubbleEl = document.createElement('div');
    bubbleEl.textContent = text;
    bubbleEl.style.cssText =
      'max-width:80%;padding:10px 14px;border-radius:16px;font-size:14px;line-height:1.4;' +
      (isBot
        ? 'background:#fff;border:1px solid #e5e7eb;color:#111;'
        : 'background:#00B2FF;color:#fff;');
    row.appendChild(bubbleEl);
    messages.appendChild(row);
    messages.scrollTop = messages.scrollHeight;
  }

  function openPanel() {
    panel.style.display = 'flex';
    bubble.style.display = 'none';
    if (!messages.childElementCount) {
      appendMessage("Hi! I'm the AI assistant for " + businessName + '. How can I help?', true);
    }
    input.focus();
  }

  function closePanel() {
    panel.style.display = 'none';
    bubble.style.display = 'block';
  }

  bubble.addEventListener('click', openPanel);
  closeBtn.addEventListener('click', closePanel);

  function pollReply(after) {
    var retries = 0;
    var interval = setInterval(function () {
      retries++;
      if (retries > 10) {
        clearInterval(interval);
        return;
      }
      var params = new URLSearchParams({
        widget_token: token,
        sessionId: sessionId,
        after: after,
      });
      fetch(apiUrl + '/api/widget/poll?' + params.toString())
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (d.reply) {
            clearInterval(interval);
            appendMessage(d.reply, true);
          }
        })
        .catch(function () {});
    }, 2000);
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text) return;
    input.value = '';
    appendMessage(text, false);

    var sentAt = new Date().toISOString();
    fetch(apiUrl + '/api/widget/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ widget_token: token, sessionId: sessionId, text: text }),
    })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        if (d.reply) {
          appendMessage(d.reply, true);
        } else if (d.success) {
          pollReply(sentAt);
        } else {
          appendMessage(d.reply || d.error || 'Something went wrong.', true);
        }
      })
      .catch(function () {
        appendMessage('Network error. Please try again.', true);
      });
  });
})();
